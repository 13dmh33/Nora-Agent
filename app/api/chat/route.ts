import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const anthropic = new Anthropic();
const resend = new Resend(process.env.RESEND_API_KEY);

// Cached after first lookup — avoids repeated event-type API calls
let cachedEventTypeId: number | null = null;

async function getEventTypeId(): Promise<number> {
  if (cachedEventTypeId) return cachedEventTypeId;
  const res = await fetch(
    `https://api.cal.com/v1/event-types?apiKey=${process.env.CAL_API_KEY}`
  );
  const data = await res.json();
  const match = data.event_types?.find((et: any) => et.slug === "30min");
  if (!match) throw new Error("Cal.com event type '30min' not found");
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
      : end.setDate(end.getDate() + 4);

    const params = new URLSearchParams({
      apiKey: process.env.CAL_API_KEY || "",
      eventTypeId: String(eventTypeId),
      startTime: now.toISOString(),
      endTime: end.toISOString(),
      timeZone: "America/Denver",
    });

    const res = await fetch(`https://api.cal.com/v1/slots?${params}`);
    const data = await res.json();

    const slots: { time: string; display: string }[] = [];
    for (const times of Object.values(data.slots || {}) as any[][]) {
      for (const slot of times) {
        const dt = new Date(slot.time);
        slots.push({
          time: slot.time,
          display: dt.toLocaleString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Denver",
          }),
        });
      }
    }

    if (!slots.length) {
      return JSON.stringify({
        available: false,
        message: "No openings in this window.",
      });
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
    const endTime = new Date(
      new Date(input.start_time).getTime() + 30 * 60 * 1000
    ).toISOString();

    const res = await fetch(
      `https://api.cal.com/v1/bookings?apiKey=${process.env.CAL_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeId,
          start: input.start_time,
          end: endTime,
          responses: {
            name: input.name,
            email: input.email,
            notes: `Phone: ${input.phone}\nAddress: ${input.address}\nIssue: ${input.issue}`,
          },
          timeZone: "America/Denver",
          language: "en",
          metadata: { source: "nora-web-chat", phone: input.phone },
        }),
      }
    );

    const booking = await res.json();

    if (!booking.id) {
      console.error("Cal.com booking error:", booking);
      return JSON.stringify({ success: false, error: booking.message || "Booking failed" });
    }

    saveLead({
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      issue: input.issue,
      booking_id: String(booking.id),
      booking_time: input.start_time,
      source: "web",
      timestamp: new Date().toISOString(),
    });

    await resend.emails.send({
      from: "Nora <onboarding@resend.dev>",
      to: process.env.CONTRACTOR_EMAIL || "13dmh33@gmail.com",
      subject: `New Booking: ${input.name} — ${input.issue}`,
      html: `
        <h2>Appointment Booked via Nora</h2>
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
        <p><strong>Cal.com Booking ID:</strong> ${booking.id}</p>
      `,
    });

    return JSON.stringify({ success: true, booking_id: booking.id });
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

function saveLead(lead: Record<string, string>) {
  try {
    const path = join(process.cwd(), "leads.json");
    const existing = JSON.parse(readFileSync(path, "utf8"));
    writeFileSync(path, JSON.stringify([...existing, lead], null, 2));
  } catch {
    // Non-fatal — lead is still emailed to contractor
  }
}

const tools: Anthropic.Tool[] = [
  {
    name: "get_available_slots",
    description:
      "Fetch available appointment slots from the calendar. Emergency = next 6 hours. Routine = next 4 days. Call this before presenting times to the customer. When the customer selects a time, call this again to get a fresh slot list with exact ISO timestamps before calling create_booking.",
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
      "Create a confirmed appointment. Only call after get_available_slots returned slots AND the customer confirmed a specific time. Use the exact ISO time string from the slots response.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_time: {
          type: "string",
          description: "Exact ISO 8601 datetime from the get_available_slots response",
        },
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

const systemPrompt = `You are Nora, a friendly AI scheduling assistant for a plumbing company.

Your job is to collect customer information and book an appointment directly — no external links needed.

Conversation flow:
1. Greet warmly, ask what plumbing issue they're experiencing
2. Identify issue type: leak, clog, no hot water, or install/quote
3. Ask if it's an emergency (same-day) or routine (flexible)
4. Collect: full name, phone number, email address, service address
5. Once you have all five pieces of info, call get_available_slots with the urgency level
6. Present up to 3 times naturally — e.g. "I have Thursday, April 24th at 2:00 PM or Friday, April 25th at 10:00 AM — which works better for you?"
7. When the customer picks a time, call get_available_slots again to get a fresh list, match their selection to the exact ISO timestamp, then immediately call create_booking
8. Confirm warmly: "You're all set! We'll see you [day] at [time]. You'll get a confirmation email shortly."

Rules:
- Never show JSON, ISO timestamps, or raw data to the customer
- Never mention Calendly or any external booking link
- If no slots are available, apologize and ask them to call directly for urgent issues
- Collect all 5 pieces of info before checking availability
- Keep responses concise and warm`;

export async function POST(request: Request) {
  const { messages } = await request.json();

  let currentMessages: Anthropic.MessageParam[] = messages.map((m: any) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let finalText = "";

  // Agentic loop — handles multiple tool call rounds within one HTTP request
  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    });

    if (response.stop_reason === "tool_use") {
      currentMessages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          let result: string;
          if (block.name === "get_available_slots") {
            result = await getAvailableSlots((block.input as any).urgency);
          } else if (block.name === "create_booking") {
            result = await createBooking(block.input as any);
          } else {
            result = JSON.stringify({ error: "Unknown tool" });
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      currentMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // end_turn — extract final text response
    for (const block of response.content) {
      if (block.type === "text") {
        finalText = block.text;
        break;
      }
    }
    break;
  }

  return Response.json({ message: finalText });
}
