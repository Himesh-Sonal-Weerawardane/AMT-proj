import express from "express"

export default function authRoutes(supabase) {
  const router = express.Router()

  // Login endpoint
  router.post("login", async (req, res) => {
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
  
  // Check if user is logged in and is admin
  router.get("/admin_session", async (req, res) => {
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
  router.post("/login_session", async (req, res) => {
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

  return router
}