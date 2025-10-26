// Uses .xlsx npm package to read the spreadsheet
// Requires the xlsx to follow a fixed structure. Multiple sheets are allowed.

import * as XLSX from "xlsx";

export default async function parseXLSX(filePath) {
  // Not tested
  // No idea how the excel file looks like, cannot parse without that info

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length < 2) {
    throw new Error("Invalid rubric XLSX: not enough rows");
  }

  // First row = header
  const header = rows[0];
  const gradeNames = header.slice(1, header.length - 1); // skip first col (criterion) and last col (max points)

  const rubricJSON = {
    rubric: {
      rubricTitle: sheetName,
      xlsxFile: filePath.split("/").pop(),
    },
    criteria: [],
  };

  // Loop over each criterion row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const criterion = row[0];
    const maxPoints = Number(row[row.length - 1]) || 0;

    const criterionObj = {
      criterion,
      maxPoints,
      grades: [],
    };

    // Loop over grade columns
    for (let j = 0; j < gradeNames.length; j++) {
      const grade = gradeNames[j];
      const description = (row[j + 1] || "")
        .toString()
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      criterionObj.grades.push({
        grade,
        pointsRange: "", // XLSX may not have explicit ranges
        description,
      });
    }

    rubricJSON.criteria.push(criterionObj);
  }

  return rubricJSON;
}
