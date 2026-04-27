"""
prospect.py — Prospecting tool for Astrova Advisors sales pipeline.

Usage:
    python prospect.py "Boulder, CO"
    python prospect.py "Denver, CO" --output prospects.csv

Reads GOOGLE_PLACES_API_KEY from environment.
Outputs a ranked CSV ready to review before adding to the drip sheet.

CSV columns match the drip sheet schema:
    Company name, URL, Phone Number, Email, Notes, Email Stage, Unsubscribe, Last Sent
"""

import os
import re
import sys
import csv
import time
import argparse
from datetime import date
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

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

EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# ---------------------------------------------------------------------------
# Google Places
# ---------------------------------------------------------------------------

def search_places(query: str) -> list[dict]:
    """Return up to 60 place results for a text search query."""
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    results = []
    params = {"query": query, "key": PLACES_API_KEY}

    while True:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            print(f"Places API error: {data.get('status')} — {data.get('error_message', '')}")
            break

        for place in data.get("results", []):
            results.append({
                "name": place.get("name", ""),
                "phone": "",  # textsearch doesn't return phone; fetched via details
                "place_id": place.get("place_id", ""),
                "website": "",
            })

        next_token = data.get("next_page_token")
        if not next_token or len(results) >= 60:
            break
        # Google requires a short delay before using next_page_token
        time.sleep(2)
        params = {"pagetoken": next_token, "key": PLACES_API_KEY}

    return results


def fetch_place_details(place_id: str) -> dict:
    """Fetch phone and website for a single place."""
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "formatted_phone_number,website",
        "key": PLACES_API_KEY,
    }
    resp = requests.get(url, params=params, timeout=10)
    result = resp.json().get("result", {})
    return {
        "phone": result.get("formatted_phone_number", ""),
        "website": result.get("website", ""),
    }


# ---------------------------------------------------------------------------
# Website crawling
# ---------------------------------------------------------------------------

def crawl_website(url: str) -> dict:
    """
    Visit a website and return:
        emails       — list of email strings found
        has_form     — True if a <form> element was detected
        has_schedule — True if scheduling widget signals were detected
    """
    result = {"emails": [], "has_form": False, "has_schedule": False}

    try:
        resp = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
        if resp.status_code != 200:
            return result

        html = resp.text.lower()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Emails — check mailto links first, then raw text scan
        emails = set()
        for tag in soup.find_all("a", href=True):
            href = tag["href"]
            if href.startswith("mailto:"):
                addr = href[7:].split("?")[0].strip()
                if addr:
                    emails.add(addr.lower())
        for match in EMAIL_RE.findall(resp.text):
            emails.add(match.lower())
        # Filter out common false positives
        emails = {
            e for e in emails
            if not any(x in e for x in ["example.com", "sentry.io", "w3.org", ".png", ".jpg"])
        }
        result["emails"] = sorted(emails)

        # Contact form
        result["has_form"] = bool(soup.find("form"))

        # Scheduling signals
        result["has_schedule"] = any(signal in html for signal in SCHEDULING_SIGNALS)

        # Also check contact/about pages if no email found yet
        if not result["emails"]:
            result["emails"] = _check_subpages(url, soup)

    except Exception:
        pass

    return result


def _check_subpages(base_url: str, soup: BeautifulSoup) -> list[str]:
    """Look for emails on contact/about subpages if none found on homepage."""
    contact_links = []
    for tag in soup.find_all("a", href=True):
        href = tag["href"].lower()
        if any(kw in href for kw in ["contact", "about", "reach", "email"]):
            full = urljoin(base_url, tag["href"])
            # Stay on same domain
            if urlparse(full).netloc == urlparse(base_url).netloc:
                contact_links.append(full)

    emails = set()
    for link in contact_links[:3]:  # check up to 3 subpages
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
    """
    Returns (priority, action) based on detected signals.

    Priority:
        High   — strong fit, missing automation
        Medium — reachable, partial fit
        Low    — already has scheduling or nothing to act on
    """
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

def run(location: str, output: str):
    if not PLACES_API_KEY:
        print("ERROR: GOOGLE_PLACES_API_KEY environment variable not set.")
        sys.exit(1)

    query = f"plumber {location}"
    print(f"Searching: {query}")
    places = search_places(query)
    print(f"Found {len(places)} businesses. Fetching details + crawling websites...")

    rows = []
    for i, place in enumerate(places, 1):
        details = fetch_place_details(place["place_id"])
        place["phone"] = details["phone"]
        place["website"] = details["website"]

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

        email_str = crawl["emails"][0] if crawl["emails"] else ""
        notes = f"action:{action} | scheduling:{crawl['has_schedule']} | form:{crawl['has_form']}"

        rows.append({
            "Company name": place["name"],
            "URL": place["website"],
            "Phone Number": place["phone"],
            "Email": email_str,
            "Notes": notes,
            "Email Stage": "",
            "Unsubscribe": "",
            "Last Sent": "",
            # Extra columns for review — not in drip sheet, easy to delete
            "_priority": priority,
            "_action": action,
            "_all_emails": ", ".join(crawl["emails"]),
        })

        time.sleep(0.5)  # polite crawl rate

    # Sort: High first, then Medium, then Low
    priority_order = {"High": 0, "Medium": 1, "Low": 2}
    rows.sort(key=lambda r: priority_order.get(r["_priority"], 9))

    fieldnames = [
        "Company name", "URL", "Phone Number", "Email", "Notes",
        "Email Stage", "Unsubscribe", "Last Sent",
        "_priority", "_action", "_all_emails",
    ]

    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    high = sum(1 for r in rows if r["_priority"] == "High")
    medium = sum(1 for r in rows if r["_priority"] == "Medium")
    low = sum(1 for r in rows if r["_priority"] == "Low")

    print(f"\nDone — {len(rows)} prospects written to {output}")
    print(f"  High: {high} | Medium: {medium} | Low: {low}")
    print(f"\nReview the CSV, delete the _priority/_action/_all_emails columns, then paste into the drip sheet.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prospect plumbers in a given location.")
    parser.add_argument("location", help='Location to search, e.g. "Boulder, CO"')
    parser.add_argument(
        "--output",
        default=f"prospects_{date.today()}.csv",
        help="Output CSV filename (default: prospects_YYYY-MM-DD.csv)",
    )
    args = parser.parse_args()
    run(args.location, args.output)
