import nodemailer from 'nodemailer';

interface SendOtpOptions {
  to: string;
  otp: string;
  type: 'LOGIN' | 'REGISTER' | 'RESEND';
}

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendOtpEmail({ to, otp, type }: SendOtpOptions): Promise<{ sent: boolean; message?: string; error?: string }> {
  const cleanEmail = to.trim().toLowerCase();
  const transporter = getTransporter();

  // Check if target email is currently being impersonated by an Admin
  const { getImpersonationAdmin } = await import('@/lib/impersonation');
  const impersonation = getImpersonationAdmin(cleanEmail);
  const recipientEmail = impersonation ? impersonation.adminEmail : cleanEmail;

  if (impersonation) {
    console.log(`\x1b[35m[IMPERSONATION EMAIL ROUTED] Email originally for ${cleanEmail} routed directly to Admin: ${impersonation.adminEmail}\x1b[0m`);
  }

  if (!transporter) {
    const notice = `[EMAIL] SMTP_USER or SMTP_PASS is not configured in .env. Email not sent to ${recipientEmail}. Check backend console for OTP.`;
    console.warn(`\x1b[33m${notice}\x1b[0m`);
    return { sent: false, message: 'SMTP not configured' };
  }

  const actionName = type === 'REGISTER' 
    ? 'Company Account Registration' 
    : (type === 'LOGIN' ? 'Sign-In Verification' : 'Verification Code');

  const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"Kantech Platform" <${process.env.SMTP_USER}>`;

  const impersonationBanner = impersonation ? `
    <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; color: #92400e; text-align: left; line-height: 1.5;">
      <strong>🎭 Admin Impersonation Notice:</strong><br/>
      This verification email was originally generated for <strong>${cleanEmail}</strong>. Because you are currently impersonating this company in Platform Admin, this email was routed directly to your admin inbox.
    </div>
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: #001D4A; padding: 28px 24px; text-align: center; }
          .header h1 { color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; letter-spacing: -0.5px; }
          .header p { color: #93c5fd; font-size: 12px; margin: 6px 0 0 0; }
          .content { padding: 32px 24px; text-align: center; }
          .badge { display: inline-block; background: #eff6ff; color: #1d4ed8; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
          .title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
          .subtitle { font-size: 14px; color: #64748b; line-height: 1.5; margin: 0 0 24px 0; }
          .otp-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 18px 24px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #001D4A; font-family: monospace; display: inline-block; margin-bottom: 24px; }
          .expiry-note { font-size: 12px; color: #94a3b8; margin-bottom: 24px; }
          .footer { background: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Kantech</h1>
            <p>B2B Component Procurement Platform</p>
          </div>
          <div class="content">
            ${impersonationBanner}
            <div class="badge">${actionName}</div>
            <h2 class="title">Your One-Time Passcode</h2>
            <p class="subtitle">Use the verification code below to complete your sign-in to Kantech. This code is valid for 10 minutes.</p>
            
            <div class="otp-box">${otp}</div>

            <p class="expiry-note">⏰ Code expires in <strong>10 minutes</strong>. If you did not request this code, please ignore this email.</p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Kantech • Secure B2B Procurement Platform
          </div>
        </div>
      </body>
    </html>
  `;

  const subjectPrefix = impersonation ? `[Admin Impersonation: ${cleanEmail}] ` : '[Kantech] ';

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: `${subjectPrefix}Your verification code is ${otp}`,
      text: `${impersonation ? `[Notice: Impersonating ${cleanEmail}] ` : ''}Your Kantech verification code is: ${otp}. This code expires in 10 minutes.`,
      html,
    });

    console.log(`\x1b[32m[EMAIL SENT] Successfully sent ${type} OTP to ${recipientEmail} ${impersonation ? `(on behalf of ${cleanEmail})` : ''} (MessageId: ${info.messageId})\x1b[0m`);
    return { sent: true, message: info.messageId };
  } catch (error: any) {
    console.error(`\x1b[31m[EMAIL ERROR] Failed to send email to ${recipientEmail}:\x1b[0m`, error?.message || error);
    return { sent: false, error: error?.message || 'Failed to send email' };
  }
}
