import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const client = new Anthropic();

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
6. Once you have all info, provide the Calendly booking link: https://calendly.com/tradescalesolutions2026

IMPORTANT: When you have collected all customer information, you MUST include this summary block in your response exactly as shown, filling in the actual values:

<<LEAD>>
name: [customer name]
phone: [phone number]
email: [email address]
address: [full address]
issue: [issue type]
<<END>>

Always be warm, professional, and concise.`,
    messages,
  });

  const content = response.content[0];
  if (content.type !== "text") return Response.json({ message: "" });

  let text = content.text;

  console.log("Raw response:", text);

  if (text.includes("<<LEAD>>") && text.includes("<<END>>")) {
    try {
      const block = text.match(/<<LEAD>>([\s\S]*?)<<END>>/)?.[1] || "";
      const get = (field: string) =>
        block.match(new RegExp(`${field}:\\s*(.+)`))?.[1]?.trim() || "";

      const lead = {
        name: get("name"),
        phone: get("phone"),
        email: get("email"),
        address: get("address"),
        issue: get("issue"),
        timestamp: new Date().toISOString(),
      };

      console.log("Lead captured:", lead);

      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Nora <onboarding@resend.dev>",
        to: "13dmh33@gmail.com",
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
      text = text.replace(/<<LEAD>>[\s\S]*?<<END>>/, "").trim();
    } catch (e) {
      console.error("Lead error:", e);
    }
  }

  return Response.json({ message: text });
}