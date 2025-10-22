import express from "express";
import multer from "multer";
import fs from "fs";
import parseDOCX from './parseDoc&Docx.js';
import parsePDF from './parsePDF.js';
import parseXLSX from './parseXlsx.js';
import path from "path"; // Used for file type filtering

const upload = multer({ dest: "uploads/" }); // temp folder

export default function uploadRoutes(supabase) {
    const router = express.Router();

    // Upload and publish a module
    router.post("/upload_module", upload.fields([
        { name: "assignment" },
        { name: "rubric" }
    ]), async (req, res) => {
        try {
            // Get token from cookie
            const token = req.cookies?.supabase_session;
            if (!token) {
                return res.json({ error: "Not logged in" });
            }

            // Get user from Supabase
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError || !user) {
                return res.json({ error: "Invalid session" });
            }

            // Get user_id from database
            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("user_id")
                .eq("auth_id", user.id)
                .single();
            if (userError || !userData) {
                return res.json({ error: "Access denied" });
            }

            // Module to be created
            const { moderation_title, year, semester, assignment_number, 
                moderation_number, description, due_date } = req.body

            // Check if the data (year and deadline_date) is valid

            // Assignment and Rubric files
            const assignmentFile = req.files.assignment?.[0];
            const rubricFile = req.files.rubric?.[0];
            if (!assignmentFile) return res.json({ error: "Assignment file required" });
            if (!rubricFile) return res.json({ error: "Rubric file required" });

            // Check if this module does not already exist
            const { data: moderationData, error: moderationError } = await supabase
                .from("moderations")
                .select("id")
                .eq("year", year)
                .eq("semester", semester)
                .eq("assignment_number", assignment_number)
                .eq("moderation_number", moderation_number)

            if (moderationError) {
                return res.json({ error: "Error trying to access the database" });
            }

            if (moderationData.length > 0) {
                return res.json({ error: "This module already exists" })
            }

            // Added the file parsing here.
            let rubricJSON = {};

            if (req.body.rubric) {
                // Manual JSON entry
                console.log("Manual rubric entry begins...");
                rubricJSON = JSON.parse(req.body.rubric);
                console.log("Manual rubric entry completed!");
            } else if (rubricFile) {
                console.log("Automated rubric parsing begins...");
                const ext = path.extname(rubricFile.originalname).toLowerCase();
                try {
                    if (ext === ".doc" || ext === ".docx") {
                        console.log("DOC/DOCX parsing started...");
                        const { title, tables } = await parseDOCX({ file: rubricFile.path });
                        rubricJSON = transformTableToRubric(tables, title, rubricFile);
                        console.log("DOC/DOCX parsing completed!");
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

            // Module does not exist, can create module
            // Parse the rubric file (docx)
            // let rubricJSON = {};
            // parseDOCX({
            //     file: rubricFile.path
            // }).then(({ title, tables}) => {
            //     // Parse depending on docx or pdf
            //     const rubricJson = transformTableToRubric(tables, title, rubricFile);

            //     if (!rubricJson) {
            //         console.log("Could not parse the rubric");
            //         return res.json({ error: "Could not parse the Rubric" });
            //     } else {
            //         console.log("Rubric succesfully parsed!");
            //         rubricJSON = rubricJson;
            //         // console.log(JSON.stringify(rubricJSON, null, 3));
            //     }
            // }).catch((error) => {
            //     console.error(error);
            //     return res.json({ error });
            // })

            // or Parse the rubric file (pdf)

            // Upload assignment to storage bucket
            const assignmentPath = `assignments/${year}/${assignmentFile.originalname}`;
            if (assignmentFile) {
                const fileBuffer = fs.readFileSync(assignmentFile.path);
                const { data, error } = await supabase.storage
                    .from("comp30022-amt")
                    .upload(assignmentPath, fileBuffer, {
                        contentType: assignmentFile.mimetype,
                        upsert: true
                    });
                if (error) throw error;
            }

            // NOTE: NOT TESTED
            // To download the file, you would do this:
            // const { data, error } = await supabase.storage
            //     .from('comp30022-amt')
            //     .download('assignments/${year}/${assignmentFile.originalname}')
            // if (error) throw error;

            // Upload rubric to storage bucket
            const rubricPath = `rubrics/${year}/${rubricFile.originalname}`;
            if (rubricFile) {
                const fileBuffer = fs.readFileSync(rubricFile.path);
                const { data, error } = await supabase.storage
                    .from("comp30022-amt")
                    .upload(rubricPath, fileBuffer, {
                        contentType: rubricFile.mimetype,
                        upsert: true
                    });
                if (error) throw error;
            }

            console.log("Trying to insert in database...")

            // Store in database
            const { data, error } = await supabase
                .from("moderations")
                .insert([{
                    // automatic moderation id
                    admin_id: userData.user_id,
                    year,
                    semester,
                    assignment_number,
                    moderation_number,
                    description,
                    due_date,
                    rubric_json: rubricJSON,
                    created_at: new Date().toISOString(),
                    assignment_url: assignmentPath,
                    rubric_url: rubricPath,
            }]);

            if (error) {
                console.log("Failed to insert in database!")
                console.error("Failed to insert module, files may have been uploaded:", error);
                return res.json({ error: error.message });
            }

            // Redirect to Assignment Modules Front Page
            console.log("Succesfully created new module!");
            res.json({ success: true, redirect: "/admin/moderation-frontpage.html" });

        } catch (err) {
            console.error("Failed to insert module:", err);
            res.json({ error: "Server error" });
        }
  })

  return router
}


// Transform the rubric doc/docx parsed file into a JSON file
function transformTableToRubric(tableData, rubricTitle, rubricFile) {
    const rubricJSON = {
        rubric: {
            rubricTitle: rubricTitle,
            pdfFile: rubricFile.originalname
        },
        criteria: []
    }

    const gradesOrder = []
    // Loop through grade columns (columns 1 to 5)
    // Loop through grade columns (columns 1 to 5)
    for (let i = 1; i <= 5; i++) {
        const gradeName = tableData[0][i]?.data?.trim();
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
            grades: []
        };

        // Loop through grade columns (columns 1 to 5)
        for (let colIndex = 1; colIndex <= 5; colIndex++) {
            // Remove leading/trailing whitespace.
            // Default to empty string if any values are undefined or null.
            const cellData = row[colIndex]?.data?.trim() || "";
            // Split the string into an array or lines.
            // Remove leading/trailing whitespace.
            // Remove any empty lines.
            const lines = cellData.split("\n").map(l => l.trim()).filter(l => l);

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

            const gradeObj = {
                grade: gradesOrder[colIndex - 1],
                pointsRange,
                description: lines
            };

            criterionObj.grades.push(gradeObj);
        }

        rubricJSON.criteria.push(criterionObj);
    }

    return rubricJSON;
}