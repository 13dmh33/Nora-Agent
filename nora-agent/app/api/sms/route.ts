import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import twilio from "twilio";

const client = new Anthropic();
const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory conversation store keyed by phone number — resets on server restart
const conversations = new Map<string, { role: string; content: string }[]>();

function twiml(message: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

function isExistingCustomer(phone: string): boolean {
  try {
    const customers = JSON.parse(
      readFileSync(join(process.cwd(), "customers.json"), "utf8")
    );
    return customers.some((c: { phone: string }) => c.phone === phone);
  } catch {
    return false;
  }
}

function saveLead(lead: Record<string, string>) {
  try {
    const path = join(process.cwd(), "leads.json");
    const existing = JSON.parse(readFileSync(path, "utf8"));
    writeFileSync(path, JSON.stringify([...existing, lead], null, 2));
  } catch {
    // Non-fatal — lead is still emailed
  }
}

async function notifyContractor(subject: string, html: string, customerPhone: string) {
  // Email notification (always attempted)
  await resend.emails.send({
    from: "Nora <onboarding@resend.dev>",
    to: process.env.CONTRACTOR_EMAIL || "13dmh33@gmail.com",
    subject,
    html,
  });

  // SMS notification (fires only when Twilio env vars are set)
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_PHONE, TWILIO_CONTRACTOR_PHONE } =
    process.env;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_PHONE && TWILIO_CONTRACTOR_PHONE) {
    const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await twilioClient.messages.create({
      from: TWILIO_FROM_PHONE,
      to: TWILIO_CONTRACTOR_PHONE,
      body: subject, // subject line is a concise 1-liner
    });
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = formData.get("Body") as string;

  if (!from || !body) return twiml("Sorry, something went wrong.");

  // Route existing customers to live person
  if (isExistingCustomer(from)) {
    await notifyContractor(
      `Existing customer texted: ${from}`,
      `<h2>Existing Customer Inbound</h2>
       <p><strong>Phone:</strong> ${from}</p>
       <p><strong>Message:</strong> ${body}</p>
       <p>Please respond directly to their number.</p>`,
      from
    );
    return twiml(
      "Hi! You're an existing customer — a team member will text you back shortly. For emergencies, call us directly."
    );
  }

  // New customer — handle with Nora AI
  const history = conversations.get(from) || [];
  history.push({ role: "user", content: body });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: `You are Nora, a friendly AI assistant for a plumbing company responding via SMS.
Keep every response SHORT — 2-3 sentences max, under 160 characters when possible. This is a text message.

When a customer texts you:
1. Greet them warmly and ask what plumbing issue they're experiencing
2. Identify the issue type: leak, clog, no hot water, or install/quote
3. Ask if it's an emergency or routine
4. If emergency: express urgency and collect info immediately
5. If routine: collect name, email, service address (you already have their phone number from Twilio)
6. Once you have all info, provide the booking link: https://calendly.com/13dmh33/discovery-call

IMPORTANT: When you have collected all customer information, include this block exactly:
<<LEAD>>
name: [customer name]
phone: [phone number]
email: [email address]
address: [full address]
issue: [issue type]
<<END>>

Be warm, concise, and professional. SMS — keep it short.`,
    messages: history,
  });

  const content = response.content[0];
  if (content.type !== "text") return twiml("Sorry, something went wrong.");

  let text = content.text;

  if (text.includes("<<LEAD>>") && text.includes("<<END>>")) {
    try {
      const block = text.match(/<<LEAD>>([\s\S]*?)<<END>>/)?.[1] || "";
      const get = (field: string) =>
        block.match(new RegExp(`${field}:\\s*(.+)`))?.[1]?.trim() || "";

      const lead = {
        name: get("name"),
        phone: from, // use verified Twilio number, not Claude's guess
        email: get("email"),
        address: get("address"),
        issue: get("issue"),
        source: "sms",
        timestamp: new Date().toISOString(),
      };

      saveLead(lead);

      await notifyContractor(
        `New SMS Lead: ${lead.name} — ${lead.issue}`,
        `<h2>New SMS Lead Captured by Nora</h2>
         <p><strong>Name:</strong> ${lead.name}</p>
         <p><strong>Phone:</strong> ${lead.phone}</p>
         <p><strong>Email:</strong> ${lead.email}</p>
         <p><strong>Address:</strong> ${lead.address}</p>
         <p><strong>Issue:</strong> ${lead.issue}</p>
         <p><strong>Source:</strong> SMS</p>
         <p><strong>Time:</strong> ${lead.timestamp}</p>`,
        from
      );

      text = text.replace(/<<LEAD>>[\s\S]*?<<END>>/, "").trim();
      conversations.delete(from); // clear after lead captured
    } catch (e: any) {
      console.error("SMS lead error:", e?.message || e);
    }
  } else {
    history.push({ role: "assistant", content: text });
    conversations.set(from, history);
  }

  return twiml(text);
}
