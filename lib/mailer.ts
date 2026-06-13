import nodemailer from "nodemailer";

// ─── Transport ─────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true, // SSL on port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const FROM = `"Nexus ERP" <${process.env.SMTP_USER}>`;
const APP_URL = process.env.APP_URL || "http://localhost:3000";

// ─── Core send helper ──────────────────────────────────────────────────────
export async function sendMail(to: string, subject: string, html: string) {
  await transporter.sendMail({ from: FROM, to, subject, html });
}

// ─── Shared layout wrapper ─────────────────────────────────────────────────
function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Nexus ERP</title>
</head>
<body style="margin:0;padding:0;background:#07080C;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07080C;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0E111A;border:1px solid #1E293B;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1200 0%,#0E111A 100%);padding:32px 36px;border-bottom:1px solid #1E293B;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="display:inline-block;background:#f59e0b22;border:1px solid #f59e0b44;border-radius:10px;padding:10px 14px;">
                  <span style="font-size:20px;">⚡</span>
                </div>
              </td>
              <td style="padding-left:14px;">
                <p style="margin:0;font-size:18px;font-weight:800;color:#f8fafc;letter-spacing:-0.3px;">Nexus ERP</p>
                <p style="margin:3px 0 0;font-size:10px;color:#f59e0b;text-transform:uppercase;letter-spacing:1.5px;font-family:monospace;">Tenant Operations Platform</p>
              </td>
            </tr></table>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:36px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #1E293B;background:#07080C;">
            <p style="margin:0;font-size:11px;color:#475569;text-align:center;">
              This is an automated message from Nexus ERP. Do not reply to this email.<br/>
              <a href="${APP_URL}" style="color:#f59e0b;text-decoration:none;">${APP_URL}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#f59e0b;color:#07080C;font-weight:700;font-size:13px;padding:12px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;margin-top:8px;">${label}</a>`;
}

function badge(text: string, color = "#f59e0b"): string {
  return `<span style="display:inline-block;background:${color}22;color:${color};border:1px solid ${color}44;font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;font-family:monospace;letter-spacing:1px;text-transform:uppercase;">${text}</span>`;
}

// ─── 1. Welcome email → new user ───────────────────────────────────────────
export async function sendWelcomeEmail(
  to: string,
  name: string,
  companyName: string,
  role: string
) {
  const html = layout(`
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#f8fafc;">Welcome to Nexus ERP, ${name}! 🎉</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">Your account has been created and is ready to use.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#07080C;border:1px solid #1E293B;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-family:monospace;">Account Details</p>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;font-size:12px;color:#64748b;width:110px;">Company</td><td style="font-size:13px;color:#f8fafc;font-weight:600;">${companyName}</td></tr>
          <tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Email</td><td style="font-size:13px;color:#f8fafc;font-family:monospace;">${to}</td></tr>
          <tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Role</td><td style="padding:4px 0;">${badge(role)}</td></tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">
      Your administrator has set an initial password for your account. Sign in and change it immediately for security.
    </p>

    ${btn(`${APP_URL}/login`, "Sign in to Nexus ERP →")}

    <p style="margin:24px 0 0;font-size:11px;color:#475569;">
      If you did not expect this account, please contact your system administrator immediately.
    </p>
  `);
  await sendMail(to, `Welcome to Nexus ERP – Your account is ready`, html);
}

// ─── 2. Admin alert → company admins when new user is created ──────────────
export async function sendNewUserAdminAlert(
  to: string,
  adminName: string,
  newUserName: string,
  newUserEmail: string,
  newUserRole: string,
  companyName: string
) {
  const html = layout(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#f8fafc;">New User Added</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">Hi ${adminName}, a new user has been added to <strong style="color:#f8fafc;">${companyName}</strong>.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#07080C;border:1px solid #1E293B;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-family:monospace;">New User Details</p>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;font-size:12px;color:#64748b;width:80px;">Name</td><td style="font-size:13px;color:#f8fafc;font-weight:600;">${newUserName}</td></tr>
          <tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Email</td><td style="font-size:13px;color:#f8fafc;font-family:monospace;">${newUserEmail}</td></tr>
          <tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Role</td><td style="padding:4px 0;">${badge(newUserRole)}</td></tr>
        </table>
      </td></tr>
    </table>

    ${btn(`${APP_URL}/users`, "Manage Users →")}
  `);
  await sendMail(to, `[Nexus ERP] New user added: ${newUserName}`, html);
}

// ─── 3. Login notification → user on each login ────────────────────────────
export async function sendLoginNotification(
  to: string,
  name: string,
  loginTime: Date,
  ipAddress?: string
) {
  const timeStr = loginTime.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });

  const html = layout(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#f8fafc;">New Sign-In Detected 🔐</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">Hi ${name}, a new login to your Nexus ERP account was detected.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#07080C;border:1px solid #1E293B;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-family:monospace;">Login Details</p>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;font-size:12px;color:#64748b;width:100px;">Account</td><td style="font-size:13px;color:#f8fafc;font-family:monospace;">${to}</td></tr>
          <tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Date &amp; Time</td><td style="font-size:13px;color:#f8fafc;">${timeStr} IST</td></tr>
          ${ipAddress ? `<tr><td style="padding:4px 0;font-size:12px;color:#64748b;">IP Address</td><td style="font-size:13px;color:#f8fafc;font-family:monospace;">${ipAddress}</td></tr>` : ""}
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 16px;font-size:13px;color:#94a3b8;">
      If this was you, no action is required. If you did not sign in, secure your account immediately.
    </p>

    ${btn(`${APP_URL}/login`, "Secure My Account →")}
  `);
  await sendMail(to, `[Nexus ERP] New sign-in to your account`, html);
}

// ─── 4. Password reset email ───────────────────────────────────────────────
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetLink: string
) {
  const html = layout(`
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#f8fafc;">Reset Your Password 🔑</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">Hi ${name}, we received a request to reset your Nexus ERP password. Click the button below to set a new one.</p>

    <div style="text-align:center;margin:28px 0;">
      ${btn(resetLink, "Reset Password →")}
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#07080C;border:1px solid #1E293B;border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:16px 24px;">
        <p style="margin:0;font-size:11px;color:#64748b;font-family:monospace;">⏱ This link expires in <strong style="color:#f59e0b;">1 hour</strong>. After that you'll need to request a new reset link.</p>
      </td></tr>
    </table>

    <p style="margin:0;font-size:12px;color:#475569;">
      If you did not request a password reset, you can safely ignore this email. Your password will not change.
    </p>
  `);
  await sendMail(to, `[Nexus ERP] Password Reset Request`, html);
}
