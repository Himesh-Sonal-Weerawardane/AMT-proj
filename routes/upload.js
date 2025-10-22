import express from "express"
import multer from "multer"
import fs from "fs"
import mammoth from "mammoth" // for .docx -> text/html

const upload = multer({ dest: "uploads/" }) // temp folder

export default function uploadRoutes(supabase) {
    const router = express.Router()

    // Upload and publish a module
    router.post("/upload_moderation", upload.fields([
        { name: "assignment" },
        { name: "rubric" }
    ]), async (req, res) => {
        try {
            // Access files
            const assignmentFile = req.files.assignment?.[0]
            const rubricFile = req.files.rubric?.[0]
            if (!assignmentFile) return res.status(400).json({ error: "Assignment file required" })
            if (!rubricFile) return res.status(400).json({ error: "Rubric file required" })

            // 1️. Read rubric file from local temp folder
            const buffer = fs.readFileSync(rubricFile.path)
            // 2️. Convert DOCX to text
            const { value: text } = await mammoth.extractRawText({ buffer })
            // 3️. Split lines or extract table-like data
            const rubricLines = text.split("\n").filter(Boolean)
            const rubricJSON = rubricLines.map((line, i) => ({ id: i + 1, criterion: line }))
            // Obviously needs more complicated processing to extract the rubric

            let assignmentUrl = null
            let rubricUrl = null

            // Upload assignment to storage bucket and get url
            if (assignmentFile) {
                const fileBuffer = fs.readFileSync(assignmentFile.path)
                const { data, error } = await supabase.storage
                    .from("comp30022-amt")
                    .upload(`assignments/${assignmentFile.originalname}`, fileBuffer, {
                        contentType: assignmentFile.mimetype,
                        upsert: true
                    })
                if (error) throw error
                assignmentUrl = data.path
            }

            // Upload rubric to storage bucket and get url
            if (rubricFile) {
                const fileBuffer = fs.readFileSync(rubricFile.path)
                const { data, error } = await supabase.storage
                    .from("moderations")
                    .upload(`rubrics/${rubricFile.originalname}`, fileBuffer, {
                        contentType: rubricFile.mimetype,
                        upsert: true
                })
                if (error) throw error
                rubricUrl = data.path
            }

            // Now you can save assignmentUrl and rubricUrl in your database
            console.log("Assignment URL:", assignmentUrl)
            console.log("Rubric URL:", rubricUrl)

            // Access text fields
            const { year, semester, moderation_number, name, due_date, description } = req.body

            const { data, error } = await supabase
                .from("moderations")
                .insert([{
                    name,
                    year,
                    semester,
                    moderation_number,
                    due_date,
                    description,
                    pdf_url: assignmentUrl,
                    rubric_url: rubricUrl,
                    rubric_json: rubricJSON,
                    created_at: new Date().toISOString()
            }])

            if (error) {
                console.error("Failed to insert module:", error)
                return res.status(500).json({ error: error.message })
            }

            // moduleId can be used to redirect to another webpage, loading data for this module
            res.json({ success: true, moduleId: data[0].id })

        } catch (err) {
            console.error("Failed to insert module:", error)
            console.error(err)
            res.status(500).json({ error: "Server error" })
        }
  })

  return router
}