import express from "express"
import { computeModerationStats } from "../frontend/js/computeModerationStats.js";


export default function statisticsRoutes(supabase) {
    const router = express.Router()

    router.post("/calculate/:assignmentID", async (req, res) => {
        const id = parseInt(req.params.assignmentID)

        // Gets marks based on given assignmentID
        const {data, error} = await supabase
            .from("marks")
            .select("mark")
            .eq("assignmentID", id)

        let sum = 0
        let min = 0
        let max = 0 
        let totalNum = 0

        // Loops through data to find sum, min and max 
        for(let i = 0; i < data.length; i++){
            const mark = data[i].mark
            sum += score
            totalNum++
            
            if(mark > max){
                max = score
            }
            if(mark < min){
                min = score
            }
        }

        const mean = sum / totalNum

        // Calculates the numerator part of the variance formula 
        let numerator = 0
        for(let i = 0; i<data.length; i++){
            numerator += (data[i].mark - mean) * (data[i].mark - mean)
        }
        const variance = numerator / totalNum 
        const standardDeviation = Math.sqrt(variance)

        res.json({ mean, variance, standardDeviation, min, max})


    });

    router.get("/moderations/:id/stats", async (req, res) => {

        try {
            const {id} = req.params;

            const {data: moderation, error: modError} = await supabase
                .from("moderations")
                .select("id, name, assignment_number, year, semester, due_date, admin_feedback")
                .eq("id", id)
                .single();

            if (modError) throw modError;

            const {data: users, error: userError} = await supabase
                .from("users")
                .select("user_id, first_name, last_name")
                .eq("is_admin", false)
                .eq("current_marker", true);

            if (userError) throw userError;

            const stats = await computeModerationStats(supabase, moderation, users);
            const overallStats = computeOverallStats(stats.rows, stats.criteria);

            res.json({
                id: moderation.id,
                moderationName: moderation.name,
                criteria: stats.criteria,
                rows: stats.rows,
                overallStats,
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "failed to get moderation stats" });
        }

    })


    function computeOverallStats(rows, criteria) {

        const markerRows = rows.filter((r) => r.user_id);
        if (markerRows.length === 0) return [];

        const noMarks = markerRows.every((r) =>
            r.scores.every((s) => s === "-" || s === null || s === undefined)
        );

        if (noMarks) return [];

        const overallStats = [];

        criteria.forEach((criterion, index) => {
            const scores = markerRows
                .map((r) => r.scores[index])
                .filter((v) => typeof v === "number" && !isNaN(v));

            if (scores.length === 0) return;

            const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
            const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
            const std = Math.sqrt(variance);
            const min = Math.min(...scores);
            const max = Math.max(...scores);

            overallStats.push({
                criterion,
                mean: +mean.toFixed(2),
                std: +std.toFixed(2),
                min: +min.toFixed(2),
                max: +max.toFixed(2),
            });
        });


        const totals = markerRows
            .map((r) => r.total)
            .filter((v) => typeof v === "number" && !isNaN(v));

        if (totals.length > 0) {
            const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
            const variance = totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length;
            const std = Math.sqrt(variance);


            overallStats.push({
                criterion: "Total",
                mean: +mean.toFixed(2),
                std: +std.toFixed(2),
                min: +Math.min(...totals).toFixed(2),
                max: +Math.max(...totals).toFixed(2),
            });
        }

        return overallStats;

    }



    return router
}