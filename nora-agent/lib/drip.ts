import { Resend } from "resend";

export function isDripPaused(): boolean {
  return process.env.DRIP_PAUSED === "true";
}

export async function scheduleDrip(lead: {
  name: string;
  email: string;
  issue: string;
  source: string;
}): Promise<void> {
  if (isDripPaused()) {
    console.log("[drip] campaign paused — skipping drip for", lead.email);
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
