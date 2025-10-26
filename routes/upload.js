import express from "express";
import multer from "multer";
import fs from "fs";
import parseDOCX from "./parseDoc&Docx.js";
import parsePDF from "./parsePDF.js";
import parseXLSX from "./parseXlsx.js";
import path from "path"; // Used for file type filtering

const upload = multer({ dest: "uploads/" }); // temp folder

export default function uploadRoutes(supabase) {
	const router = express.Router();

	// ---------- Helpers ----------
	const normaliseNumber = (value) => {
		if (value === undefined || value === null || value === "") return null;
		const numberValue = Number(value);
		return Number.isNaN(numberValue) ? null : numberValue;
	};

	const normaliseText = (value) => {
		if (typeof value !== "string") return null;
		const trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	};

	const normaliseDate = (value) => {
		if (typeof value !== "string") return null;
		const trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	};

	const safeUnlink = async (path) => {
		if (!path) return;
		try {
			await fs.unlink(path);
		} catch {
			/* ignore */
		}
	};

	// ---------- Routes ----------

	/**
	 * POST /upload_moderation
	 * Uploads an assignment file and a rubric .docx, extracts rubric text,
	 * stores both in Supabase Storage, and creates a row in 'moderations'.
	 * NOTE: Uses `due_date` only (no `deadline_date` column usage anywhere).
	 *       For backward compatibility, if the client still posts `deadline_date`,
	 *       it will be treated as `due_date` internally.
	 */
	router.post(
		"/upload_moderation",
		upload.fields([{ name: "assignment" }, { name: "rubric" }]),
		async (req, res) => {
			console.log("[UploadModeration] Incoming request received");

			// Not sure if the following is needed
			//             // Get token from cookie
			//             const token = req.cookies?.supabase_session;
			//             if (!token) {
			//                 return res.json({ error: "Not logged in" });
			//             }

			//             // Get user from Supabase
			//             const { data: { user }, error: authError } = await supabase.auth.getUser(token);
			//             if (authError || !user) {
			//                 return res.json({ error: "Invalid session" });
			//             }

			//             // Get user_id from database
			//             const { data: userData, error: userError } = await supabase
			//                 .from("users")
			//                 .select("user_id")
			//                 .eq("auth_id", user.id)
			//                 .single();
			//             if (userError || !userData) {
			//                 return res.json({ error: "Access denied" });
			//             }

			const { authorization, ...otherHeaders } = req.headers;
			console.log("[UploadModeration] Request headers:", {
				...otherHeaders,
				authorization: authorization
					? `${authorization.split(" ")[0]} ...${authorization.slice(-4)}`
					: undefined,
			});

			console.log("[UploadModeration] Request body fields:", req.body);

			const assignmentFile = req.files?.assignment?.[0];
			const rubricFile = req.files?.rubric?.[0];

			console.log(
				"[UploadModeration] Assignment file metadata:",
				assignmentFile
					? {
							originalname: assignmentFile.originalname,
							mimetype: assignmentFile.mimetype,
							size: assignmentFile.size,
							path: assignmentFile.path,
						}
					: "No assignment file provided"
			);

			console.log(
				"[UploadModeration] Rubric file metadata:",
				rubricFile
					? {
							originalname: rubricFile.originalname,
							mimetype: rubricFile.mimetype,
							size: rubricFile.size,
							path: rubricFile.path,
						}
					: "No rubric file provided"
			);

			// 1) Read form fields
			const {
				name,
				year,
				semester,
				assignment_number,
				moderation_number,
				description,
				due_date,
				is_rubric_uploaded,
				rubric_table,
			} = req.body;

			// Uploaded Rubric or using the Rubric Table
			const isRubricUploaded = is_rubric_uploaded === "true";

			if (!assignmentFile)
				return res.status(400).json({ error: "Assignment file required" });

			if (isRubricUploaded) {
				if (!rubricFile)
					return res.status(400).json({ error: "Rubric file required" });
			}

			// Check if this module already exists
			const { data: moderationData, error: moderationError } = await supabase
				.from("moderations")
				.select("id")
				.eq("year", year)
				.eq("semester", semester)
				.eq("assignment_number", assignment_number)
				.eq("moderation_number", moderation_number);

			if (moderationError) {
				return res.json({ error: "Error trying to access the database" });
			}

			if (moderationData.length > 0) {
				return res.json({ error: "This module already exists" });
			}

			// 1) Rubric file parsing here.
			let rubricJSON = {};
			if (!isRubricUploaded) {
				console.log("Manual rubric entry begins...");
				rubricJSON = JSON.parse(rubric_table);
				console.log("Manual rubric entry completed!");
			} else if (rubricFile) {
				console.log("Automated rubric parsing begins...");
				// File type: doc/docx, pdf, xlsx
				const ext = path.extname(rubricFile.originalname).toLowerCase();
				try {
					if (ext === ".doc" || ext === ".docx") {
						console.log(
							"[UploadModeration] Converting rubric DOC/DOCX to table format"
						);
						const { title, tables } = await parseDOCX({
							file: rubricFile.path,
						});
						console.log(
							"[UploadModeration] Converting rubric table format to JSON"
						);
						rubricJSON = transformTableToRubric(tables, title, rubricFile);
						console.log("[UploadModeration] DOC/DOCX parsing completed!");
					} else if (ext === ".pdf") {
						rubricJSON = parsePDF(rubricFile.path);
					} else if (ext === ".xlsx") {
						rubricJSON = await parseXLSX(rubricFile.path);
					} else {
						return res.json({ error: "Unsupported rubric file type" });
					}

					if (!rubricJSON) return res.json({ error: "Could not parse rubric" });
				} catch (err) {
					console.error(err);
					return res.json({ error: "Rubric parsing failed" });
				}
				console.log("Automated rubric parsing completed!");
			} else {
				return res.json({ error: "Rubric required (file or manual entry)" });
			}

			if (Object.keys(rubricJSON).length === 0) {
				return res.json({ error: "Rubric parsing failed" });
			}

			let assignmentUrl = `modules/assignments/${assignmentFile.originalname}`;
			let rubricUrl = null;

			try {
				// 2) Upload assignment to Supabase storage
				console.log(
					"[UploadModeration] Uploading assignment to Supabase storage"
				);
				const assignmentBuffer = fs.readFileSync(assignmentFile.path);

				{
					const { data, error } = await supabase.storage
						.from("comp30022-amt")
						.upload(assignmentUrl, assignmentBuffer, {
							contentType: assignmentFile.mimetype,
							upsert: true,
						});

					if (error) {
						console.error(
							"[UploadModeration] Assignment upload failed:",
							error
						);
						throw error;
					}

					console.log("[UploadModeration] Assignment upload response:", data);
				}

				// 3) Upload rubric to Supabase storage

				if (isRubricUploaded) {
					console.log(
						"[UploadModeration] Uploading rubric to Supabase storage"
					);
					const rubricBuffer = fs.readFileSync(rubricFile.path);

					{
						rubricUrl = `modules/rubrics/${rubricFile.originalname}`;
						const { data, error } = await supabase.storage
							.from("comp30022-amt")
							.upload(rubricUrl, rubricBuffer, {
								contentType: rubricFile.mimetype,
								upsert: true,
							});

						if (error) {
							console.error("[UploadModeration] Rubric upload failed:", error);
							throw error;
						}

						console.log("[UploadModeration] Rubric upload response:", data);
					}
				}

				console.log(
					"[UploadModeration] Assignment URL (storage path):",
					assignmentUrl
				);
				console.log("[UploadModeration] Rubric URL (storage path):", rubricUrl);

				const normalizedDueDate = normaliseDate(due_date);

				console.log("[UploadModeration] Preparing database insert with:", {
					name,
					year,
					semester,
					assignment_number,
					moderation_number,
					description,
					due_date: normalizedDueDate,
					rubric_json: rubricJSON,
					created_at: new Date().toISOString(),
					assignmentUrl,
					rubricUrl,
				});

				console.log(
					"[UploadModeration] Executing Supabase insert for moderations"
				);

				const { data: inserted, error: insertError } = await supabase
					.from("moderations")
					.insert([
						{
							name: normaliseText(name),
							year: normaliseNumber(year),
							semester: normaliseNumber(semester),
							assignment_number: normaliseNumber(assignment_number),
							moderation_number: normaliseNumber(moderation_number),
							description: normaliseText(description),
							due_date: normalizedDueDate,
							hidden_from_markers: false,
							rubric_json: rubricJSON,
							assignment_url: assignmentUrl,
							rubric_url: rubricUrl,
						},
					])
					.select("id"); // ensure we get back the id

				if (insertError) {
					console.error(
						"[UploadModeration] Failed to insert module:",
						insertError
					);
					return res.status(500).json({ error: insertError.message });
				}

				const moduleId = inserted?.[0]?.id;
				console.log(
					"[UploadModeration] Returning success response with moduleId:",
					moduleId
				);
				return res.json({ success: true, moduleId });
			} catch (err) {
				console.error(
					"[UploadModeration] Unhandled error while publishing module:",
					err
				);
				return res.status(500).json({ error: "Server error" });
			} finally {
				// Clean up temp files
				await Promise.all([
					safeUnlink(assignmentFile?.path),
					safeUnlink(rubricFile?.path),
				]);
			}
		}
	);

	/**
	 * GET /moderations/:id
	 * Fetch a single moderation with public URLs for assignment & rubric.
	 */
	router.get("/moderations/:id", async (req, res) => {
		const { id } = req.params;

		try {
			const { data, error } = await supabase
				.from("moderations")
				.select("*")
				.eq("id", id)
				.single();

			if (error) {
				console.error("Failed to fetch module:", error);
				return res.status(404).json({ error: "Module not found" });
			}

			const assignmentPath = data.assignment_url;
			const rubricPath = data.rubric_url;

			const assignmentPublicUrl = assignmentPath
				? supabase.storage.from("comp30022-amt").getPublicUrl(assignmentPath)
						.data.publicUrl
				: null;

			const rubricPublicUrl = rubricPath
				? supabase.storage.from("comp30022-amt").getPublicUrl(rubricPath).data
						.publicUrl
				: null;

			// Exclude upload_date from response payload if present
			const { upload_date, ...rest } = data || {};
			return res.json({
				...rest,
				// Make it explicit in payload naming
				assignment_public_url: assignmentPublicUrl,
				rubric_public_url: rubricPublicUrl,
				rubric_json: data.rubric_json,
			});
		} catch (err) {
			console.error("Failed to fetch module:", err);
			return res.status(500).json({ error: "Server error" });
		}
	});

	/**
	 * GET /moderations
	 * List moderations, newest year first. If role=marker, hide rows where hidden_from_markers = true.
	 * Returns `due_date` (no `deadline_date` field in any response).
	 */
	router.get("/moderations", async (req, res) => {
		try {
			const { role } = req.query;

			let query = supabase
				.from("moderations")
				.select("*")
				.order("year", { ascending: false, nullsFirst: false })
				.order("semester", { ascending: true, nullsFirst: false })
				.order("moderation_number", { ascending: true, nullsFirst: false });

			if (role === "marker") {
				// show rows where hidden_from_markers is null or false
				query = query.or(
					"hidden_from_markers.is.null,hidden_from_markers.eq.false"
				);
			}

			const { data, error } = await query;

			if (error) {
				console.error("Failed to fetch modules:", error);
				return res.status(500).json({ error: "Failed to fetch modules" });
			}

			const moderations = (data || []).map((module) => {
				const assignmentPublicUrl = module.assignment_url
					? supabase.storage
							.from("comp30022-amt")
							.getPublicUrl(module.assignment_url).data.publicUrl
					: null;

				const rubricPublicUrl = module.rubric_url
					? supabase.storage
							.from("comp30022-amt")
							.getPublicUrl(module.rubric_url).data.publicUrl
					: null;

				return {
					id: module.id,
					name: module.name,
					year: module.year,
					semester: module.semester,
					moderation_number: module.moderation_number,
					due_date: module.due_date, // <-- expose due_date only
					description: module.description,
					hidden_from_markers: module.hidden_from_markers,
					assignment_public_url: assignmentPublicUrl,
					rubric_public_url: rubricPublicUrl,
					rubric: module.rubric_json,
				};
			});

			return res.json({ moderations });
		} catch (err) {
			console.error("Failed to fetch modules:", err);
			return res.status(500).json({ error: "Server error" });
		}
	});

	/**
	 * POST /moderations/batch-delete
	 * Deletes multiple moderations by ID.
	 */
	router.post("/moderations/batch-delete", async (req, res) => {
		const { ids } = req.body;

		if (!Array.isArray(ids) || ids.length === 0) {
			return res.status(400).json({ error: "No module IDs supplied" });
		}

		try {
			const { error } = await supabase
				.from("moderations")
				.delete()
				.in("id", ids);

			if (error) {
				console.error("Failed to delete modules:", error);
				return res.status(500).json({ error: "Failed to delete modules" });
			}

			return res.json({ success: true });
		} catch (err) {
			console.error("Unhandled error deleting modules:", err);
			return res.status(500).json({ error: "Server error" });
		}
	});

	/**
	 * POST /moderations/batch-visibility
	 * Bulk-set hidden_from_markers for supplied IDs.
	 */
	router.post("/moderations/batch-visibility", async (req, res) => {
		const { ids, hidden } = req.body;

		if (!Array.isArray(ids) || ids.length === 0) {
			return res.status(400).json({ error: "No module IDs supplied" });
		}

		const shouldHide = Boolean(hidden);

		try {
			const { error } = await supabase
				.from("moderations")
				.update({ hidden_from_markers: shouldHide })
				.in("id", ids);

			if (error) {
				console.error("Failed to update module visibility:", error);
				return res
					.status(500)
					.json({ error: "Failed to update module visibility" });
			}

			return res.json({ success: true, hidden: shouldHide });
		} catch (err) {
			console.error("Unhandled error updating visibility:", err);
			return res.status(500).json({ error: "Server error" });
		}
	});

	return router;
}

