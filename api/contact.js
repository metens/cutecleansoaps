import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, subject, message } = req.body || {};

  if (!email || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await resend.emails.send({
      from: "Cute Clean Soaps <no-reply@cutecleansoaps.com>",
      to: ["orders@cutecleansoaps.com"], // your inbox
      reply_to: email,
      subject: subject || "New contact form message",
      text: `
Name: ${name || "(not provided)"}
Email: ${email}

Message:
${message}
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Resend error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
}
