import os
import json
import smtplib
import re
from email.message import EmailMessage
from datetime import datetime, date

import gspread
from google.oauth2.service_account import Credentials
import anthropic

SHEET_ID = "1SqsfXLNvJsJxWcgIvvJNgk1L0O5IL3D1S8nSc7Ss6JU"
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Days to wait after last send before sending the next email
DAYS_AFTER_LAST = {
    1: 0,   # email 1: send immediately
    2: 3,   # email 2: day 4 (3 days after email 1)
    3: 3,   # email 3: day 7 (3 days after email 2)
    4: 4,   # email 4: day 11 (4 days after email 3)
    5: 2,   # email 5: day 13 (2 days after email 4)
}

# Company name | URL | Phone Number | Email | Notes | Email Stage | Unsubscribe | Last Sent
COL_COMPANY     = 1
COL_URL         = 2
COL_PHONE       = 3
COL_EMAIL       = 4
COL_NOTES       = 5
COL_EMAIL_STAGE = 6
COL_UNSUBSCRIBE = 7
COL_LAST_SENT   = 8


def clean(text: str) -> str:
    return text.replace('\xa0', ' ').replace('\u2014', '--').replace('\u2013', '-').strip()


def get_sheet():
    creds_data = json.loads(os.environ["GOOGLE_CREDENTIALS_JSON"])
    creds = Credentials.from_service_account_info(creds_data, scopes=SCOPES)
    client = gspread.authorize(creds)
    return client.open_by_key(SHEET_ID).sheet1


def load_template(step: int) -> str | None:
    path = os.path.join(TEMPLATES_DIR, f"email_{step:02d}.md")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return f.read()


def personalize(template: str, contact: dict) -> dict | None:
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=(
            "You personalize email templates for sales outreach. "
            "Return only valid JSON with 'subject' and 'body' keys. "
            "Body must be HTML formatted. Use only standard ASCII characters."
        ),
        messages=[{
            "role": "user",
            "content": (
                f"Personalize this email template for the contact below.\n"
                f"Fill in their details naturally. Keep the original tone and structure.\n\n"
                f"Template:\n{template}\n\n"
                f"Contact:\n"
                f"- Company: {contact['company']}\n"
                f"- Website: {contact['url']}\n"
                f"- Phone: {contact['phone']}\n"
                f"- Notes: {contact['notes']}\n\n"
                f'Return JSON only: {{"subject": "...", "body": "..."}}'
            )
        }]
    )
    text = response.content[0].text
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if not match:
        return None
    return json.loads(match.group())


def send_email(to_email: str, subject: str, body: str):
    gmail_user = os.environ["GMAIL_USER"].strip()
    gmail_password = os.environ["GMAIL_APP_PASSWORD"]

    to_email = clean(to_email).replace(' ', '')
    subject = clean(subject)
    body = body.encode('ascii', 'xmlcharrefreplace').decode('ascii')

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = gmail_user
    msg["To"] = to_email
    msg.set_content(body, subtype="html")

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(gmail_user, gmail_password)
        smtp.send_message(msg)


def run():
    sheet = get_sheet()
    rows = sheet.get_all_records()
    today = datetime.now().strftime("%Y-%m-%d")
    sent = 0
    skipped = 0
    errors = 0

    for i, row in enumerate(rows, start=2):
        unsubscribed = str(row.get("Unsubscribe", "")).strip().upper()
        if unsubscribed in ("Y", "YES", "TRUE", "1"):
            skipped += 1
            continue

        email = clean(str(row.get("Email", "")))
        if not email:
            skipped += 1
            continue

        current_step = int(row.get("Email Stage") or 0)
        next_step = current_step + 1

        # Check timing — skip if not enough days have passed since last send
        if next_step > 1:
            last_sent_str = str(row.get("Last Sent", "")).strip()
            if not last_sent_str:
                skipped += 1
                continue
            last_sent = datetime.strptime(last_sent_str, "%Y-%m-%d").date()
            days_since = (date.today() - last_sent).days
            required = DAYS_AFTER_LAST.get(next_step, 999)
            if days_since < required:
                skipped += 1
                continue

        template = load_template(next_step)
        if template is None:
            skipped += 1
            continue

        contact = {
            "company": clean(str(row.get("Company name", ""))),
            "email":   email,
            "url":     clean(str(row.get("URL", ""))),
            "phone":   clean(str(row.get("Phone Number", ""))),
            "notes":   clean(str(row.get("Notes", ""))),
        }

        personalized = personalize(template, contact)
        if personalized is None:
            print(f"ERROR: Could not personalize for {email}")
            errors += 1
            continue

        try:
            send_email(email, personalized["subject"], personalized["body"])
        except Exception as e:
            print(f"ERROR: Failed to send to {email}: {e}")
            errors += 1
            continue

        sheet.update_cell(i, COL_EMAIL_STAGE, next_step)
        sheet.update_cell(i, COL_LAST_SENT, today)
        sent += 1
        print(f"Sent email {next_step} to {email}")

    print(f"\nDone - Sent: {sent} | Skipped: {skipped} | Errors: {errors}")


if __name__ == "__main__":
    run()
