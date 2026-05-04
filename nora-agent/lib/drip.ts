import { Resend } from "resend";

// Drip campaign is off by default. Set DRIP_ENABLED=true to activate.
export function isDripEnabled(): boolean {
  return process.env.DRIP_ENABLED === "true";
}

export async function scheduleDrip(lead: {
  name: string;
  email: string;
  issue: string;
  source: string;
}): Promise<void> {
  if (!isDripEnabled()) {
    console.log("[drip] campaign not enabled — skipping drip for", lead.email);
    return;
  }

  // Placeholder: drip sequence will be implemented here.
  // e.g. day-1 follow-up, day-3 check-in, day-7 review request.
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Nora <onboarding@resend.dev>",
    to: lead.email,
    subject: `Thanks for reaching out, ${lead.name}!`,
    html: `<p>Hi ${lead.name}, thanks for contacting us about your ${lead.issue}. We'll be in touch soon!</p>`,
  });
}
