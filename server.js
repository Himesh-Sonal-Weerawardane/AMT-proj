// Put all the code that should run on the server here and call them from frontend.
// See index.html and login.js for example.

import dotenv from 'dotenv'
dotenv.config();
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import cookieParser from "cookie-parser";

// ===== 1. ADD NODEMAILER IMPORT =====
import nodemailer from "nodemailer";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase client setup
const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;

const supabase = createClient(
    process.env.SUPABASE_URL,
    supabaseServiceRoleKey
);

// ===== 2. CREATE THE TRANSPORTER DIRECTLY IN THIS FILE =====
const transporter = nodemailer.createTransport({
    host: "in-v3.mailjet.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
});


// Parses JSON bodies automatically
app.use(express.json())
// Parses form submissions
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser());

// #################################

// When someone tries to access any page starting with /admin, this checks
// if they are signed in first, then checks if they are an admin.
// If so, allow access to the page, otherwise redirects.
app.use("/admin", async (req, res, next) => {
    try {
        const token = req.cookies?.supabase_session;
        if (!token) return res.redirect("/index.html");

        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.redirect("/index.html");

        const { data: userData } = await supabase
            .from("users")
            .select("is_admin")
            .eq("auth_id", user.id)
            .single();

        if (!userData?.is_admin) return res.redirect("/index.html");

        next(); // allow access
    } catch (err) {
        console.error(err);
        res.redirect("/index.html");
    }
}, express.static(path.join(__dirname, "frontend/admin")));

// When someone tries to access any page starting with /admin, this checks
// if they are signed in.
// If so, allow access to the page, otherwise redirects.
app.use("/marker", async (req, res, next) => {
    try {
        const token = req.cookies?.supabase_session;
        if (!token) return res.redirect("/index.html");

        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.redirect("/index.html");

        next(); // allow access
    } catch {
        res.redirect("/index.html");
    }
}, express.static(path.join(__dirname, "frontend/marker")));

// Serve public frontend HTML files (login page)
app.use(express.static(path.join(__dirname, "frontend")));
// #################################

app.use(async (req, res, next) => {
    try {
        const token = req.cookies?.supabase_session;
        if (!token) return next();

        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return next();

        const { data: dbUser, error: dbError } = await supabase
            .from("users")
            .select("user_id")
            .eq("auth_id", user.id)
            .single();

        if (!dbUser) return next();

        req.user = { id: dbUser.user_id };

    } catch (err) {
        console.error(err);
    }
    next();
});

// Attach routes and pass supabase instance
import authRoutes from "./routes/auth.js"
import uploadRoutes from "./routes/upload.js"
import moduleInfoRoutes from "./routes/module_info.js"
import moderationRoutes from "./routes/moderation.js"
import userRoutes from "./routes/users.js"
import profileRoutes from "./routes/profile.js"
import statsRoutes from "./routes/statistics.js"

// ===== 3. TEMPORARILY COMMENT OUT THE EXTERNAL ROUTE =====
// import router from "./routes/emailRoutes.js"
// app.use("/api",router )

app.use("/api", authRoutes(supabase))
app.use("/api", uploadRoutes(supabase))
app.use("/api", moduleInfoRoutes(supabase))
app.use("/api", moderationRoutes(supabase))
app.use("/api", userRoutes(supabase))
app.use("/api", profileRoutes(supabase))
app.use("/api", statsRoutes(supabase))

// ===== 4. ADD THE DIAGNOSTIC ROUTE HANDLER =====
app.post("/api/email/send", async (req, res) => {
    console.log("DIAGNOSTIC: /api/email/send route was successfully hit!");
    try {
        // We'll use the transporter defined at the top of this file
        const { to, subject, text, html } = req.body;

        if (!to || !subject) {
            return res.status(400).json({ error: "Missing 'to' or 'subject'" });
        }

        // For this test, we can just return a success message
        // without actually sending the email to speed up the test.
        res.status(200).json({ message: "Success from the diagnostic route!" });

    } catch (err) {
        console.error("Diagnostic route failed:", err);
        res.status(500).json({ error: err.message });
    }
});


// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));