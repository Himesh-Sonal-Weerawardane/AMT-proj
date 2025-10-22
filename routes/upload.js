import express from "express";
import multer from "multer";
import fs from "fs";
import parseDOCX from './parse.js';

// Required Imports
import path from "path"; // Used for file type filtering

import * as XLSX from "xlsx";
import path from "path";
import util from "util";
import libre from "libreoffice-convert";
import pdf from "pdf-parse";

const upload = multer({ dest: "uploads/" }); // temp folder

export default function uploadRoutes(supabase) {
    const router = express.Router();

    // Upload and publish a module
    router.post("/upload_module", upload.fields([
        { name: "assignment" },
        { name: "rubric" }
    ]), async (req, res) => {
        try {
            // Get token from cookie
            const token = req.cookies?.supabase_session;
            if (!token) {
                return res.json({ error: "Not logged in" });
            }

            // Get user from Supabase
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError || !user) {
                return res.json({ error: "Invalid session" });
            }

            // Get user_id from database
            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("user_id")
                .eq("auth_id", user.id)
                .single();
            if (userError || !userData) {
                return res.json({ error: "Access denied" });
            }

            // Module to be created
            const { year, semester, assignment_num, moderation_num, name, deadline_date, description } = req.body

            // Check if the data (year and deadline_date) is valid

            // Assignment and Rubric files
            const assignmentFile = req.files.assignment?.[0];
            const rubricFile = req.files.rubric?.[0];
            if (!assignmentFile) return res.json({ error: "Assignment file required" });
            if (!rubricFile) return res.json({ error: "Rubric file required" });

            // Check if this module does not already exist
            const { data: moderationData, error: moderationError } = await supabase
                .from("moderations")
                .select("moderation_id")
                .eq("year", year)
                .eq("semester", semester)
                .eq("assignment_num", assignment_num)
                .eq("moderation_num", moderation_num)

            if (moderationError) {
                return res.json({ error: "Error trying to access the database" });
            }

            if (moderationData.length > 0) {
                return res.json({ error: "This module already exists" })
            }

            // Added the file parsing here.
            let rubricJSON = {};

            if (req.body.rubric) {
                // Manual JSON entry
                console.log("Manual rubric entry begins...");
                rubricJSON = JSON.parse(req.body.rubric);
                console.log("Manual rubric entry completed!");
            } else if (rubricFile) {
                console.log("Automated rubric parsing begins...");
                const ext = path.extname(rubricFile.originalname).toLowerCase();
                try {
                    if (ext === ".docx") {
                        console.log("DOCX parsing started...");
                        const { title, tables } = await parseDOCX({ file: rubricFile.path });
                        rubricJSON = transformTableToRubric(tables, title, rubricFile);
                        console.log("DOCX parsing completed!");

                    } else if (ext === ".doc") {
                        // Convert .doc to .docx and, re-use the parse.
                        try {
                            rubricJSON = await parseDOC(rubricFile.path);
                        } catch (err) {
                            return res.json({ error: "DOC parsing failed" });
                        }

                    } else if (ext === ".pdf") {
                        // Adapted from: https://www.npmjs.com/package/pdf-parse 
                        rubricJSON = parsePDF(rubricFile.path);

                    } else if (ext === ".xlsx") {
                        // Uses .xlsx npm package to read the spreadsheet
                        // Requires the xlsx to follow a fixed structure. Multiple sheets are allowed.
                        rubricJSON = await parseXLSX(rubricFile.path);

                    } else {
                        return res.json({ error: "Unsupported rubric file type" });
                    }

                    if (!rubricJSON) return res.json({ error: "Could not parse rubric" });

                } catch (err) {
                    console.error(err);
                    return res.json({ error: "Rubric parsing failed" });
                }
                console.log("Automated rubric parsing completed!");
            } else {
                return res.json({ error: "Rubric required (file or manual entry)" });
            }

            // Module does not exist, can create module
            // Parse the rubric file (docx)
            // let rubricJSON = {};
            // parseDOCX({
            //     file: rubricFile.path
            // }).then(({ title, tables}) => {
            //     // Parse depending on docx or pdf
            //     const rubricJson = transformTableToRubric(tables, title, rubricFile);

            //     if (!rubricJson) {
            //         console.log("Could not parse the rubric");
            //         return res.json({ error: "Could not parse the Rubric" });
            //     } else {
            //         console.log("Rubric succesfully parsed!");
            //         rubricJSON = rubricJson;
            //         // console.log(JSON.stringify(rubricJSON, null, 3));
            //     }
            // }).catch((error) => {
            //     console.error(error);
            //     return res.json({ error });
            // })

            // or Parse the rubric file (pdf)

            // Upload assignment to storage bucket
            const assignmentPath = `assignments/${year}/${assignmentFile.originalname}`;
            if (assignmentFile) {
                const fileBuffer = fs.readFileSync(assignmentFile.path);
                const { data, error } = await supabase.storage
                    .from("comp30022-amt")
                    .upload(assignmentPath, fileBuffer, {
                        contentType: assignmentFile.mimetype,
                        upsert: true
                    });
                if (error) throw error;
            }

            // NOTE: NOT TESTED
            // To download the file, you would do this:
            // const { data, error } = await supabase.storage
            //     .from('comp30022-amt')
            //     .download('assignments/${year}/${assignmentFile.originalname}')
            // if (error) throw error;

            // Upload rubric to storage bucket
            const rubricPath = `rubrics/${year}/${rubricFile.originalname}`;
            if (rubricFile) {
                const fileBuffer = fs.readFileSync(rubricFile.path);
                const { data, error } = await supabase.storage
                    .from("comp30022-amt")
                    .upload(rubricPath, fileBuffer, {
                        contentType: rubricFile.mimetype,
                        upsert: true
                    });
                if (error) throw error;
            }

            console.log("Trying to insert in database...")

            // Store in database
            const { data, error } = await supabase
                .from("moderations")
                .insert([{
                    name,
                    year,
                    semester,
                    assignment_num,
                    moderation_num,
                    deadline_date,
                    description,
                    assignment_path: assignmentPath,
                    rubric_path: rubricPath,
                    rubric: rubricJSON,
                    upload_date: new Date().toISOString(),
                    admin_id: userData.user_id
            }]);

            if (error) {
                console.log("Failed to insert in database!")
                console.error("Failed to insert module, files may have been uploaded:", error);
                return res.json({ error: error.message });
            }

            // Redirect to Assignment Modules Front Page
            console.log("Succesfully created new module!");
            res.json({ success: true, redirect: "/admin/moderation-frontpage.html" });

        } catch (err) {
            console.error("Failed to insert module:", err);
            res.json({ error: "Server error" });
        }
  })

  return router
}


