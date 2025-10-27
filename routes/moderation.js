import express from 'express';
const router = express.Router();


export default function moderationRoutes(supabase) {

    // fetching moderation
    router.get("/moderations/:id", async (req, res) => {
        const { id } = req.params;

        const { data, error } = await supabase
            .from("moderations")
            .select("*, rubric_json, admin_feedback")
            .eq("id", id)
            .single();

        if (error) {
            console.error(error);
            return res.status(404).json({ error: "Failed to fetch moderation" });
        }

        if (data.assignment_url) {
            const { data: publicURL } = supabase.storage
                .from("comp30022-amt")
                .getPublicUrl(data.assignment_url);

            data.assignment_url = publicURL.publicUrl;
        }

        res.json(data);

    });

    router.get("/moderations/:id/stats", async (req, res) => {
        const { id } = req.params;

        const { data, error } = await supabase
            .from("moderation_stats")
            .select("*")
            .eq("moderation_id", id);

        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Failed to fetch moderation statistics" });
        }

        res.json({ data });

    });


    // saving marker's marks
    router.post("/marks", async (req, res) => {

        try {
            const { moderation_id, marker_id, scores, comments, total_score, submitted_at } = req.body;

            console.log("Incoming POST /marks:", req.body);


            const { data: markData, error: markError } = await supabase
                .from("marks")
                .insert([{ moderation_id, marker_id, scores, comments, total_score, submitted_at }])
                .select()
                .single();

            if (markError) throw markError;

            const { data: moderationData, error: moderationError } = await supabase
                .from("moderations")
                .select("admin_feedback, rubric_json")
                .eq("id", moderation_id)
                .single();

            if (moderationError) throw moderationError;

            const adminCriteria = moderationData.admin_feedback?.criteria || [];
            const rubricCriteria = moderationData.rubric_json?.criteria || [];
            const markerScores = markData.scores || [];

            const criteriaStats = adminCriteria.map((criterion, index) => {
                const [adminScore, adminOutOf] = criterion.admin_score
                    .split(" / ")
                    .map(parseFloat);

                const markerScoreStr = markerScores[index]?.score || "0 / 0";
                const [markerScore, markerOutOf] = markerScoreStr
                    .split(" / ")
                    .map(parseFloat);

                const maxPoints = rubricCriteria[index]?.maxPoints || adminOutOf || markerOutOf || 0;
                const adminPercent = ((adminScore / maxPoints) * 100).toFixed(2);
                const markerPercent = ((markerScore / maxPoints) * 100).toFixed(2);
                const diffPercent = (adminPercent - markerPercent).toFixed(2);

                return {
                    moderation_id,
                    marker_id,
                    criterion: criterion.criterion,
                    max_points: maxPoints,
                    unit_chair_marks: adminScore,
                    range_lower: (adminScore - maxPoints * 0.05).toFixed(2),
                    range_upper: (adminScore + maxPoints * 0.05).toFixed(2),
                    marker_mark: markerScore,
                    unit_chair_pct: adminPercent,
                    marker_pct: markerPercent,
                    difference_pct: diffPercent,
                };
            });


            await supabase
                .from("moderation_stats")
                .delete()
                .eq("moderation_id", moderation_id)
                .eq("marker_id", marker_id);

            const { error: statsError } = await supabase.from("moderation_stats").insert(criteriaStats);
            if (statsError) throw statsError;

            res.status(200).json({
                message: "Marks and stats saved successfully",
                data: {
                    scores,
                    comments,
                    total_score,
                    submitted_at,
                },
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to save stats" } );
        }

    });



    // get marker's mark
    router.get("/marks/:moderationId/:markerId", async (req, res) => {
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

    // get admin's feedback
    router.get("/feedback/:moderationId", async (req, res) => {
        const { moderationId } = req.params;

        try {
            const { data, error } = await supabase
                .from("moderations")
                .select("admin_feedback")
                .eq("id", moderationId)
                .single();

            if (error) {
                console.error(error);
                return res.status(404).json({ error: "Failed to fetch feedback" });
            }

            if (!data?.admin_feedback) {
                return res.status(404).json({ error: "no feedback found" });
            }

            res.status(200).json(data.admin_feedback);
        } catch (error) {
            console.error("Error fetching feedback", error);
            res.status(500).json({ error: "Failed to fetch feedback" });
        }
    });


    // get admin and marker's marks
    router.get("/stats/:moderationId/:markerId", async (req, res) => {
        const { moderationId, markerId } = req.params;

        try {
            const { data: moderationData, error: moderationError } = await supabase
                .from("moderations")
                .select("admin_feedback, rubric_json")
                .eq("id", moderationId)
                .single();


            const { data: markData, error: markError } = await supabase
                .from("marks")
                .select("scores")
                .eq("moderation_id", moderationId)
                .eq("marker_id", markerId)
                .single();

            if (moderationError) {
                console.error(moderationError);
                return res.status(404).json({error: "Moderation not found"});
            }

            if (markError) {
                console.error(markError);
                return res.status(404).json({ error: "Marks not found for this marker" });
            }

            const adminCriteria = moderationData.admin_feedback?.criteria || [];
            const rubricCriteria = moderationData.rubric_json?.criteria || [];
            const markerScores = markData.scores || [];

            const criteriaStats = adminCriteria.map((criterion, index) => {
                const [adminScore, adminOutOf] = criterion.admin_score
                    .split(" / ")
                    .map(parseFloat);

                const markerScoreStr = markerScores[index]?.score || "0 / 0";
                const [markerScore, markerOutOf] = markerScoreStr
                    .split(" / ")
                    .map(parseFloat);

                const maxPoints = rubricCriteria[index]?.maxPoints || adminOutOf || markerOutOf || 0;

                const adminPercent = ((adminScore / maxPoints) * 100).toFixed(2);
                const markerPercent = ((markerScore / maxPoints) * 100).toFixed(2);
                const diffPercent = (adminPercent - markerPercent).toFixed(2);

                return {
                    criterion: criterion.criterion,
                    max_points: maxPoints,
                    admin_score: adminScore,
                    admin_percent: adminPercent,
                    lower: (adminScore - maxPoints * 0.05).toFixed(2),
                    upper: (adminScore + maxPoints * 0.05).toFixed(2),
                    marker_score: markerScore,
                    marker_percent: markerPercent,
                    diff_percent: diffPercent,
                };
            });

            res.json({ criteria: criteriaStats });
        } catch (error) {
            console.error(error);
            res.status(404).json({error: "Failed to calculate stats"});
        }

    });

    return router;

}