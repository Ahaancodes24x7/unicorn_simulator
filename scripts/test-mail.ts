// Sends one test email using the SMTP settings in .env.  Usage: npm run mail:test -- you@example.com
import "dotenv/config";
import nodemailer from "nodemailer";

const to = process.argv[2];
if (!to) { console.error("Usage: npm run mail:test -- you@example.com"); process.exit(1); }
if (!process.env.SMTP_HOST) { console.error("SMTP_HOST is empty in .env"); process.exit(1); }
const port = Number(process.env.SMTP_PORT ?? 587);
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST, port, secure: port === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
t.verify()
  .then(() => t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject: "Unicorn Simulator: test email", text: "Email is set up correctly." }))
  .then((r) => console.log(`✓ Sent to ${to} (${r.messageId})`))
  .catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
