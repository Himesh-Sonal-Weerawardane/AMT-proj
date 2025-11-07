import express from 'express';
//import {error} from "handsontable/helpers";
const router = express.Router();

export default function profileRoutes(supabase) {

    router.get('/admin/user/:id/profile', async(req, res) => {

        try {

            const userId = req.params.id;

            if (isNaN(userId)) {
                return res.status(400).json({ error: "Invalid marker ID" });
            }

            const { data: user, error: userError } = await supabase
                .from("users")
                .select("user_id, first_name, last_name, email, is_admin")
                .eq("user_id", userId)
                .single();

            console.log(user);


            if (userError) throw userError;

            let moderations = [];

            if (user.is_admin) {
                const { data: mods, error: modError } = await supabase
                    .from("moderations")
                    .select("id, name, year, semester, assignment_number, due_date, admin_feedback")
                    .order("year", { ascending: false })
                    .order("semester", { ascending: false })
                    .order("due_date", { ascending: false });

                if (modError) throw modError;

                moderations = (mods || []).map((m) => {
                    let totalScore = "-";

                    try {
                        if (m.admin_feedback) {
                            const feedback =
                                typeof m.admin_feedback === "string"
                                    ? JSON.parse(m.admin_feedback)
                                    : m.admin_feedback;

                            if (feedback.criteria && Array.isArray(feedback.criteria)) {
                                const total = feedback.criteria.reduce((sum, c) => {
                                    const [score] = (c.admin_score || "")
                                        .split("/")
                                        .map((s) => parseFloat(s.trim() || 0));
                                    return sum + score;
                                }, 0);

                                const maxScore = feedback.criteria.reduce((sum, c) => {
                                    const [, max] = (c.admin_score || "")
                                        .split("/")
                                        .map((s) => parseFloat(s.trim() || 0));
                                    return sum + max;
                                }, 0);

                                totalScore = `${total} / ${maxScore}`
                            }
                        }
                    } catch (error) {
                        console.log(error);
                    }
                    return {
                        id: m.id,
                        name: m.name,
                        year: m.year,
                        semester: m.semester,
                        assignment_number: m.assignment_number,
                        due_date: m.due_date,
                        total_score: totalScore,
                    };
                });


            } else {

                const { data: marks, error: marksError } = await supabase
                    .from("marks")
                    .select("moderation_id, total_score, submitted_at")
                    .eq("marker_id", userId);

                if (marksError) throw marksError;

                const safeMarks = marks || [];
                if (safeMarks.length === 0) {
                    return res.json({ user, moderations: [] });
                }

                const moderationIds = (marks || []).map((m) => m.moderation_id);
                let moderationsData = [];

                if (moderationIds.length > 0) {
                    const { data: mods, error: modsError } = await supabase
                        .from("moderations")
                        .select("id, name, year, semester, assignment_number")
                        .in("id", moderationIds);

                    if (modsError) throw modsError;
                    moderationsData = mods || [];
                }

                moderations = safeMarks.map(m => {
                    const mod = moderationsData.find(mod => mod.id === m.moderation_id);
                    return {
                        id: m.moderation_id,
                        name: mod.name,
                        year: mod.year,
                        semester: mod.semester,
                        assignment_number: mod.assignment_number,
                        total_score: m.total_score,
                        submitted_at: m.submitted_at,
                    };
                });

            }
            res.json({ user, moderations });

        } catch (error) {
            console.error("error fetching marker profile", error);
            res.status(500).json({ error: "error fetching marker profile" });
        }


    });


    return router;
}