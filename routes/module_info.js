import express from "express"

export default function authRoutes(supabase) {
    const router = express.Router()

    // What data to display on the assignment modules front page
    router.post("/display_modules_frontpage", async (req, res) => {
        try {
            // Get token from cookie
            const token = req.cookies?.supabase_session;
            if (!token) {
                return res.status(401).json({ error: "Not logged in" });
            }

            // Get user from Supabase
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
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

            let result;
            if (userData.is_admin) {
                // Call function to return statistics and other
                result = await adminData(userData);
            } else {
                // Call function to return data for this marker
                result = await markerData(userData);
            }

            if (result.error) {
                return res.json({ error: result.error })
            }
            return res.json({ results: result });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server error" });
        }
    })

    // Return data for an admin
    async function adminData(userData) {
        
    }

    // Return data for a marker
    async function markerData(userData) {
        // Get the marking attempts this user has access to
        const { data: markData, error: markError } = await supabase
            .from("marks")
            .select("moderation_id, scores")
            .eq("user_id", userData.user_id)
        // No marking attempts for this user, return nothing
        if (markError || !markData || markData.length === 0) {
            return { error: "No marking attempts found" };
        }

        // Collect all moderation IDs
        const moderationIDs = markData.map(m => m.moderation_id);

        // Get the moderation information for the marking attempts
        const { data: moderationData, error: moderationError } = await supabase
            .from("moderations")
            .select("name, year, semester, assignment_num, moderation_num, admin_id")
            .in("moderation_id", moderationIDs);
        // Cannot find module information
        if (moderationError || !moderationData || moderationData.length === 0) {
            return { error: "Module Information not found" };
        }

        // Collect all admin IDs
        const adminIDs = moderationData.map(m => m.admin_id);

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
        const result = {}
        for (const mark of markData) {
            const modID = mark.moderation_id;
            if (!result[modID]) {
                result[modID] = { user_total: 0, admin_total: 0 };
            }

            // User's score
            result[modID].user_total = getTotalScore(mark.scores);

            // Admin's score
            const adminMark = adminMarksData.find(a => a.moderation_id === modID);
            if (adminMark) {
                result[modID].admin_total = getTotalScore(adminMark.scores);
            }
        }

        // Merge with moderation info
        const combinedResult = moderationData.map(m => ({
            moderation_id: m.moderation_id,
            name: m.name,
            year: m.year,
            semester: m.semester,
            assignment_num: m.assignment_num,
            moderation_num: m.moderation_num,
            user_total: result[m.moderation_id]?.user_total || 0,
            admin_total: result[m.moderation_id]?.admin_total || 0,
            role: "Marker"
        }));

        return combinedResult;
    }

    return router
}

// Sum the total from a JSON file
function getTotalScore(scoresJson) {
  if (!scoresJson) return 0;
  return 50;
  // return Object.values(scoresJson).reduce((sum, val) => sum + (Number(val) || 0), 0);
}