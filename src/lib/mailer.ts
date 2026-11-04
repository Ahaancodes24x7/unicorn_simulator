// Outgoing email over SMTP (Gmail, configured in .env): one email per team, the access code to the
// team lead. Without SMTP_HOST, development builds show the code on screen and print the email to the
// server console instead; production refuses to pretend an email was sent.
import nodemailer, { type Transporter } from "nodemailer";
import { HttpError } from "./http";

let transporter: Transporter | null = null;

/** Local testing without SMTP: codes are also returned to the browser. Never true in production. */
export const devMailFallback = () => !process.env.SMTP_HOST && process.env.NODE_ENV !== "production";

function transport(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Branded HTML email with a big code block. */
function layout(heading: string, intro: string, code: string, outro: string) {
  return `<!doctype html><html><body style="margin:0;background:#1a1120;font-family:Arial,sans-serif;color:#f6e7cf">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="margin:0;font-size:12px;letter-spacing:4px;color:#f2a65a">SILICON VALLEY · UNICORN SIMULATOR</p>
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:28px;margin:12px 0">${escape(heading)}</h1>
<p style="line-height:1.6;color:#d9c7ad">${escape(intro)}</p>
<p style="margin:24px 0;padding:18px;border-radius:12px;background:#05140b;color:#8df59a;font-family:'Courier New',monospace;font-size:34px;letter-spacing:6px;text-align:center">${escape(code)}</p>
<p style="line-height:1.6;color:#a8977f;font-size:13px">${escape(outro)}</p>
</div></body></html>`;
}

export async function sendMail(to: string | string[], subject: string, text: string, html: string) {
  const t = transport();
  const recipients = Array.isArray(to) ? to : [to];
  if (!t) {
    if (process.env.NODE_ENV === "production") throw new HttpError(503, "Email is not configured on this server. Ask the organizers.");
    console.log(`\n[mail:dev] to=${recipients.join(", ")}\n[mail:dev] subject=${subject}\n${text}\n`);
    return;
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: recipients, subject, text, html });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "mail failed", err: String(err) }));
    throw new HttpError(502, "We couldn't send the email. Please try again in a minute.");
  }
}

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Emails a team's access code to its lead. */
export function sendAccessCode(to: string, team: string, code: string, reissued: boolean) {
  const intro = reissued
    ? `Here is a new access code for team ${team}. The previous code no longer works; anyone already playing stays signed in.`
    : `Team ${team} is registered! Share the team name and this access code with your teammates. Everyone enters with them.`;
  const outro = `Enter at ${appUrl()}/join with the team name "${team}" and this code.`;
  return sendMail(to, `${team}: your team access code`, `${intro}

${code}

${outro}`, layout(`Team ${team}`, intro, code, outro));
}
