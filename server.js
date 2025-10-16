// Put all the code that should run on the server here and call them from frontend.
// See index.html and login.js for example.

import 'dotenv/config'
import express from "express";
import multer from "multer"
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import fs from "fs"
import mammoth from "mammoth" // for .docx -> text/html

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // || process.env.SUPABASE_KEY
);

// Parses JSON bodies automatically
app.use(express.json())
// Parses form submissions
app.use(express.urlencoded({ extended: true }))

// Serve your frontend HTML files
app.use(express.static(path.join(__dirname, "frontend")));

// #######################################################################
// Login endpoint
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body

  // 1. Authenticate user via Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) return res.status(400).json({ error: authError.message })  // User has wrong email/password

  const userId = authData.user.id

  // 2. Check user role in the database
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("is_admin")
    .eq("auth_id", userId)
    .single()

  if (userError) return res.status(500).json({ error: userError.message })  // Server/Database failed

  // 3. Redirect to corresponding webpage and send a session token
  if (userData.is_admin) {
    res.json({ redirect: "admin/moderation-frontpage.html", access_token: authData.session.access_token })
  } else {
    res.json({ redirect: "marker/moderation-frontpage.html", access_token: authData.session.access_token })
  }
})

// Can it be app.get?
// Check if user is logged in and is admin
app.post("/api/admin_session", async (req, res) => {
  // Normally pass the JWT from the frontend in a header or cookie
  const token = req.headers.authorization?.replace("Bearer ", "")
  if (!token) return res.status(401).json({ error: "Not logged in" })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: "Invalid session" })

  // Check role in users table
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("is_admin, name")
    .eq("auth_id", user.id)
    .single()

  if (userError || !userData || !userData?.is_admin) return res.status(403).json({ error: "Access denied" })

  // Return user email from auth, and name and is_admin from database
  res.json({
    email: user.email,
    name: userData.name,
    is_admin: userData.is_admin
  })
})

// Check if user is logged in; can be admin or marker
app.post("/api/login_session", async (req, res) => {
  // Normally pass the JWT from the frontend in a header or cookie
  const token = req.headers.authorization?.replace("Bearer ", "")
  if (!token) return res.status(401).json({ error: "Not logged in" })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: "Invalid session" })

  // Check role in users table
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("is_admin, name")
    .eq("auth_id", user.id)
    .single()

  if (userError || !userData ) return res.status(403).json({ error: "Access denied" })

  // Return user email from auth, and name and is_admin from database
  res.json({
    email: user.email,
    name: userData.name,
    is_admin: userData.is_admin
  })
})

// #######################################################################
// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// #######################################################################
const upload = multer({ dest: "uploads/" }) // temp folder

// Upload and publish a module
app.post("/api/upload_moderation", upload.fields([
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
    const { year, semester, moderation_number, name, deadline_date, description } = req.body

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

// #######################################################################
// Other server-side code to be added later