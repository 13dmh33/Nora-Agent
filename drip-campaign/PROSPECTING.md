# Prospecting Workflow

Automates lead discovery for the Astrova Advisors drip campaign. Searches Google Places for plumbers in a given location, crawls each website, and writes ranked results to the **Scraped Data** tab in the drip campaign Google Sheet.

---

## How to Run

1. Go to `github.com/13dmh33/Nora-Agent`
2. Click **Actions** → **Prospect** (left sidebar)
3. Click **Run workflow**
4. Enter a location (e.g. `Pueblo, CO` or `Boulder, Colorado`)
5. Click **Run workflow**

Results appear in the **Scraped Data** tab of the Google Sheet within 5–8 minutes.

---

## What It Does

1. Queries Google Places API (New) for `"plumber {location}"` — up to 60 results
2. For each business: retrieves name, phone, and website from Places
3. Crawls each website — homepage + up to 3 contact/about subpages — looking for:
   - Email addresses
   - Contact forms
   - Scheduling widgets (Calendly, HouseCall Pro, ServiceTitan, Jobber, Acuity, etc.)
4. Scores and ranks every result
5. Writes all rows to the **Scraped Data** tab, sorted High → Medium → Low

---

## Priority Scoring

| Priority | Condition | Recommended Action |
|---|---|---|
| High | No website | Call |
| High | Website + email found, no scheduling | Add to drip campaign |
| Medium | Website + contact form, no email, no scheduling | Fill out contact form manually |
| Medium | Website, no email, no form, no scheduling | Call |
| Low | Has scheduling already | Skip |

---

## Output Columns (Scraped Data tab)

| Column | Description |
|---|---|
| Priority | High / Medium / Low |
| Action | Recommended next step |
| Company name | Business name from Google |
| URL | Website URL |
| Phone Number | Phone from Google Places |
| Email | First email found on website |
| All Emails | All emails found (comma separated) |
| Notes | Location searched |
| Has Form | Yes / No — contact form detected |
| Has Schedule | Yes / No — scheduling widget detected |

---

## Moving Prospects to the Drip Campaign

The drip campaign sheet (`main` tab) expects these columns:

```
Company name | URL | Phone Number | Email | Notes | Email Stage | Unsubscribe | Last Sent
```

To add a High-priority email prospect to the drip:
1. Copy the row from **Scraped Data**
2. Paste into the main drip sheet
3. Leave Email Stage, Unsubscribe, and Last Sent blank — the drip runner fills these in

---

## Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `GOOGLE_PLACES_API_KEY` | Google Places API (New) — enable in Google Cloud Console |
| `GOOGLE_CREDENTIALS_JSON` | Service account JSON for Google Sheets write access |

---

## Volume by Market Size

| Market | Expected Results |
|---|---|
| Small town | 5–15 businesses |
| Mid-size city | 15–35 businesses |
| Large metro | Up to 60 (API cap) |

For large metros (Denver, Colorado Springs), run multiple searches by neighborhood or zip code to get full coverage.

---

## Notes

- Results are **appended** on each run — existing rows are not overwritten
- The Scraped Data tab is created automatically if it does not exist
- Run time is approximately 5–8 minutes for 60 businesses
