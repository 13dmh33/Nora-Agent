import os
import json
import smtplib
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import Header
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials
import anthropic

SHEET_ID = "1SqsfXLNvJsJxWcgIvvJNgk1L0O5IL3D1S8nSc7Ss6JU"
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Company name | URL | Phone Number | Email | Notes | Email Stage | Unsubscribe | Last Sent
COL_COMPANY     = 1
COL_URL         = 2
COL_PHONE       = 3
COL_EMAIL       = 4
COL_NOTES       = 5
COL_EMAIL_STAGE = 6
COL_UNSUBSCRIBE = 7
COL_LAST_SENT   = 8

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
    gmail_user = os.environ["GMAIL_USER"]
    gmail_password = os.environ["GMAIL_APP_PASSWORD"]
    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = gmail_user
    msg["To"] = to_email
    msg.attach(MIMEText(body, "html", "utf-8"))
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
        email = str(row.get("Email", "")).strip()
        if not email:
            skipped += 1
            continue
        current_step = int(row.get("Email Stage") or 0)
        next_step = current_step + 1
        template = load_template(next_step)
        if template is None:
            skipped += 1
            continue
        contact = {
            "company": str(row.get("Company name", "")),
            "email":   email,
            "url":     str(row.get("URL", "")),
            "phone":   str(row.get("Phone Number", "")),
            "notes":   str(row.get("Notes", "")),
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

    print(f"\nDone — Sent: {sent} | Skipped: {skipped} | Errors: {errors}")

if __name__ == "__main__":
    run()
