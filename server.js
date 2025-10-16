// Put all the code that should run on the server here and call them from frontend.
// See index.html and login.js for example.

import 'dotenv/config'
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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

// Example API route (talks to Supabase)
app.get("/api/users", async (req, res) => {
  const { data, error } = await supabase.from("users").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

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

// Check if user is logged in and get role
app.get("/api/session", async (req, res) => {
  // You’ll normally pass the JWT from the frontend in a header or cookie
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
    isAdmin: userData.is_admin
  })
})

// #######################################################################
// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));