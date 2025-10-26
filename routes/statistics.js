import express from "express";

export default function statisticsRoutes(supabase) {
	const router = express.Router();

	router.post("/calculate/:assignmentID", async (req, res) => {
		const id = parseInt(req.params.assignmentID);

		// Gets marks based on given assignmentID
		const { data, error } = await supabase
			.from("marks")
			.select("mark")
			.eq("assignmentID", id);

		let sum = 0;
		let min = 0;
		let max = 0;
		let totalNum = 0;

		// Loops through data to find sum, min and max
		for (let i = 0; i < data.length; i++) {
			const mark = data[i].mark;
			sum += score;
			totalNum++;

			if (mark > max) {
				max = score;
			}
			if (mark < min) {
				min = score;
			}
		}

		const mean = sum / totalNum;

		// Calculates the numerator part of the variance formula
		let numerator = 0;
		for (let i = 0; i < data.length; i++) {
			numerator += (data[i].mark - mean) * (data[i].mark - mean);
		}
		const variance = numerator / totalNum;
		const standardDeviation = Math.sqrt(variance);

		res.json({ mean, variance, standardDeviation, min, max });
	});
	return router;
}