// import * as XLSX from "xlsx";

export async function parseXLSX(filePath) {
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
      xlsxFile: filePath.split("/").pop()
    },
    criteria: []
  };

  // Loop over each criterion row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const criterion = row[0];
    const maxPoints = Number(row[row.length - 1]) || 0;

    const criterionObj = {
      criterion,
      maxPoints,
      grades: []
    };

    // Loop over grade columns
    for (let j = 0; j < gradeNames.length; j++) {
      const grade = gradeNames[j];
      const description = (row[j + 1] || "").toString().split("\n").map(l => l.trim()).filter(Boolean);

      criterionObj.grades.push({
        grade,
        pointsRange: "", // XLSX may not have explicit ranges
        description
      });
    }

    rubricJSON.criteria.push(criterionObj);
  }

  return rubricJSON;
}


// import fs from "fs";
// import path from "path";
// import util from "util";
// import libre from "libreoffice-convert";

libre.convertAsync = util.promisify(libre.convert);

/**
 * Convert a .doc file to .docx and parse it into rubric JSON
 * @param {string} inputPath - Path to the uploaded .doc file
 * @returns {Promise<Object>} rubricJSON
 */
export async function parseDOC(inputPath) {
  try {
    // Output path: same folder, with .converted.docx suffix
    const outputPath = inputPath + ".converted.docx";

    // Read, convert, and write the DOCX
    const docBuf = await fs.promises.readFile(inputPath);
    const docxBuf = await libre.convertAsync(docBuf, ".docx", undefined);
    await fs.promises.writeFile(outputPath, docxBuf);
    console.log("DOC converted to DOCX successfully!");

    // Parse the converted DOCX
    const { title, tables } = await parseDOCX({ file: outputPath });
    const rubricJSON = transformTableToRubric(tables, title, {
      originalname: path.basename(outputPath),
    });

    return rubricJSON;
  } catch (err) {
    console.error("Error converting/parsing DOC:", err);
    throw err;
  }
}


