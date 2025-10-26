import express from "express";

export default function authRoutes(supabase) {
	const router = express.Router();

	// What data to display on the assignment modules front page
	router.post("/display_modules_frontpage", async (req, res) => {
		try {
			// Get token from cookie
			const token = req.cookies?.supabase_session;
			if (!token) {
				return res.status(401).json({ error: "Not logged in" });
			}

			// Get user from Supabase
			const {
				data: { user },
				error: authError,
			} = await supabase.auth.getUser(token);
			if (authError || !user) {
				return res.status(401).json({ error: "Invalid session" });
			}

			// Get user_id and role from database
			const { data: userData, error: userError } = await supabase
				.from("users")
				.select("user_id, is_admin")
				.eq("auth_id", user.id)
				.single();
			if (userError || !userData) {
				return res.status(403).json({ error: "Access denied" });
			}

			if (userData.is_admin) {
				// Call function to return statistics and other
				const result = await adminData(userData);
				if (result.error) {
					return res.json({ error: result.error });
				}
				return res.json({ results: result, role: "Admin" });
			} else {
				// Call function to return data for this marker
				const result = await markerData(userData);
				if (result.error) {
					return res.json({ error: result.error });
				}
				return res.json({ results: result, role: "Marker" });
			}
		} catch (err) {
			console.error(err);
			res.status(500).json({ error: "Server error" });
		}
	});

	// Return data for an admin
	async function adminData(userData) {
		// Get the module information
		const { data: moderationData, error: moderationError } = await supabase
			.from("moderations")
			.select(
				"moderation_id, name, year, semester, assignment_num, moderation_num, admin_id"
			);
		// Cannot find module information
		if (moderationError || !moderationData || moderationData.length === 0) {
			return { error: "Module Information not found" };
		}

		// Get the marking attempts of users (admin + markers) for all moderations
		const { data: markData, error: markError } = await supabase
			.from("marks")
			.select("user_id, moderation_id, scores");
		// No marking attempts for this user, return nothing
		if (markError || !markData || markData.length === 0) {
			return { error: "No marking attempts found" };
		}

		// Calculate statistics per moderation
		const result = {};
		for (const moderation of moderationData) {
			const modID = moderation.moderation_id;

			if (!result[modID]) {
				result[modID] = {
					admin_total: 0,
					average: 0,
					variation: 0,
					distribution: 0,
				};
			}

			let sum = 0,
				count = 0;
			for (const mark of markData) {
				if (mark.moderation_id === modID) {
					// Admin marks
					if (mark.user_id === userData.user_id) {
						result[modID].admin_total = getTotalScore(mark.scores);
					} else {
						count++;
						sum = getTotalScore(mark.scores);
					}
				}
			}

			const average = sum / count;
			result[modID].average = average;
		}

		// Merge with moderation info
		const combinedResult = moderationData.map((m) => ({
			moderation_id: m.moderation_id,
			name: m.name,
			year: m.year,
			semester: m.semester,
			assignment_num: m.assignment_num,
			moderation_num: m.moderation_num,
			admin_total: result[m.moderation_id]?.admin_total || 0,
			average: result[m.moderation_id]?.average || 0,
			variation: result[m.moderation_id]?.variation || 0,
			distribution: result[m.moderation_id]?.distribution || 0,
			role: "Admin",
		}));

		// Sort after mapping
		combinedResult.sort((a, b) => {
			if (a.year !== b.year) return b.year - a.year; // Descending order
			if (a.semester !== b.semester) return a.semester - b.semester; // Ascending order
			if (a.assignment_num !== b.assignment_num)
				return a.assignment_num - b.assignment_num; // Ascending order
			return a.moderation_num - b.moderation_num; // Ascending order
		});

		return combinedResult;
	}

	// Return data for a marker
	async function markerData(userData) {
		// Get the marking attempts this user has access to
		const { data: markData, error: markError } = await supabase
			.from("marks")
			.select("moderation_id, scores")
			.eq("user_id", userData.user_id);
		// No marking attempts for this user, return nothing
		if (markError || !markData || markData.length === 0) {
			return { error: "No marking attempts found" };
		}

		// Collect all moderation IDs
		const moderationIDs = markData.map((m) => m.moderation_id);

		// Get the moderation information for the marking attempts
		const { data: moderationData, error: moderationError } = await supabase
			.from("moderations")
			.select(
				"moderation_id, name, year, semester, assignment_num, moderation_num, admin_id"
			)
			.in("moderation_id", moderationIDs);
		// Cannot find module information
		if (moderationError || !moderationData || moderationData.length === 0) {
			return { error: "Module Information not found" };
		}

		// Collect all admin IDs
		const adminIDs = moderationData.map((m) => m.admin_id);

		// Get the marking attempts for admin for those moderation IDs
		const { data: adminMarksData, error: adminMarksError } = await supabase
			.from("marks")
			.select("moderation_id, scores")
			.in("moderation_id", moderationIDs)
			.in("user_id", adminIDs);
		// Cannot find admin information
		if (adminMarksError || !adminMarksData) {
			return { error: "Error fetching marks" };
		}

		// Combine user and admin total scores per moderation
		const result = {};
		for (const mark of markData) {
			const modID = mark.moderation_id;
			if (!result[modID]) {
				result[modID] = { user_total: 0, admin_total: 0 };
			}

			// User's score
			result[modID].user_total = getTotalScore(mark.scores);

			// Admin's score
			const adminMark = adminMarksData.find((a) => a.moderation_id === modID);
			if (adminMark) {
				result[modID].admin_total = getTotalScore(adminMark.scores);
			}
		}

		// Merge with moderation info
		const combinedResult = moderationData.map((m) => ({
			moderation_id: m.moderation_id,
			name: m.name,
			year: m.year,
			semester: m.semester,
			assignment_num: m.assignment_num,
			moderation_num: m.moderation_num,
			user_total: result[m.moderation_id]?.user_total || 0,
			admin_total: result[m.moderation_id]?.admin_total || 0,
		}));

		// Sort after mapping
		combinedResult.sort((a, b) => {
			if (a.year !== b.year) return b.year - a.year; // Descending order
			if (a.semester !== b.semester) return a.semester - b.semester; // Ascending order
			if (a.assignment_num !== b.assignment_num)
				return a.assignment_num - b.assignment_num; // Ascending order
			return a.moderation_num - b.moderation_num; // Ascending order
		});

		return combinedResult;
	}

	return router;
}

// Sum the total from a JSON file
function getTotalScore(scoresJson) {
	if (!scoresJson) return 0;
	return Object.values(scoresJson).reduce(
		(sum, val) => sum + (Number(val) || 0),
		0
	);
}
