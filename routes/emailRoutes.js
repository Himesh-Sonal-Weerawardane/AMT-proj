
import express from "express";
import transporter from "../config/mailer.js";

const router = express.Router();

router.post("/email/send", async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;
        const info = await transporter.sendMail({
            from: `"My App" <${process.env.FROM_EMAIL}>`,
            to,
            subject,
            text,
            html
        });
        res.status(200).json({ message: "Email sent successfully", id: info.messageId });
    } catch (err) {
        console.error("Email send failed:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;