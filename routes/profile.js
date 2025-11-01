import express from 'express';
//import {error} from "handsontable/helpers";
const router = express.Router();

export default function profileRoutes(supabase) {

    router.get('/admin/marker/:id/profile', async(req, res) => {

        try {

            const markerId = req.params.id;

            if (isNaN(markerId)) {
                return res.status(400).json({ error: "Invalid marker ID" });
            }

            const { data: marker, error: markerError } = await supabase
                .from("users")
                .select("user_id, first_name, last_name, email, is_admin")
                .eq("user_id", markerId)
                .single();


            if (markerError) throw markerError;

            const { data: marks, error: marksError } = await supabase
                .from("marks")
                .select("moderation_id, total_score, submitted_at")
                .eq("marker_id", markerId);

            if (marksError) throw marksError;


            const moderationIds = marks.map((mark) => mark.moderation_id);

            let moderations = [];
            if (moderationIds.length >= 0) {
                const { data: mods, error: modError } = await supabase
                    .from("moderations")
                    .select("id, name, year, semester, assignment_number")
                    .in("id", moderationIds);

                if (modError) throw modError;

                moderations = mods.map((mod) => {
                    const mark = marks.find((m) => m.moderation_id === mod.id);
                    return {
                        id: mod.id,
                        name: mod.name,
                        year: mod.year,
                        semester: mod.semester,
                        assignment_number: mod.assignment_number,
                        total_score: mark?.total_score || "-",
                        submitted_at: mark?.submitted_at || "-",
                    };
                });
            }

            res.json({
                marker,
                moderations,
            });

        } catch (error) {
            console.error("error fetching marker profile", error);
            res.status(500).json({ error: "error fetching marker profile" });
        }


    });


    return router;
}