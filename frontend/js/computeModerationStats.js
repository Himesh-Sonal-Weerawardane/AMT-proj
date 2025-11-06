

export async function computeModerationStats(supabase, moderation, users) {

    const { data: stats, error: statsError } = await supabase
        .from("moderation_stats")
        .select("moderation_id, marker_id, criterion, max_points, unit_chair_marks, range_lower, range_upper, marker_mark")
        .eq("moderation_id", moderation.id);


    if (statsError) throw statsError;


    let criteria = [];
    let rows = [];

    if (!stats || stats.length === 0) {

        let adminScores = [];

        try {
            if (moderation.admin_feedback) {
                const feedback =
                    typeof moderation.admin_feedback === "string"
                        ? JSON.parse(moderation.admin_feedback)
                        : moderation.admin_feedback;

                if (feedback.criteria && Array.isArray(feedback.criteria)) {
                    criteria = feedback.criteria.map((c) => c.criterion);
                    adminScores = feedback.criteria.map((c) => {
                        const [scorePart] = c.admin_score.split("/").map(s => s.trim());
                        return parseFloat(scorePart) || 0;
                    });
                }
            }
        } catch (error) {
            console.warn(`error parsing admin_feedback`, error);
        }

        const adminTotal = adminScores.reduce((a, b) => a + b, 0);
        const lowerBoundScores = adminScores.map((s) => +(s * 0.95).toFixed(2));
        const upperBoundScores = adminScores.map((s) => +(s * 1.05).toFixed(2));
        const lowerTotal = lowerBoundScores.reduce((a, b) => a + b, 0).toFixed(2);
        const upperTotal = upperBoundScores.reduce((a, b) => a + b, 0).toFixed(2);

         rows = [
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

    } else {
        criteria = [...new Set(stats.map(s => s.criterion))];

        const adminScores = criteria.map(c => {
            const row = stats.find(s => s.criterion === c && s.unit_chair_marks != null);
            return row ? parseFloat(row.unit_chair_marks) : 0;
        });
        const adminTotal = adminScores.reduce((a, b) => a + b, 0);

        const lowerBound = criteria.map(c => {
            const row = stats.find(s => s.criterion === c);
            return row ? parseFloat(row.range_lower) : 0;
        });

        const upperBound = criteria.map(c => {
            const row = stats.find(s => s.criterion === c);
            return row ? parseFloat(row.range_upper) : 0;
        });

        const lowerTotal = lowerBound.reduce((a, b) => a + b, 0).toFixed(2);
        const upperTotal = upperBound.reduce((a, b) => a + b, 0).toFixed(2);

         rows = [
            { label: "Unit Chair Marks", scores: adminScores, total: adminTotal },
            { label: "5% Lower Range", scores: lowerBound, total: lowerTotal },
            { label: "5% Upper Range", scores: upperBound, total: upperTotal },
        ];

        for (const user of users) {
            const name = user.first_name
                ? `${user.first_name} ${user.last_name}`.trim()
                : `Marker ${user.user_id}`;

            const userScores = criteria.map(c => {
                const record = stats.find(
                    s => s.criterion === c && s.marker_id === user.user_id
                );
                return record && record.marker_mark != null
                    ? parseFloat(record.marker_mark)
                    : "-";
            });

            const total =
                userScores.every(v => v === "-")
                    ? "-"
                    : userScores.reduce(
                        (sum, v) => (v !== "-" ? sum + parseFloat(v) : sum), 0
                    );

            rows.push({
                label: name,
                scores: userScores,
                total,
                user_id: user.user_id,
            });

        }
    }

    return {
        id: moderation.id,
        moderationName: moderation.name,
        criteria,
        rows,
    };


}


export async function updateRubric(rubric) {
    if (!rubric.criteria) return rubric;

    rubric.criteria.forEach((criterion) => {
        criterion.maxPoints = Number(criterion.maxPoints) || 0;

        (criterion.grades || []).forEach(g => {

            if (typeof g.description === "string") {
                let parts = g.description
                    .split(/\n{2,}/)
                    .map(s => s.trim())
                    .filter(Boolean);

                const last = parts[parts.length - 1];
                if (!g.pointsRange && /\d/.test(last) && last.includes("point")) {
                    g.pointsRange = last;
                    parts.pop();
                }

                g.description = parts;
            }

            g.pointsRange = g.pointsRange || "";
        });
    });

    return rubric;
}