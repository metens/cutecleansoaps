import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// --- Simple in-memory rate limiter (per server instance) ---
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 requests / minute / IP
const ipHits = new Map(); // ip -> { count, resetAt }

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length) return String(xff[0]).trim();
  return req.socket?.remoteAddress || "unknown";
}

function rateLimitOk(ip) {
  const now = Date.now();
  const rec = ipHits.get(ip);

  if (!rec || now > rec.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (rec.count >= RATE_LIMIT_MAX) return false;

  rec.count += 1;
  ipHits.set(ip, rec);
  return true;
}

function normalizeText(s, maxLen) {
  const v = String(s ?? "")
    .replace(/\r/g, "")
    .trim();
  return v.length > maxLen ? v.slice(0, maxLen) : v;
}

function isValidEmail(email) {
  const e = String(email || "").trim();
  if (e.length < 3 || e.length > 254) return false;
  // simple & safe (not perfect, but fine for a contact form)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function isAllowedOrigin(req) {
  const allow = new Set([
    "https://cutecleansoaps.com",
    "https://www.cutecleansoaps.com",
  ]);
  const origin = req.headers.origin || "";
  // If origin header missing, allow (some clients); if present, must match allowlist.
  return !origin || allow.has(origin);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Basic anti-CSRF / cross-site protection
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const ip = getClientIp(req);
  if (!rateLimitOk(ip)) {
    return res.status(429).json({ error: "Too many requests. Please try again shortly." });
  }

  const { name, email, subject, message, company } = req.body || {};

  // Honeypot: your frontend should include an invisible "company" input
  if (company && String(company).trim()) {
    return res.status(200).json({ ok: true }); // pretend success to bots
  }

  const cleanEmail = String(email || "").trim();
  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: "Please enter a valid email." });
  }

  const cleanName = normalizeText(name, 60);
  const cleanSubject = normalizeText(subject || "New contact form message", 120);
  const cleanMessage = normalizeText(message, 2000);

  if (!cleanMessage) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM || "Cute Clean Soaps <orders@cutecleansoaps.com>",
      to: [process.env.CONTACT_TO || "orders@cutecleansoaps.com"],
      reply_to: cleanEmail, // Resend will format this safely
      subject: cleanSubject,
      text:
        `Name: ${cleanName || "(not provided)"}\n` +
        `Email: ${cleanEmail}\n` +
        `IP: ${ip}\n\n` +
        `Message:\n${cleanMessage}\n`,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Resend error:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
}
