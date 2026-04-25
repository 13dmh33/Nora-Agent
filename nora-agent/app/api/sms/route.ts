import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import twilio from "twilio";

const anthropic = new Anthropic();
const getResend = () => new Resend(process.env.RESEND_API_KEY);

// In-memory conversation store keyed by phone number — resets on server restart
const conversations = new Map<string, Anthropic.MessageParam[]>();

// ── Cal.com v2 ────────────────────────────────────────────────────────────────

const CAL_BASE = "https://api.cal.com/v2";

function calHeaders(version: string) {
  const key = process.env.Cal_API || process.env.CAL_API_KEY;
  return {
    Authorization: `Bearer ${key}`,
    "cal-api-version": version,
    "Content-Type": "application/json",
  };
}

let cachedEventTypeId: number | null = null;

async function getEventTypeId(): Promise<number> {
  if (cachedEventTypeId) return cachedEventTypeId;
  const res = await fetch(`${CAL_BASE}/event-types`, {
    headers: calHeaders("2024-06-14"),
  });
  const data = await res.json();
  const types: any[] = data.data ?? [];
  const slug = process.env.CAL_EVENT_SLUG || "30min";
  const match = types.find((et: any) => et.slug === slug) ?? types[0];
  if (!match) throw new Error("No Cal.com event types found.");
  cachedEventTypeId = match.id;
  return match.id;
}

async function getAvailableSlots(urgency: string): Promise<string> {
  try {
    const eventTypeId = await getEventTypeId();
    const now = new Date();
    const end = new Date(now);
    urgency === "emergency"
      ? end.setHours(end.getHours() + 6)
      : end.setDate(end.getDate() + 7);

    const params = new URLSearchParams({
      eventTypeId: String(eventTypeId),
      start: now.toISOString(),
      end: end.toISOString(),
      timeZone: "America/Denver",
    });

    const res = await fetch(`${CAL_BASE}/slots?${params}`, {
      headers: calHeaders("2024-09-04"),
    });
    const data = await res.json();

    const slotsObj = data.data ?? {};
    const slots: { time: string; display: string }[] = [];
    for (const times of Object.values(slotsObj) as any[][]) {
      for (const slot of times) {
        const dt = new Date(slot.start);
        slots.push({
          time: slot.start,
          display: dt.toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Denver",
          }),
        });
      }
    }

    if (!slots.length) {
      return JSON.stringify({ available: false, message: "No openings in this window." });
    }

    return JSON.stringify({ available: true, slots: slots.slice(0, 3) });
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

async function createBooking(input: {
  start_time: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  issue: string;
}): Promise<string> {
  try {
    const eventTypeId = await getEventTypeId();

    const res = await fetch(`${CAL_BASE}/bookings`, {
      method: "POST",
      headers: calHeaders("2024-08-13"),
      body: JSON.stringify({
        eventTypeId,
        start: input.start_time,
        attendee: {
          name: input.name,
          email: input.email,
          timeZone: "America/Denver",
          language: "en",
          phoneNumber: input.phone,
        },
        metadata: { source: "nora-sms" },
        bookingFieldsResponses: {
          notes: `Address: ${input.address}\nIssue: ${input.issue}`,
        },
      }),
    });

    const booking = await res.json();
    const bookingData = booking.data ?? booking;

    if (!bookingData.id && !bookingData.uid) {
      return JSON.stringify({ success: false, error: booking.message || "Booking failed" });
    }

    saveLead({
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      issue: input.issue,
      booking_id: String(bookingData.id ?? bookingData.uid),
      booking_time: input.start_time,
      source: "sms",
      timestamp: new Date().toISOString(),
    });

    await getResend().emails.send({
      from: "Nora <onboarding@resend.dev>",
      to: process.env.CONTRACTOR_EMAIL || "13dmh33@gmail.com",
      subject: `New SMS Booking: ${input.name} — ${input.issue}`,
      html: `
        <h2>Appointment Booked via Nora (SMS)</h2>
        <p><strong>Name:</strong> ${input.name}</p>
        <p><strong>Phone:</strong> ${input.phone}</p>
        <p><strong>Email:</strong> ${input.email}</p>
        <p><strong>Address:</strong> ${input.address}</p>
        <p><strong>Issue:</strong> ${input.issue}</p>
        <p><strong>Appointment:</strong> ${new Date(input.start_time).toLocaleString("en-US", {
          timeZone: "America/Denver",
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}</p>
        <p><strong>Cal.com Booking ID:</strong> ${bookingData.id ?? bookingData.uid}</p>
      `,
    });

    return JSON.stringify({ success: true, booking_id: bookingData.id ?? bookingData.uid });
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function notifyContractor(subject: string, html: string) {
  await getResend().emails.send({
    from: "Nora <onboarding@resend.dev>",
    to: process.env.CONTRACTOR_EMAIL || "13dmh33@gmail.com",
    subject,
    html,
  });

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_PHONE, TWILIO_CONTRACTOR_PHONE } =
    process.env;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_PHONE && TWILIO_CONTRACTOR_PHONE) {
    const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await twilioClient.messages.create({
      from: TWILIO_FROM_PHONE,
      to: TWILIO_CONTRACTOR_PHONE,
      body: subject,
    });
  }
}

