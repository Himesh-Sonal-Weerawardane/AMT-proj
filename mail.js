//https://www.mailslurp.com/blog/send-emails-with-mailjet/
import dotenv from "dotenv"
dotenv.config()
import Mailjet from "node-mailjet"

const mailjet = Mailjet.apiConnect(
    process.env.MJ_APIKEY_PUBLIC,
    process.env.MJ_APIKEY_PRIVATE
)

export async function sendAccountRegistrationEmail(email, link) {
    try {
        const info = await mailjet 
            .post("send", { version: "v3.1"})
            .request({
                Messages: [{
                    From: {
                        Email: "amtregisteracc@gmail.com",
                        Name: "AMT Account Registration",
                    },
                    To: [{
                        Email: email,
                    }],
                    Subject: "Register Your Account",
                    HTMLPart: 
                        `<P> Register Your Account With the Link Below </p>
                        <P><a href ="${link}" style="color: blue;"> Click Here to Register</a></p>`,

                }]

            })
        console.log(info.messageId)
    } catch (err) {
        console.error(err)
    }
}
