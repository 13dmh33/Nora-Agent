import Anthropic from "@anthropic-ai/sdk";
import { writeFile, readFile } from "fs/promises";
import path from "path";

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
6. Provide a Calendly booking link: https://calendly.com/tradescalesolutions2026
7. Once you have collected name, phone, email, and address, output a JSON block at the end of your message in this exact format:
LEAD_CAPTURED:{"name":"","phone":"","email":"","address":"","issue":"","timestamp":""}

Always be warm, professional, and concise.`,
    messages,
  });

  const content = response.content[0];
  if (content.type === "text") {
    const text = content.text;

    if (text.includes("LEAD_CAPTURED:")) {
      try {
        const jsonStr = text.split("LEAD_CAPTURED:")[1].trim();
        const lead = JSON.parse(jsonStr);
        lead.timestamp = new Date().toISOString();

        const filePath = path.join(process.cwd(), "leads.json");
        const existing = await readFile(filePath, "utf-8");
        const leads = JSON.parse(existing);
        leads.push(lead);
        await writeFile(filePath, JSON.stringify(leads, null, 2));
      } catch (e) {
        console.error("Lead save error:", e);
      }
    }

    const cleanText = text.split("LEAD_CAPTURED:")[0].trim();
    return Response.json({ message: cleanText });
  }
}