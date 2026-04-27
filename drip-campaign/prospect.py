"""
prospect.py — Prospecting tool for Astrova Advisors sales pipeline.

Usage:
    python prospect.py "Boulder, CO"

Reads GOOGLE_PLACES_API_KEY and GOOGLE_CREDENTIALS_JSON from environment.
Results are appended to the 'Scraped Data' tab in the drip campaign sheet.

Columns written:
    Priority | Action | Company name | URL | Phone Number | Email | All Emails | Notes | Has Form | Has Schedule
"""

import os
import re
import sys
import time
import json
import argparse
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
import gspread
from google.oauth2.service_account import Credentials

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")
SHEET_ID = "1SqsfXLNvJsJxWcgIvvJNgk1L0O5IL3D1S8nSc7Ss6JU"
TAB_NAME = "Scraped Data"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

SHEET_HEADERS = [
    "Priority", "Action", "Company name", "URL", "Phone Number",
    "Email", "All Emails", "Notes", "Has Form", "Has Schedule",
]

SCHEDULING_SIGNALS = [
    "calendly.com",
    "acuityscheduling.com",
    "housecallpro.com",
    "servicetitan.com",
    "jobber.com",
    "fieldedge.com",
    "workiz.com",
    "book online",
    "schedule online",
    "schedule an appointment",
    "book an appointment",
    "request an appointment",
]

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# ---------------------------------------------------------------------------
# Google Sheet
# ---------------------------------------------------------------------------

def get_sheet():
    creds_data = json.loads(os.environ["GOOGLE_CREDENTIALS_JSON"])
    creds = Credentials.from_service_account_info(creds_data, scopes=SCOPES)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SHEET_ID)

    # Get or create the 'Scraped Data' tab
    try:
        sheet = spreadsheet.worksheet(TAB_NAME)
    except gspread.exceptions.WorksheetNotFound:
        sheet = spreadsheet.add_worksheet(title=TAB_NAME, rows=1000, cols=len(SHEET_HEADERS))

    # Write headers if the sheet is empty
    if sheet.row_count == 0 or not sheet.row_values(1):
        sheet.append_row(SHEET_HEADERS)

    return sheet


# ---------------------------------------------------------------------------
# Google Places (New API)
# ---------------------------------------------------------------------------

def search_places(query: str) -> list[dict]:
    """Search using Places API (New) — Text Search endpoint."""
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "X-Goog-Api-Key": PLACES_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.nationalPhoneNumber,places.websiteUri,nextPageToken",
        "Content-Type": "application/json",
    }
    results = []
    page_token = None

    while True:
        body = {"textQuery": query, "maxResultCount": 20}
        if page_token:
            body["pageToken"] = page_token

        resp = requests.post(url, headers=headers, json=body, timeout=10)
        data = resp.json()

        if "error" in data:
            print(f"Places API error: {data['error'].get('message', data['error'])}")
            break

        for place in data.get("places", []):
            results.append({
                "name": place.get("displayName", {}).get("text", ""),
                "place_id": place.get("id", ""),
                "phone": place.get("nationalPhoneNumber", ""),
                "website": place.get("websiteUri", ""),
            })

        page_token = data.get("nextPageToken")
        if not page_token or len(results) >= 60:
            break
        time.sleep(2)

    return results


# ---------------------------------------------------------------------------
# Website crawling
# ---------------------------------------------------------------------------

def crawl_website(url: str) -> dict:
    result = {"emails": [], "has_form": False, "has_schedule": False}

    try:
        resp = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
        if resp.status_code != 200:
            return result

        html = resp.text.lower()
        soup = BeautifulSoup(resp.text, "html.parser")

        emails = set()
        for tag in soup.find_all("a", href=True):
            href = tag["href"]
            if href.startswith("mailto:"):
                addr = href[7:].split("?")[0].strip()
                if addr:
                    emails.add(addr.lower())
        for match in EMAIL_RE.findall(resp.text):
            emails.add(match.lower())
        emails = {
            e for e in emails
            if not any(x in e for x in ["example.com", "sentry.io", "w3.org", ".png", ".jpg"])
        }
        result["emails"] = sorted(emails)

        result["has_form"] = bool(soup.find("form"))
        result["has_schedule"] = any(signal in html for signal in SCHEDULING_SIGNALS)

        if not result["emails"]:
            result["emails"] = _check_subpages(url, soup)

    except Exception:
        pass

    return result


