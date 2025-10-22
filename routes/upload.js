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
        console.log("[UploadModeration] Incoming request received")
        const { authorization, ...otherHeaders } = req.headers
        console.log("[UploadModeration] Request headers:", {
            ...otherHeaders,
            authorization: authorization ? `${authorization.split(" ")[0]} ...${authorization.slice(-4)}` : undefined
        })
        console.log("[UploadModeration] Request body fields:", req.body)
        try {
            // Access files
            const assignmentFile = req.files.assignment?.[0]
            const rubricFile = req.files.rubric?.[0]
            console.log("[UploadModeration] Assignment file metadata:", assignmentFile ? {
                originalname: assignmentFile.originalname,
                mimetype: assignmentFile.mimetype,
                size: assignmentFile.size,
                path: assignmentFile.path
            } : "No assignment file provided")
            console.log("[UploadModeration] Rubric file metadata:", rubricFile ? {
                originalname: rubricFile.originalname,
                mimetype: rubricFile.mimetype,
                size: rubricFile.size,
                path: rubricFile.path
            } : "No rubric file provided")
            if (!assignmentFile) return res.status(400).json({ error: "Assignment file required" })
            if (!rubricFile) return res.status(400).json({ error: "Rubric file required" })

            // 1️. Read rubric file from local temp folder
            console.log("[UploadModeration] Reading rubric file from temp storage")
            const buffer = fs.readFileSync(rubricFile.path)
            // 2️. Convert DOCX to text
            console.log("[UploadModeration] Converting rubric DOCX to raw text")
            const { value: text } = await mammoth.extractRawText({ buffer })
            // 3️. Split lines or extract table-like data
            const rubricLines = text.split("\n").filter(Boolean)
            console.log("[UploadModeration] Extracted rubric line count:", rubricLines.length)
            const rubricJSON = rubricLines.map((line, i) => ({ id: i + 1, criterion: line }))
            // Obviously needs more complicated processing to extract the rubric

            let assignmentUrl = null
            let rubricUrl = null

            // Upload assignment to storage bucket and get url
            if (assignmentFile) {
                console.log("[UploadModeration] Uploading assignment to Supabase storage")
                const fileBuffer = fs.readFileSync(assignmentFile.path)
                const { data, error } = await supabase.storage
                    .from("comp30022-amt")
                    .upload(`modules/assignments/${assignmentFile.originalname}`, fileBuffer, {
                        contentType: assignmentFile.mimetype,
                        upsert: true
                    })
                if (error) {
                    console.error("[UploadModeration] Assignment upload failed:", error)
                    throw error
                }
                console.log("[UploadModeration] Assignment upload response:", data)
                assignmentUrl = data.path
            }

            // Upload rubric to storage bucket and get url
            if (rubricFile) {
                console.log("[UploadModeration] Uploading rubric to Supabase storage")
                const fileBuffer = fs.readFileSync(rubricFile.path)
                const { data, error } = await supabase.storage
                    .from("comp30022-amt")
                    .upload(`modules/rubrics/${rubricFile.originalname}`, fileBuffer, {
                        contentType: rubricFile.mimetype,
                        upsert: true
                })
                if (error) {
                    console.error("[UploadModeration] Rubric upload failed:", error)
                    throw error
                }
                console.log("[UploadModeration] Rubric upload response:", data)
                rubricUrl = data.path
            }

            // Now you can save assignmentUrl and rubricUrl in your database
            console.log("[UploadModeration] Assignment URL:", assignmentUrl)
            console.log("[UploadModeration] Rubric URL:", rubricUrl)

            // Access text fields
            const { year, semester, moderation_number, name, deadline_date, description } = req.body
            console.log("[UploadModeration] Preparing database insert with:", {
                year,
                semester,
                moderation_number,
                name,
                deadline_date,
                description,
                assignmentUrl,
                rubricUrl,
                rubricCount: rubricJSON.length
            })

            console.log("[UploadModeration] Executing Supabase insert for moderations")
            const { data, error } = await supabase
                .from("moderations")
                .insert([{
                    name,
                    year,
                    semester,
                    moderation_number,
                    deadline_date,
                    description,
                    assignment_url: assignmentUrl,
                    rubric_url: rubricUrl,
                    rubric: rubricJSON,
                    upload_date: new Date().toISOString()
            }])

            if (error) {
                console.error("[UploadModeration] Failed to insert module:", error)
                return res.status(500).json({ error: error.message })
            }

            console.log("[UploadModeration] Database insert response:", data)

            // moduleId can be used to redirect to another webpage, loading data for this module
            const moduleId = data?.[0]?.id
            console.log("[UploadModeration] Returning success response with moduleId:", moduleId)
            res.json({ success: true, moduleId })

        } catch (err) {
            console.error("[UploadModeration] Unhandled error while publishing module:", err)
            res.status(500).json({ error: "Server error" })
        }
    })

    router.get("/moderations/:id", async (req, res) => {
        const { id } = req.params

        try {
            const { data, error } = await supabase
                .from("moderations")
                .select("*")
                .eq("id", id)
                .single()

            if (error) {
                console.error("Failed to fetch module:", error)
                return res.status(404).json({ error: "Module not found" })
            }

            const assignmentPath = data.assignment_url
            const rubricPath = data.rubric_url

            const assignmentPublicUrl = assignmentPath
                ? supabase.storage
                    .from("comp30022-amt")
                    .getPublicUrl(assignmentPath).data.publicUrl
                : null

            const rubricPublicUrl = rubricPath
                ? supabase.storage
                    .from("comp30022-amt")
                    .getPublicUrl(rubricPath).data.publicUrl
                : null

            res.json({
                ...data,
                assignment_public_url: assignmentPublicUrl,
                rubric_public_url: rubricPublicUrl
            })
        } catch (err) {
            console.error("Failed to fetch module:", err)
            res.status(500).json({ error: "Server error" })
        }
    })

    return router
}