// Transform the rubric doc/docx parsed file into a JSON file
function transformTableToRubric(tableData, rubricTitle, rubricFile) {
	const rubricJSON = {
		rubric: {
			rubricTitle: rubricTitle,
			pdfFile: rubricFile.originalname,
		},
		criteria: [],
	};

	const gradesOrder = [];
	// Loop through grade columns (columns 1 to 5)
	// Loop through grade columns (columns 1 to 5)
	for (let i = 1; i <= 5; i++) {
		const gradeName = tableData[0][0][i]?.data?.trim();
		if (gradeName) {
			gradesOrder.push(gradeName);
		}
	}

	// Loop over rows (skip row 0 - this is the header)
	for (let i = 1; i < Object.keys(tableData[0]).length; i++) {
		const row = tableData[0][i]; // row is an array of cells
		const criterionCell = row[0]?.data.trim(); // first column
		const maxPointsCell = row[6]?.data.trim(); // last column

		const criterionObj = {
			criterion: criterionCell,
			// Extract only digits and decimal points from the string.
			// Convert the cleaned string to a number.
			// Default to 0 if parsing fails.
			maxPoints: Number(maxPointsCell.replace(/[^0-9.]/g, "")) || 0,
			grades: [],
		};

		// Loop through grade columns (columns 1 to 5)
		for (let colIndex = 1; colIndex <= 5; colIndex++) {
			// Remove leading/trailing whitespace.
			// Default to empty string if any values are undefined or null.
			const cellData = row[colIndex]?.data?.trim() || "";
			// Split the string into an array or lines.
			// Remove leading/trailing whitespace.
			// Remove any empty lines.
			const lines = cellData
				.split("\n")
				.map((l) => l.trim())
				.filter((l) => l);

			// Separate points range from description if included.
			let pointsRange = "";

			// Remove the first line - max points in description.
			lines.shift();

			const lastLine = lines[lines.length - 1] || "";
			// \(...\) Match parentheses.
			// ([^)]+) Match everything inside parentheses that are not parentheses
			const pointsMatch = lastLine.match(/\(([^)]+)\)/);
			if (pointsMatch) {
				pointsRange = pointsMatch[0];
				lines.pop(); // remove last line - points range from description
			}

			// NOTE: CHECK THIS
			// Check this, grad is not being input
			const gradeObj = {
				grade: gradesOrder[colIndex - 1],
				pointsRange,
				description: lines,
			};

			criterionObj.grades.push(gradeObj);
		}

		rubricJSON.criteria.push(criterionObj);
	}

	return rubricJSON;
}