def _check_subpages(base_url: str, soup: BeautifulSoup) -> list[str]:
    contact_links = []
    for tag in soup.find_all("a", href=True):
        href = tag["href"].lower()
        if any(kw in href for kw in ["contact", "about", "reach", "email"]):
            full = urljoin(base_url, tag["href"])
            if urlparse(full).netloc == urlparse(base_url).netloc:
                contact_links.append(full)

    emails = set()
    for link in contact_links[:3]:
        try:
            resp = requests.get(link, headers=HEADERS, timeout=8, allow_redirects=True)
            if resp.status_code == 200:
                for match in EMAIL_RE.findall(resp.text):
                    emails.add(match.lower())
        except Exception:
            pass

    return sorted(
        e for e in emails
        if not any(x in e for x in ["example.com", "sentry.io", "w3.org", ".png", ".jpg"])
    )


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score(has_website: bool, emails: list, has_form: bool, has_schedule: bool) -> tuple[str, str]:
    if has_schedule:
        return "Low", "skip — has scheduling"
    if not has_website:
        return "High", "call — no website"
    if emails:
        return "High", "email"
    if has_form:
        return "Medium", "contact form"
    return "Medium", "call — no email or form"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(location: str):
    if not PLACES_API_KEY:
        print("ERROR: GOOGLE_PLACES_API_KEY environment variable not set.")
        sys.exit(1)

    print(f"Connecting to Google Sheet...")
    sheet = get_sheet()

    query = f"plumber {location}"
    print(f"Searching: {query}")
    places = search_places(query)
    print(f"Found {len(places)} businesses. Fetching details + crawling websites...")

    rows = []
    for i, place in enumerate(places, 1):
        crawl = {"emails": [], "has_form": False, "has_schedule": False}
        if place["website"]:
            print(f"  [{i}/{len(places)}] Crawling {place['website']}")
            crawl = crawl_website(place["website"])
        else:
            print(f"  [{i}/{len(places)}] {place['name']} — no website")

        priority, action = score(
            has_website=bool(place["website"]),
            emails=crawl["emails"],
            has_form=crawl["has_form"],
            has_schedule=crawl["has_schedule"],
        )

        rows.append({
            "Priority": priority,
            "Action": action,
            "Company name": place["name"],
            "URL": place["website"],
            "Phone Number": place["phone"],
            "Email": crawl["emails"][0] if crawl["emails"] else "",
            "All Emails": ", ".join(crawl["emails"]),
            "Notes": f"Location: {location}",
            "Has Form": "Yes" if crawl["has_form"] else "No",
            "Has Schedule": "Yes" if crawl["has_schedule"] else "No",
        })

        time.sleep(0.5)

    # Sort High → Medium → Low before writing
    priority_order = {"High": 0, "Medium": 1, "Low": 2}
    rows.sort(key=lambda r: priority_order.get(r["Priority"], 9))

    # Append to sheet
    print(f"\nWriting {len(rows)} rows to '{TAB_NAME}' tab...")
    for row in rows:
        sheet.append_row([row[h] for h in SHEET_HEADERS])

    high = sum(1 for r in rows if r["Priority"] == "High")
    medium = sum(1 for r in rows if r["Priority"] == "Medium")
    low = sum(1 for r in rows if r["Priority"] == "Low")

    print(f"Done — {len(rows)} prospects added to '{TAB_NAME}'")
    print(f"  High: {high} | Medium: {medium} | Low: {low}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prospect plumbers in a given location.")
    parser.add_argument("location", help='Location to search, e.g. "Boulder, CO"')
    args = parser.parse_args()
    run(args.location)
