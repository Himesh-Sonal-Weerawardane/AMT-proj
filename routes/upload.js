import express from "express";
import multer from "multer";
import fs from "fs";
import parseDOCX from './parse.js';

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

            // Module does not exist, can create module
            // Parse the rubric file (docx)
            let rubricJSON = {};
            parseDOCX({
                file: rubricFile.path
            }).then(({ title, tables}) => {
                // Parse depending on docx or pdf
                const rubricJson = transformTableToRubric(tables, title, rubricFile);

                if (!rubricJson) {
                    console.log("Could not parse the rubric");
                    return res.json({ error: "Could not parse the Rubric" });
                } else {
                    console.log("Rubric succesfully parsed!");
                    rubricJSON = rubricJson;
                    // console.log(JSON.stringify(rubricJSON, null, 3));
                }
            }).catch((error) => {
                console.error(error);
                return res.json({ error });
            })

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