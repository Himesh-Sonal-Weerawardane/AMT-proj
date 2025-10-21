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
    router.post("/marks/:moderationId/:markerId", async (req, res) => {
        const { moderation_id, marker_id, scores, comments } = req.body;

        const { data, error } = await supabase
            .from("marks")
            .insert([{ moderation_id, marker_id, scores, comments }])
            .select()
            .single();

        if (error) {
            console.error(error);
            return res.status(404).json({ error: "Failed to save marks" });
        }

        res.json(data);
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



