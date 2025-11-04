import nodemailer from "nodemailer"
import dotenv from "dotenv"
dotenv.config()

const transporter = nodemailer.createTransport({
    host: "in-v3.mailjet.com",
    port: 587,
    auth: {
        user: process.env.MJ_APIKEY_PUBLIC,
        pass: process.env.MJ_APIKEY_PRIVATE,
    },
})

export async function sendAccountRegistrationEmail(email, link) {
    try{
        const info = await transporter.sendMail({
            from: "AMT Account Registration <amtregisteracc@gmail.com>",
            to: email, 
            subject: `Register Your Account`,
            html: 
            `<P> Register Your Account With the Link Below </p>
            <P><a href ="${link}" style="color: blue;"> Click Here to Register</a></p>`
        })
        console.log(info.messageId)
    } catch (err) {
        console.error(err)
    }
}
