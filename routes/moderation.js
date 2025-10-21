

import express from 'express';
const router = express.Router();


export default function moderationRoutes(supabase) {

    // fetching moderation
    router.get("/moderations/:id", async (req, res) => {
        const { id } = req.params;

        const { data, error } = await supabase
            .from("moderations")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            console.error(error);
            return res.status(404).json({ error: "Failed to fetch moderation" });
        }

        res.json(data);

    });


    // saving marker's marks
    router.post("/marks", async (req, res) => {
        const { moderation_id, marker_id, scores, comments, total_score, submitted_at } = req.body;

        console.log("Incoming POST /marks:", req.body);


        const { data, error } = await supabase
            .from("marks")
            .insert([{ moderation_id, marker_id, scores, comments, total_score, submitted_at }])
            .select()
            .single();

        if (error) {
            console.error(error);
            return res.status(404).json({ error: "Failed to save marks" });
        }

        return res.status(200).json({
            message: "Marks saved successfully",
            data: data
        })



    });

    // get marker's mark
    router.get("/marks/:id", async (req, res) => {
        const { moderationId, markerId } = req.params;

        const { data, error } = await supabase
            .from("marks")
            .select("*")
            .eq("moderation_id", moderationId)
            .eq("marker_id", markerId)
            .single();

        if (error) {
            console.error(error);
            return res.status(404).json({ error: "No marks found" });
        }

        res.json(data);
    });

    return router;

}



