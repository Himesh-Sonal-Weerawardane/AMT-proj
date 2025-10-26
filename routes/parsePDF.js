// Adapted from: https://www.npmjs.com/package/pdf-parse

import fs from "fs";
import { PDFParse } from "pdf-parse";

/**
 * Parse a rubric PDF into JSON structure
 * @param {string} filePath - Path to the uploaded PDF file
 * @returns {Promise<Object>} rubricJSON
 */
export default async function parsePDF(filePath) {
	try {
		const dataBuffer = fs.readFileSync(filePath);
		const parser = new PDFParse({ data: new Uint8Array(dataBuffer) });
		const data = await parser.getText();
		await parser.destroy();

		// Extract raw text
		const text = data.text;
		// console.log(text);

		const lines = text
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		// console.log("\n\n=======================Lines are:\n", lines);

		// First line = rubric title
		const rubricTitle = lines[0] || "Recommended Rubric";

		// Assumes criteria are separated by blank lines or keywords / can change based on pdf structure.
		const criteria = [];
		let currentCriterion = null;

		for (let line of lines.slice(1)) {
			// Example: detect criterion headers by "Criterion:" or numbering
			if (/^Criterion/i.test(line) || /^\d+\./.test(line)) {
				if (currentCriterion) criteria.push(currentCriterion);
				currentCriterion = {
					criterion: line.replace(/^Criterion[:\s]*/i, ""),
					maxPoints: 0,
					grades: [],
				};
			} else if (/^\(.*\)$/.test(line)) {
				// Points range in parentheses, e.g. "(8-10)"
				if (currentCriterion) {
					currentCriterion.grades.push({
						grade: "Unknown",
						pointsRange: line,
						description: [],
					});
				}
			} else {
				// Treat as description text
				if (currentCriterion && currentCriterion.grades.length > 0) {
					currentCriterion.grades[
						currentCriterion.grades.length - 1
					].description.push(line);
				}
			}
		}

		// =============================================================
		// This does not work.
		console.log(JSON.stringify(currentCriterion, null, 2));
		return;

		if (currentCriterion) criteria.push(currentCriterion);
		return {
			rubric: {
				rubricTitle,
				pdfFile: filePath.split("/").pop(),
			},
			criteria,
		};
	} catch (err) {
		console.error("Error parsing PDF rubric:", err);
		throw err;
	}
}
