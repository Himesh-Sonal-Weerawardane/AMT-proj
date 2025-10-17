// Put all the code that should run on the server here and call them from frontend.
// See index.html and login.js for example.

import dotenv from 'dotenv'
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

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

// Attach routes and pass supabase instance
import authRoutes from "./routes/auth.js"
import uploadRoutes from "./routes/upload.js"
app.use("/api", authRoutes(supabase))
app.use("/api", uploadRoutes(supabase))

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// #######################################################################
// Other server-side code to be added later