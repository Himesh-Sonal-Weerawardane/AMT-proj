import transporter from '../config/mailer.js';

export async function sendModuleCreationEmail(
    recipient,
    moderationTitle,
    moderationDescription,
    moderationDate
) {
    try {
        const toAddress = recipient.email;
        console.log('[Email debug] recipient param:', recipient);
        const info = await transporter.sendMail({

            from: `"My App" <${process.env.FROM_EMAIL}>`,
            to: toAddress,
            subject: 'New Module Created Successfully!',
            text: `A new module, "${moderationTitle}", has been published. It covers ${moderationDescription} and is due on ${moderationDate}. Please complete it by then.`,
            html: `
              <div style="background:#f9fafb; color:#111827; font-family:Arial,Helvetica,sans-serif; padding:20px; border-radius:10px; max-width:600px; margin:auto; border:1px solid #e5e7eb;">
          <h2 style="color:#0ea5e9; margin-top:0;">New Module Published</h2>
          <p>
            A new module, <strong>${moderationTitle}</strong>, has been published.
          </p>
          <p>
            <strong>Overview:</strong> ${moderationDescription}
          </p>
          <p style="margin:10px 0;">
            <strong>Due Date:</strong> ${moderationDate}
          </p>
          <a href="${process.env.WEB_URL}" style="display:inline-block; padding:10px 16px; background:#0ea5e9; color:#fff; text-decoration:none; border-radius:6px; margin-top:10px;">
            View Module
          </a>
          <p style="margin-top:20px; font-size:12px; color:#6b7280;">
            Please complete this module before the due date.
          </p>
          <p style="margin-top:10px; font-size:12px; color:#6b7280;">
            You can also access the module directly at <a href="${process.env.WEB_URL}" style="color:#0ea5e9; text-decoration:none;">${process.env.WEB_URL}</a>.
          </p>
        </div>

      `,
        });

        console.log(`Email sent successfully to ${recipient}. Message ID: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`Error sending module creation email to ${recipient}:`, error);
        throw error;
    }
}