// import fs from "fs";
// import pdf from "pdf-parse";

/**
 * Parse a rubric PDF into JSON structure
 * @param {string} filePath - Path to the uploaded PDF file
 * @returns {Promise<Object>} rubricJSON
 */
export default async function parsePDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);

    // Extract raw text
    const text = data.text;
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

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
          grades: []
        };
      } else if (/^\(.*\)$/.test(line)) {
        // Points range in parentheses, e.g. "(8-10)"
        if (currentCriterion) {
          currentCriterion.grades.push({
            grade: "Unknown",
            pointsRange: line,
            description: []
          });
        }
      } else {
        // Treat as description text
        if (currentCriterion && currentCriterion.grades.length > 0) {
          currentCriterion.grades[currentCriterion.grades.length - 1].description.push(line);
        }
      }
    }
    if (currentCriterion) criteria.push(currentCriterion);
        return {
            rubric: {
                rubricTitle,
                pdfFile: filePath.split("/").pop()
            },
            criteria
        };
    } catch (err) {
        console.error("Error parsing PDF rubric:", err);
        throw err;
    }
}


// Transform the rubric into a JSON file
function transformTableToRubric(tableData, rubricTitle, rubricFile) {
    const rubricJSON = {
        rubric: {
            rubricTitle: rubricTitle,
            pdfFile: rubricFile.originalname
        },
        criteria: []
    }

    const gradesOrder = []
    // Loop through grade columns (columns 1 to 5)
    // Loop through grade columns (columns 1 to 5)
    for (let i = 1; i <= 5; i++) {
        const gradeName = tableData[0][i]?.data?.trim();
        if (gradeName) {
            gradesOrder.push(gradeName);
        }
    }

    // Loop over rows (skip row 0 - this is the header)
    for (let i = 1; i < Object.keys(tableData[0]).length; i++) {
        const row = tableData[0][i]; // row is an array of cells
        const criterionCell = row[0]?.data.trim(); // first column
        const maxPointsCell = row[6]?.data.trim(); // last column

        const criterionObj = {
            criterion: criterionCell,
            // Extract only digits and decimal points from the string.
            // Convert the cleaned string to a number.
            // Default to 0 if parsing fails.
            maxPoints: Number(maxPointsCell.replace(/[^0-9.]/g, "")) || 0,
            grades: []
        };

        // Loop through grade columns (columns 1 to 5)
        for (let colIndex = 1; colIndex <= 5; colIndex++) {
            // Remove leading/trailing whitespace.
            // Default to empty string if any values are undefined or null.
            const cellData = row[colIndex]?.data?.trim() || "";
            // Split the string into an array or lines.
            // Remove leading/trailing whitespace.
            // Remove any empty lines.
            const lines = cellData.split("\n").map(l => l.trim()).filter(l => l);

            // Separate points range from description if included.
            let pointsRange = "";

            // Remove the first line - max points in description.
            lines.shift(); 

            const lastLine = lines[lines.length - 1] || "";
            // \(...\) Match parentheses.
            // ([^)]+) Match everything inside parentheses that are not parentheses
            const pointsMatch = lastLine.match(/\(([^)]+)\)/);
            if (pointsMatch) {
                pointsRange = pointsMatch[0];
                lines.pop(); // remove last line - points range from description
            }

            const gradeObj = {
                grade: gradesOrder[colIndex - 1],
                pointsRange,
                description: lines
            };

            criterionObj.grades.push(gradeObj);
        }

        rubricJSON.criteria.push(criterionObj);
    }

    return rubricJSON;
}