// ── Tools ─────────────────────────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: "get_available_slots",
    description:
      "Fetch available appointment slots. Emergency = next 6 hours. Routine = next 7 days. Call before presenting times. When customer picks a time, call again to get fresh ISO timestamps before calling create_booking.",
    input_schema: {
      type: "object" as const,
      properties: {
        urgency: { type: "string", enum: ["emergency", "routine"] },
      },
      required: ["urgency"],
    },
  },
  {
    name: "create_booking",
    description:
      "Book a confirmed appointment. Only call after get_available_slots returned slots AND customer confirmed a specific time. Use the exact ISO time string from slots.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_time: { type: "string", description: "Exact ISO 8601 datetime from get_available_slots" },
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        address: { type: "string" },
        issue: { type: "string" },
      },
      required: ["start_time", "name", "phone", "email", "address", "issue"],
    },
  },
];

const systemPrompt = `You are Nora, a friendly AI scheduling assistant for a plumbing company — responding via SMS.

CRITICAL: SMS messages must be SHORT. 2-3 sentences max. Under 160 characters when possible. Never use bullet points or markdown.

Conversation flow:
1. Greet warmly, ask what plumbing issue they have
2. Ask if it's an emergency (same-day) or routine
3. Collect: full name, email address, service address (you already have their phone number)
4. Once you have all four pieces of info, call get_available_slots
5. Present up to 3 times as a simple numbered list: "1) Fri Apr 25 9am 2) Mon Apr 28 10am 3) Tue Apr 29 2pm — which works?"
6. When they pick one, call get_available_slots again for fresh timestamps, match their choice, then call create_booking
7. Confirm briefly: "You're set! See you [day] at [time]. Confirmation email coming to [email]."

Rules:
- Never show JSON, ISO timestamps, or raw data
- Keep every reply SHORT — this is SMS
- Collect all 4 pieces of info before checking availability
- If no slots available, say to call us directly`;

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = formData.get("Body") as string;

  if (!from || !body) return twiml("Sorry, something went wrong.");

  // Existing customers → human handoff
  if (isExistingCustomer(from)) {
    await notifyContractor(
      `Existing customer texted: ${from}`,
      `<h2>Existing Customer Inbound</h2>
       <p><strong>Phone:</strong> ${from}</p>
       <p><strong>Message:</strong> ${body}</p>
       <p>Please respond directly to their number.</p>`
    );
    return twiml(
      "Hi! You're an existing customer — a team member will text you back shortly. For emergencies, call us directly."
    );
  }

  // New customer — agentic loop with tool use
  const history = conversations.get(from) || [];
  history.push({ role: "user", content: body });

  let finalText = "";

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      tools,
      messages: history,
    });

    if (response.stop_reason === "tool_use") {
      history.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          let result: string;
          if (block.name === "get_available_slots") {
            result = await getAvailableSlots((block.input as any).urgency);
          } else if (block.name === "create_booking") {
            // Inject verified Twilio phone number — don't trust Claude's guess
            result = await createBooking({ ...(block.input as any), phone: from });
          } else {
            result = JSON.stringify({ error: "Unknown tool" });
          }
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }

      history.push({ role: "user", content: toolResults });

      // After booking confirmed, clear conversation
      const wasBooking = response.content.some(
        (b) => b.type === "tool_use" && b.name === "create_booking"
      );
      if (wasBooking) conversations.delete(from);

      continue;
    }

    for (const block of response.content) {
      if (block.type === "text") {
        finalText = block.text;
        break;
      }
    }
    break;
  }

  if (!conversations.has(from)) {
    // Conversation was cleared (booking complete) — don't re-save
  } else {
    history.push({ role: "assistant", content: finalText });
    conversations.set(from, history);
  }

  return twiml(finalText);
}
