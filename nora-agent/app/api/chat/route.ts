import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const client = new Anthropic();
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { messages } = await request.json();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are Nora, a friendly AI assistant for a plumbing company.
Your job is to help customers book appointments and handle inquiries.

When a customer contacts you:
1. Greet them warmly and ask what plumbing issue they're experiencing
2. Identify the issue type: leak, clog, no hot water, or install/quote
3. Ask if it's an emergency or routine
4. If emergency: express urgency, collect their info immediately
5. If routine: collect name, phone, email, service address
6. Provide a Calendly booking link: https://calendly.com/tradescalesolutions2026

CRITICAL INSTRUCTION: Once you have collected ALL of the following: name, phone, email, address, and issue type — you MUST append this exact JSON block at the very end of your response. No exceptions. Do not skip it. Do not forget it.

LEAD_CAPTURED: {"name":"[name]","phone":"[phone]","email":"[email]","address":"[address]","issue":"[issue]"}

Replace the bracketed values with the actual customer data. This line must appear even if you have already provided the Calendly link.

Always be warm, professional, and concise.`,
    messages,
  });

  const content = response.content[0];
  if (content.type !== "text") return Response.json({ message: "" });

  let text = content.text;

  console.log("Raw Nora response:", text);

  if (text.includes("LEAD_CAPTURED:")) {
    const match = text.match(/LEAD_CAPTURED:\s*(\{.*?\})/s);
    if (match) {
      try {
        const lead = JSON.parse(match[1]);
        lead.timestamp = new Date().toISOString();

        console.log("Lead captured:", lead);

        await resend.emails.send({
          from: "Nora <onboarding@resend.dev>",
          to: "tradescalesolutions2026@gmail.com",
          subject: `New Lead: ${lead.name} — ${lead.issue}`,
          html: `
            <h2>New Lead Captured by Nora</h2>
            <p><strong>Name:</strong> ${lead.name}</p>
            <p><strong>Phone:</strong> ${lead.phone}</p>
            <p><strong>Email:</strong> ${lead.email}</p>
            <p><strong>Address:</strong> ${lead.address}</p>
            <p><strong>Issue:</strong> ${lead.issue}</p>
            <p><strong>Time:</strong> ${lead.timestamp}</p>
          `,
        });

        console.log("Email sent successfully");
      } catch (e) {
        console.error("Lead processing error:", e);
      }
    }
    text = text.replace(/LEAD_CAPTURED:.*$/ms, "").trim();
  }

  return Response.json({ message: text });
}