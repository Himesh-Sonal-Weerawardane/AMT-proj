import express from 'express';
const router = express.Router();


export default function moderationRoutes(supabase) {


    // get active moderations by sem and assignment
    router.get("/moderations/current", async (req, res) => {

        try {

            const now = new Date();
            const currentYear = now.getFullYear();
            const currentSemester = now.getMonth() < 6 ? 1 : 2;

            const { data: moderations, error: moderationError } = await supabase
                .from("moderations")
                .select("id, name, year, semester, name, due_date")
                .eq("year", currentYear)
                .eq("semester", currentSemester);

            if (moderationError) throw moderationError;


            const { data: marks, error: markError } = await supabase
                .from("marks")
                .select("moderation_id, total_score, submitted_at");

            if (markError) throw markError;

            const markMap = {};
            marks.forEach((mark) => {
                markMap[mark.moderation_id] = {
                    total_score: mark.total_score,
                    submitted_at: mark.submitted_at,
                };
            });

            const merged = moderations.map(m => ({
                ...m,
                score: markMap[m.id]?.total_score || "-",
                submitted_at: markMap[m.id]?.submitted_at
                    ? new Date(markMap[m.id].submitted_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                    })
                    : "-",
            }));

            const grouped = {};
            merged.forEach(row => {
                if (!grouped[row.name]) {
                    grouped[row.name] = [];
                }
                grouped[row.name].push(row);
            });


            const result = {
                year: currentYear,
                semester: currentSemester,
                assignments: Object.entries(grouped).map(([name, moderations]) => ({
                    name,
                    moderations,
                })),
            };

            console.log(result);
            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch active moderations" } );
        }
    });

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

            const parseScore = (scoreString = "") => {
                const [scoreValue, outOfValue] = scoreString
                    .split(" / ")
                    .map((value) => {
                        const parsed = parseFloat(value);
                        return Number.isFinite(parsed) ? parsed : 0;
                    });

                return {
                    score: Number.isFinite(scoreValue) ? scoreValue : 0,
                    outOf: Number.isFinite(outOfValue) ? outOfValue : 0,
                };
            };

            const roundToTwo = (value) => {
                if (!Number.isFinite(value)) return null;
                return Number(Math.round(value * 100) / 100);
            };

            const criteriaStats = adminCriteria.map((criterion, index) => {
                const adminParts = parseScore(criterion?.admin_score || "0 / 0");
                const markerScoreStr = markerScores[index]?.score || "0 / 0";
                const markerParts = parseScore(markerScoreStr);

                const rubricMax = rubricCriteria[index]?.maxPoints;
                const maxPointsCandidate = [rubricMax, adminParts.outOf, markerParts.outOf]
                    .map((value) => {
                        const numeric = parseFloat(value);
                        return Number.isFinite(numeric) ? numeric : 0;
                    })
                    .find((value) => value > 0) || 0;

                const maxPoints = roundToTwo(maxPointsCandidate);

                const unitChairPercent = maxPoints && adminParts.score >= 0
                    ? roundToTwo((adminParts.score / maxPoints) * 100)
                    : null;
                const markerPercent = maxPoints && markerParts.score >= 0
                    ? roundToTwo((markerParts.score / maxPoints) * 100)
                    : null;

                const lowerBound = maxPoints != null && Number.isFinite(maxPoints)
                    ? roundToTwo(adminParts.score - (maxPoints * 0.05))
                    : null;
                const upperBound = maxPoints != null && Number.isFinite(maxPoints)
                    ? roundToTwo(adminParts.score + (maxPoints * 0.05))
                    : null;

                const differencePercent = (markerPercent != null && unitChairPercent != null)
                    ? roundToTwo(markerPercent - unitChairPercent)
                    : null;

                return {
                    moderation_id,
                    marker_id,
                    criterion: criterion?.criterion || `Criterion ${index + 1}`,
                    max_points: maxPoints,
                    unit_chair_mark: roundToTwo(adminParts.score),
                    range_lower: lowerBound,
                    range_upper: upperBound,
                    marker_mark: roundToTwo(markerParts.score),
                    unit_chair_pct: unitChairPercent,
                    marker_pct: markerPercent,
                    difference_pct: differencePercent,
                };
            });


            await supabase
                .from("moderation_stats")
                .delete()
                .eq("moderation_id", moderation_id)
                .eq("marker_id", marker_id);

            const filteredStats = criteriaStats.filter((stat) => stat.criterion);

            if (filteredStats.length > 0) {
                const { error: statsError } = await supabase.from("moderation_stats").insert(filteredStats);
                if (statsError) throw statsError;
            }

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

    router.get("/moderations/:moderationId/stats", async (req, res) => {
        const { moderationId } = req.params;

        try {
            const { data, error } = await supabase
                .from("moderation_stats")
                .select("*")
                .eq("moderation_id", moderationId)
                .order("criterion", { ascending: true })
                .order("marker_id", { ascending: true });

            if (error) throw error;

            res.json(data || []);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch moderation statistics" });
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