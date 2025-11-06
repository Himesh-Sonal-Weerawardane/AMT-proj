// /config/mailer.js

import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config(); // Ensure environment variables are loaded

// Create and export the transporter.
const transporter = nodemailer.createTransport({
    host: "in-v3.mailjet.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
});

export default transporter;