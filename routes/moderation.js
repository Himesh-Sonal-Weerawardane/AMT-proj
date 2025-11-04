import express from "express";

const router = express.Router();

export default function moderationRoutes(supabase) {
    // admin's front page
    router.get("/moderations/progress/recent-assignment", async (req, res) => {
        try {
            const { data: allMods, error: modsErr } = await supabase
                .from("moderations")
                .select("id, assignment_number, name, year, semester, due_date, admin_feedback")
                .order("year", { ascending: false })
                .order("semester", { ascending: false })
                .order("due_date", { ascending: false });

            if (modsErr) throw modsErr;
            if (!allMods || allMods.length === 0) {
                return res.json({
                    assignment_name: null,
                    semester: null,
                    year: null,
                    results: [],
                });
            }

            const recentYear = allMods[0].year;
            const recentSem = allMods[0].semester;

            const assignmentSameSem = allMods.filter(
                (mod) => mod.year === recentYear && mod.semester === recentSem
            );

            const assignmentGroup = {};
            assignmentSameSem.forEach((mod) => {
                const key = mod.assignment_number;
                if (!assignmentGroup[key]) assignmentGroup[key] = [];
                assignmentGroup[key].push(mod);
            });

            const latestAssignment = Object.entries(assignmentGroup).sort(
                ([, modsA], [, modsB]) =>
                    new Date(modsB[0].due_date) - new Date(modsA[0].due_date)
            )[0][0];

            const moderations = assignmentGroup[latestAssignment];

            const { data: users, error: userError } = await supabase
                .from("users")
                .select("user_id")
                .eq("is_admin", false)
                .eq("current_marker", true);

            if (userError) throw userError;

            const activeMarkers = users.map((u) => u.user_id);
            const activeTotal = activeMarkers.length;

            const moderationIds = moderations.map((m) => m.id);
            const { data: marks, error: marksError } = await supabase
                .from("marks")
                .select("marker_id, moderation_id, submitted_at")
                .in("marker_id", activeMarkers)
                .in("moderation_id", moderationIds);

            if (marksError) throw marksError;

            const results = moderations.map((mod) => {
                let totalScore = 0;
                let maxScore = 0;

                try {
                    if (mod.admin_feedback) {
                        const feedback =
                            typeof mod.admin_feedback === "string"
                                ? JSON.parse(mod.admin_feedback)
                                : mod.admin_feedback;

                        if (feedback?.criteria && Array.isArray(feedback.criteria)) {
                            feedback.criteria.forEach((c) => {
                                const [scorePart, maxPart] = (c?.admin_score || "")
                                    .split("/")
                                    .map((s) => s.trim());
                                const score = parseFloat(scorePart);
                                const max = parseFloat(maxPart);
                                totalScore += Number.isFinite(score) ? score : 0;
                                maxScore += Number.isFinite(max) ? max : 0;
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`error parsing admin_feedback`, error);
                }

                const submitted = marks.filter(
                    (m) => m.moderation_id === mod.id && m.submitted_at
                ).length;

                return {
                    id: mod.id,
                    name: mod.name,
                    semester: mod.semester,
                    year: mod.year,
                    due_date: mod.due_date,
                    submitted,
                    activeTotal,
                    totalScore,
                    maxScore,
                };
            });

            res.json({
                assignment_name: latestAssignment,
                semester: recentSem,
                year: recentYear,
                results,
            });
        } catch (err) {
            console.log("Error fetching latest progress", err);
            res.status(500).json({ error: "failed fetching latest progress" });
        }
    });

    // fetching statistics
    router.get("/moderations/stats/assignment", async (req, res) => {
        try {
            const { data: moderation, error: modError } = await supabase
                .from("moderations")
                .select("id, name, assignment_number, year, semester, due_date, admin_feedback")
                .order("year", { ascending: false })
                .order("semester", { ascending: false })
                .order("due_date", { ascending: false });

            if (modError) throw modError;

            const recentYear = moderation[0].year;
            const recentSem = moderation[0].semester;
            const recentAssignment = moderation[0].assignment_number;

            const assignmentSameSem = moderation.filter(
                (m) =>
                    m.year === recentYear &&
                    m.semester === recentSem &&
                    m.assignment_number === recentAssignment
            );

            assignmentSameSem.sort(
                (a, b) => new Date(a.due_date) - new Date(b.due_date)
            );

            const { data: users, error: userError } = await supabase
                .from("users")
                .select("user_id, first_name, last_name")
                .eq("is_admin", false)
                .eq("current_marker", true);

            if (userError) throw userError;

            const moderationStats = [];

            for (const mod of assignmentSameSem) {
                const { data: stats, error: statsError } = await supabase
                    .from("moderation_stats")
                    .select(
                        "moderation_id, marker_id, criterion, max_points, unit_chair_marks, range_lower, range_upper, marker_mark"
                    )
                    .eq("moderation_id", mod.id);

                if (statsError) throw statsError;

                if (!stats || stats.length === 0) {
                    let criteria = [];
                    let adminScores = [];

                    try {
                        if (mod.admin_feedback) {
                            const feedback =
                                typeof mod.admin_feedback === "string"
                                    ? JSON.parse(mod.admin_feedback)
                                    : mod.admin_feedback;

                            if (feedback?.criteria && Array.isArray(feedback.criteria)) {
                                criteria = feedback.criteria.map((c) => c.criterion);
                                adminScores = feedback.criteria.map((c) => {
                                    const raw =
                                        c && typeof c.admin_score === "string"
                                            ? c.admin_score
                                            : "0 / 0";
                                    const [scorePart] = raw
                                        .split("/")
                                        .map((s) => s.trim());
                                    const score = parseFloat(scorePart);
                                    return Number.isFinite(score) ? score : 0;
                                });
                            }
                        }
                    } catch (error) {
                        console.warn(`error parsing admin_feedback`, error);
                    }

                    const adminTotal = adminScores.reduce((a, b) => a + b, 0);
                    const lowerBoundScores = adminScores.map((s) =>
                        +(s * 0.95).toFixed(2)
                    );
                    const upperBoundScores = adminScores.map((s) =>
                        +(s * 1.05).toFixed(2)
                    );
                    const lowerTotal = lowerBoundScores
                        .reduce((a, b) => a + b, 0)
                        .toFixed(2);
                    const upperTotal = upperBoundScores
                        .reduce((a, b) => a + b, 0)
                        .toFixed(2);

                    const rows = [
                        { label: "Unit Chair Marks", scores: adminScores, total: adminTotal },
                        { label: "5% Lower Range", scores: lowerBoundScores, total: lowerTotal },
                        { label: "5% Upper Range", scores: upperBoundScores, total: upperTotal },
                    ];

                    for (const user of users) {
                        const name = user.first_name
                            ? `${user.first_name} ${user.last_name}`.trim()
                            : `Marker ${user.user_id}`;

                        rows.push({
                            label: name,
                            scores: Array(criteria.length).fill("-"),
                            total: "-",
                        });
                    }

                    moderationStats.push({
                        id: mod.id,
                        moderationName: mod.name,
                        criteria,
                        rows,
                    });

                    continue;
                }

                const criteria = [...new Set(stats.map((s) => s.criterion))];

                const adminScores = criteria.map((c) => {
                    const row = stats.find(
                        (s) => s.criterion === c && s.unit_chair_marks != null
                    );
                    return row ? parseFloat(row.unit_chair_marks) : 0;
                });
                const adminTotal = adminScores.reduce((a, b) => a + b, 0);

                const lowerBound = criteria.map((c) => {
                    const row = stats.find((s) => s.criterion === c);
                    return row ? parseFloat(row.range_lower) : 0;
                });

                const upperBound = criteria.map((c) => {
                    const row = stats.find((s) => s.criterion === c);
                    return row ? parseFloat(row.range_upper) : 0;
                });

                const lowerTotal = lowerBound
                    .reduce((a, b) => a + b, 0)
                    .toFixed(2);
                const upperTotal = upperBound
                    .reduce((a, b) => a + b, 0)
                    .toFixed(2);

                const rows = [
                    { label: "Unit Chair Marks", scores: adminScores, total: adminTotal },
                    { label: "5% Lower Range", scores: lowerBound, total: lowerTotal },
                    { label: "5% Upper Range", scores: upperBound, total: upperTotal },
                ];

                for (const user of users) {
                    const name = user.first_name
                        ? `${user.first_name} ${user.last_name}`.trim()
                        : `Marker ${user.user_id}`;

                    const userScores = criteria.map((c) => {
                        const record = stats.find(
                            (s) => s.criterion === c && s.marker_id === user.user_id
                        );
                        return record && record.marker_mark != null
                            ? parseFloat(record.marker_mark)
                            : "-";
                    });

                    const total =
                        userScores.every((v) => v === "-")
                            ? "-"
                            : userScores.reduce(
                                (sum, v) => (v !== "-" ? sum + parseFloat(v) : sum),
                                0
                            );

                    rows.push({
                        label: name,
                        scores: userScores,
                        total,
                        user_id: user.user_id,
                    });
                }

                moderationStats.push({
                    id: mod.id,
                    moderationName: mod.name,
                    criteria,
                    rows,
                });
            }

            res.json({
                assignment_name: recentAssignment,
                semester: recentSem,
                year: recentYear,
                moderations: moderationStats,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "failed fetching moderation stats" });
        }
    });

    // fetch moderation to the marker's front page
    router.get("/marker/recent", async (req, res) => {
        try {
            const userId = req.user?.id;

            const { data: moderations, error: modError } = await supabase
                .from("moderations")
                .select("id, name, assignment_number, year, semester, due_date, admin_feedback")
                .order("year", { ascending: false })
                .order("semester", { ascending: false })
                .order("due_date", { ascending: false });

            if (modError) throw modError;
            if (!moderations?.length) return res.json({ results: [] });

            const recentYear = moderations[0].year;
            const recentSem = moderations[0].semester;
            const recentAssignment = moderations[0].assignment_number;

            const assignmentSameSem = moderations.filter(
                (m) =>
                    m.year === recentYear &&
                    m.semester === recentSem &&
                    m.assignment_number === recentAssignment
            );

            assignmentSameSem.sort(
                (a, b) => new Date(a.due_date) - new Date(b.due_date)
            );

            const moderationIds = assignmentSameSem.map((m) => m.id);

            const { data: marks, error: marksError } = await supabase
                .from("marks")
                .select("*")
                .eq("marker_id", userId)
                .in("moderation_id", moderationIds);

            if (marksError) throw marksError;

            const result = assignmentSameSem.map((mod) => {
                const record = marks.find((m) => m.moderation_id === mod.id);

                let totalScore = 0;
                try {
                    if (mod.admin_feedback) {
                        const feedback =
                            typeof mod.admin_feedback === "string"
                                ? JSON.parse(mod.admin_feedback)
                                : mod.admin_feedback;

                        if (feedback?.criteria && Array.isArray(feedback.criteria)) {
                            totalScore = feedback.criteria.reduce((sum, c) => {
                                const [, maxPart] = (c?.admin_score || "")
                                    .split("/")
                                    .map((s) => s.trim());
                                const max = parseFloat(maxPart);
                                return sum + (Number.isFinite(max) ? max : 0);
                            }, 0);
                        }
                    }
                } catch (error) {
                    console.warn("error parsing admin_feedback", error);
                }

                let markerScore = "-";
                if (record?.scores) {
                    try {
                        const parsedScores =
                            typeof record.scores === "string"
                                ? JSON.parse(record.scores)
                                : record.scores;

                        const numericScores = parsedScores.map((s) => {
                            const [numPart] = (s?.score || "")
                                .split("/")
                                .map((t) => t.trim());
                            const val = parseFloat(numPart);
                            return Number.isFinite(val) ? val : 0;
                        });

                        markerScore = numericScores
                            .reduce((a, b) => a + b, 0)
                            .toFixed(2);
                    } catch (error) {
                        console.warn("error parsing marker scores", error);
                    }
                }

                return {
                    id: mod.id,
                    name: mod.name,
                    due_date: mod.due_date,
                    submitted_at: record?.submitted_at || "-",
                    score_progress:
                        markerScore === "-" ? `- / ${totalScore}` : `${markerScore} / ${totalScore}`,
                };
            });

            res.json({
                assignment_name: recentAssignment,
                semester: recentSem,
                year: recentYear,
                result,
            });
        } catch (err) {
            console.error("error fetching current markings", err);
            res.status(500).json({ error: "failed fetching current markings" });
        }
    });

    // fetching marker's stats
    router.get("/marker/stats/assignment", async (req, res) => {
        try {
            const userId = req.user?.id;

            const { data: moderation, error: modError } = await supabase
                .from("moderations")
                .select("id, name, assignment_number, year, semester, due_date, admin_feedback")
                .order("year", { ascending: false })
                .order("semester", { ascending: false })
                .order("due_date", { ascending: false });

            if (modError) throw modError;

            const recentYear = moderation[0].year;
            const recentSem = moderation[0].semester;
            const recentAssignment = moderation[0].assignment_number;

            const assignmentSameSem = moderation.filter(
                (m) =>
                    m.year === recentYear &&
                    m.semester === recentSem &&
                    m.assignment_number === recentAssignment
            );

            assignmentSameSem.sort(
                (a, b) => new Date(a.due_date) - new Date(b.due_date)
            );

            const moderationIds = assignmentSameSem.map((m) => m.id);

            const { data: stats, error: statsError } = await supabase
                .from("moderation_stats")
                .select(
                    "moderation_id, marker_id, criterion, max_points, unit_chair_marks, range_lower, range_upper, marker_mark"
                )
                .in("moderation_id", moderationIds);

            if (statsError) throw statsError;

            const groupedStats = {};
            for (const s of stats || []) {
                if (!groupedStats[s.moderation_id]) groupedStats[s.moderation_id] = [];
                groupedStats[s.moderation_id].push(s);
            }

            const moderationStats = assignmentSameSem.map((mod) => {
                const modStats = groupedStats[mod.id] || [];
                const criteria = [...new Set(modStats.map((s) => s.criterion))];

                const adminScores = criteria.map((c) => {
                    const row = modStats.find(
                        (s) => s.criterion === c && s.unit_chair_marks != null
                    );
                    return row ? parseFloat(row.unit_chair_marks) : 0;
                });
                const adminTotal = adminScores
                    .reduce((a, b) => a + b, 0)
                    .toFixed(2);

                const lowerBound = criteria.map((c) => {
                    const row = modStats.find((s) => s.criterion === c);
                    return row ? parseFloat(row.range_lower) : 0;
                });

                const upperBound = criteria.map((c) => {
                    const row = modStats.find((s) => s.criterion === c);
                    return row ? parseFloat(row.range_upper) : 0;
                });

                const lowerTotal = lowerBound
                    .reduce((a, b) => a + b, 0)
                    .toFixed(2);
                const upperTotal = upperBound
                    .reduce((a, b) => a + b, 0)
                    .toFixed(2);

                const markerScores = criteria.map((c) => {
                    const row = modStats.find(
                        (s) =>
                            s.criterion === c && Number(s.marker_id) === Number(userId)
                    );
                    return row && row.marker_mark != null
                        ? parseFloat(row.marker_mark)
                        : "-";
                });

                const markerTotal =
                    markerScores.every((v) => v === "-")
                        ? "-"
                        : markerScores
                            .reduce(
                                (sum, v) => (v !== "-" ? sum + parseFloat(v) : sum),
                                0
                            )
                            .toFixed(2);

                const hasMarked = markerScores.some((v) => v !== "-");

                const rows = hasMarked
                    ? [
                        { label: "Unit Chair Marks", scores: adminScores, total: adminTotal },
                        { label: "5% Lower Range", scores: lowerBound, total: lowerTotal },
                        { label: "5% Upper Range", scores: upperBound, total: upperTotal },
                        { label: "Your Marks", scores: markerScores, total: markerTotal },
                    ]
                    : [];

                return {
                    id: mod.id,
                    moderationName: mod.name,
                    criteria,
                    rows,
                    hasMarked,
                };
            });

            res.json({
                assignment_name: recentAssignment,
                semester: recentSem,
                year: recentYear,
                moderations: moderationStats,
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "failed fetching marker stats" });
        }
    });

    // fetching moderation
    router.get("/moderations/:id", async (req, res) => {
        const { id } = req.params;
        const markerId = req.query.marker_id || req.user?.id;

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

        const { data: marks } = await supabase
            .from("marks")
            .select("*")
            .eq("moderation_id", id)
            .eq("marker_id", markerId)
            .maybeSingle();

        data.marks = marks || null;

        res.json(data);
    });

    // saving marker's marks
    router.post("/marks", async (req, res) => {
        try {
            const {
                moderation_id,
                marker_id,
                scores,
                comments,
                total_score,
                submitted_at,
            } = req.body;

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

            // normalise admin_feedback and rubric_json
            let adminFeedback = moderationData.admin_feedback;
            try {
                if (typeof adminFeedback === "string") {
                    adminFeedback = JSON.parse(adminFeedback);
                }
            } catch (e) {
                console.warn("error parsing moderation admin_feedback", e);
                adminFeedback = {};
            }

            let rubric = moderationData.rubric_json;
            try {
                if (typeof rubric === "string") {
                    rubric = JSON.parse(rubric);
                }
            } catch (e) {
                console.warn("error parsing moderation rubric_json", e);
                rubric = {};
            }

            const adminCriteria = Array.isArray(adminFeedback?.criteria)
                ? adminFeedback.criteria
                : [];
            const rubricCriteria = Array.isArray(rubric?.criteria)
                ? rubric.criteria
                : [];

            // normalise marker scores
            let markerScores = markData.scores || [];
            try {
                if (typeof markerScores === "string") {
                    markerScores = JSON.parse(markerScores);
                }
            } catch (e) {
                console.warn("error parsing markData.scores", e);
                markerScores = [];
            }

            const criteriaStats = adminCriteria.map((criterion, index) => {
                const adminScoreStr =
                    criterion && typeof criterion.admin_score === "string"
                        ? criterion.admin_score
                        : "0 / 0";

                const [adminScoreRaw, adminOutOfRaw] = adminScoreStr
                    .split(" / ")
                    .map((s) => s.trim());

                const adminScore = parseFloat(adminScoreRaw);
                const adminOutOf = parseFloat(adminOutOfRaw);

                const markerScoreStr = markerScores[index]?.score || "0 / 0";
                const [markerScoreRaw, markerOutOfRaw] = markerScoreStr
                    .split(" / ")
                    .map((s) => s.trim());

                const markerScore = parseFloat(markerScoreRaw);
                const markerOutOf = parseFloat(markerOutOfRaw);

                const safeAdminScore = Number.isFinite(adminScore) ? adminScore : 0;
                const safeAdminOutOf = Number.isFinite(adminOutOf) ? adminOutOf : 0;
                const safeMarkerScore = Number.isFinite(markerScore)
                    ? markerScore
                    : 0;
                const safeMarkerOutOf = Number.isFinite(markerOutOf)
                    ? markerOutOf
                    : 0;

                const maxPoints =
                    rubricCriteria[index]?.maxPoints ||
                    safeAdminOutOf ||
                    safeMarkerOutOf ||
                    0;

                const adminPercentVal =
                    maxPoints > 0 ? (safeAdminScore / maxPoints) * 100 : 0;
                const markerPercentVal =
                    maxPoints > 0 ? (safeMarkerScore / maxPoints) * 100 : 0;
                const diffPercentVal = adminPercentVal - markerPercentVal;

                return {
                    moderation_id,
                    marker_id,
                    criterion: criterion.criterion,
                    max_points: maxPoints,
                    unit_chair_marks: safeAdminScore,
                    range_lower: (safeAdminScore - maxPoints * 0.05).toFixed(2),
                    range_upper: (safeAdminScore + maxPoints * 0.05).toFixed(2),
                    marker_mark: safeMarkerScore,
                    unit_chair_pct: adminPercentVal.toFixed(2),
                    marker_pct: markerPercentVal.toFixed(2),
                    difference_pct: diffPercentVal.toFixed(2),
                };
            });

            await supabase
                .from("moderation_stats")
                .delete()
                .eq("moderation_id", moderation_id)
                .eq("marker_id", marker_id);

            const { error: statsError } = await supabase
                .from("moderation_stats")
                .insert(criteriaStats);
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
            res.status(500).json({ error: "Failed to save stats" });
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
                return res.status(404).json({ error: "Moderation not found" });
            }

            if (markError) {
                console.error(markError);
                return res
                    .status(404)
                    .json({ error: "Marks not found for this marker" });
            }

            // normalise admin_feedback and rubric_json
            let adminFeedback = moderationData.admin_feedback;
            try {
                if (typeof adminFeedback === "string") {
                    adminFeedback = JSON.parse(adminFeedback);
                }
            } catch (e) {
                console.warn("error parsing moderation admin_feedback", e);
                adminFeedback = {};
            }

            let rubric = moderationData.rubric_json;
            try {
                if (typeof rubric === "string") {
                    rubric = JSON.parse(rubric);
                }
            } catch (e) {
                console.warn("error parsing moderation rubric_json", e);
                rubric = {};
            }

            const adminCriteria = Array.isArray(adminFeedback?.criteria)
                ? adminFeedback.criteria
                : [];
            const rubricCriteria = Array.isArray(rubric?.criteria)
                ? rubric.criteria
                : [];

            // normalise marker scores
            let markerScores = markData.scores || [];
            try {
                if (typeof markerScores === "string") {
                    markerScores = JSON.parse(markerScores);
                }
            } catch (e) {
                console.warn("error parsing markData.scores", e);
                markerScores = [];
            }

            const criteriaStats = adminCriteria.map((criterion, index) => {
                const adminScoreStr =
                    criterion && typeof criterion.admin_score === "string"
                        ? criterion.admin_score
                        : "0 / 0";

                const [adminScoreRaw, adminOutOfRaw] = adminScoreStr
                    .split(" / ")
                    .map((s) => s.trim());

                const adminScore = parseFloat(adminScoreRaw);
                const adminOutOf = parseFloat(adminOutOfRaw);

                const markerScoreStr = markerScores[index]?.score || "0 / 0";
                const [markerScoreRaw, markerOutOfRaw] = markerScoreStr
                    .split(" / ")
                    .map((s) => s.trim());

                const markerScore = parseFloat(markerScoreRaw);
                const markerOutOf = parseFloat(markerOutOfRaw);

                const safeAdminScore = Number.isFinite(adminScore) ? adminScore : 0;
                const safeAdminOutOf = Number.isFinite(adminOutOf) ? adminOutOf : 0;
                const safeMarkerScore = Number.isFinite(markerScore)
                    ? markerScore
                    : 0;
                const safeMarkerOutOf = Number.isFinite(markerOutOf)
                    ? markerOutOf
                    : 0;

                const maxPoints =
                    rubricCriteria[index]?.maxPoints ||
                    safeAdminOutOf ||
                    safeMarkerOutOf ||
                    0;

                const adminPercentVal =
                    maxPoints > 0 ? (safeAdminScore / maxPoints) * 100 : 0;
                const markerPercentVal =
                    maxPoints > 0 ? (safeMarkerScore / maxPoints) * 100 : 0;
                const diffPercentVal = adminPercentVal - markerPercentVal;

                return {
                    criterion: criterion.criterion,
                    max_points: maxPoints,
                    admin_score: safeAdminScore,
                    admin_percent: adminPercentVal.toFixed(2),
                    lower: (safeAdminScore - maxPoints * 0.05).toFixed(2),
                    upper: (safeAdminScore + maxPoints * 0.05).toFixed(2),
                    marker_score: safeMarkerScore,
                    marker_percent: markerPercentVal.toFixed(2),
                    diff_percent: diffPercentVal.toFixed(2),
                };
            });

            res.json({ criteria: criteriaStats });
        } catch (error) {
            console.error(error);
            res.status(404).json({ error: "Failed to calculate stats" });
        }
    });

    return router;
}
