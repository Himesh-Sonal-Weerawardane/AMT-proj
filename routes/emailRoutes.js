import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

const router = express.Router();

const transporter = nodemailer.createTransport({
    host: "in-v3.mailjet.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
});


router.post("/email/send", async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;

        if (!to || !subject) {
            return res.status(400).json({ error: "Missing 'to' or 'subject'" });
        }

        // Send the email using the transporter
        const info = await transporter.sendMail({
            from: `"My App" <${process.env.FROM_EMAIL}>`,
            to,
            subject,
            text,
            html
        });

        console.log("Message sent:", info.messageId);
        res.status(200).json({ message: "Email sent successfully", id: info.messageId });
    } catch (err) {
        console.error("Email send failed:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;