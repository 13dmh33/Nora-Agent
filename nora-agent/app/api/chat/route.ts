import Anthropic from "@anthropic-ai/sdk";

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

Always be warm, professional, and concise. You represent a local plumbing business.`,
    messages,
  });

  const content = response.content[0];
  if (content.type === "text") {
    return Response.json({ message: content.text });
  }
}
