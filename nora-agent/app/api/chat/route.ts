import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const client = new Anthropic();

function extractLeadFromMessages(messages: {role: string, content: string}[]) {
  const conversation = messages.map(m => m.content).join(" ");
  
  const nameMatch = conversation.match(/(?:name is|I'm|I am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  const phoneMatch = conversation.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  const emailMatch = conversation.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const addressMatch = conversation.match(/(\d+\s+[A-Za-z0-9\s,]+(?:Ave|St|Rd|Dr|Blvd|Way|Ln|Ct|Pl|Drive|Street|Avenue|Road|Boulevard|Lane|Court)[^,]*,?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5})/i);
  const issueMatch = conversation.match(/\b(leak|clog|no hot water|hot water|install|quote)\b/i);

  if (nameMatch && phoneMatch && emailMatch && addressMatch && issueMatch) {
    return {
      name: nameMatch[1],
      phone: phoneMatch[1],
      email: emailMatch[1],
      address: addressMatch[1].trim(),
      issue: issueMatch[1],
      timestamp: new Date().toISOString()
    };
  }
  return null;
}

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

Always be warm, professional, and concise.`,
    messages,
  });

  const content = response.content[0];
  if (content.type !== "text") return Response.json({ message: "" });

  const text = content.text;

  // Check if all lead fields are present in conversation
  const allMessages = [...messages, { role: "assistant", content: text }];
  const lead = extractLeadFromMessages(allMessages);

  if (lead) {
    try {
      console.log("Lead detected:", lead);

      const resend = new Resend(process.env.RESEND_API_KEY);

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
      console.error("Email error:", e);
    }
  }

  return Response.json({ message: text });
}