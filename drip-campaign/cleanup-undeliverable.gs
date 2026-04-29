/**
 * Nora Agent — Undeliverable Email Cleanup
 *
 * Paste this entire file into your Google Sheet's Apps Script editor:
 *   Extensions > Apps Script > paste > Save > Run onOpen (or reload the sheet)
 *
 * A "Nora Tools" menu will appear in your sheet.
 * Click  Nora Tools > Clean Up Undeliverable Emails  to run.
 *
 * What it does:
 *   1. Searches Gmail for bounce / undeliverable notifications
 *   2. Parses the bounced address from each message
 *   3. Removes matching rows from the Prospect List tab (email in col D)
 *   4. Writes "Undeliverable" in col K of the Scraped Data tab (email in col F)
 *   5. Marks processed Gmail threads as read
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────

var SPREADSHEET_ID = '1SqsfXLNvJsJxWcgIvvJNgk1L0O5IL3D1S8nSc7Ss6JU';

// Tab name candidates (first match wins — edit if your tab names differ)
var PROSPECT_TAB_NAMES  = ['Sheet1', 'Prospect list', 'Prospect List', 'Prospects'];
var SCRAPED_TAB_NAMES   = ['Scraped data', 'Scraped Data', 'Sheet2'];

// Column positions (1-based)
var PROSPECT_EMAIL_COL  = 4;   // Column D in Prospect List
var SCRAPED_EMAIL_COL   = 6;   // Column F in Scraped Data
var SCRAPED_FLAG_COL    = 11;  // Column K in Scraped Data  ← writes "Undeliverable"
var SCRAPED_FLAG_VALUE  = 'Undeliverable';

// Gmail search — captures the most common bounce formats
var GMAIL_QUERY = [
  'from:mailer-daemon',
  'subject:"undeliverable"',
  'subject:"delivery failed"',
  'subject:"delivery status notification"',
  'subject:"mail delivery failure"',
  'subject:"returned mail"',
  'subject:"failure notice"'
].join(' OR ');

// Max threads to process per run (keep under Gmail quota)
var MAX_THREADS = 100;

// ─── MENU ─────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Nora Tools')
    .addItem('Clean Up Undeliverable Emails', 'cleanupUndeliverableEmails')
    .addToUi();
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function cleanupUndeliverableEmails() {
  var ui = SpreadsheetApp.getUi();

  // 1. Collect bounced addresses from Gmail
  var threads = GmailApp.search(GMAIL_QUERY, 0, MAX_THREADS);

  if (threads.length === 0) {
    ui.alert('No undeliverable emails found in Gmail.');
    return;
  }

  var bouncedSet  = {};   // dedup by lowercase address
  var processedThreads = [];

  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();
    for (var m = 0; m < messages.length; m++) {
      var email = extractBouncedEmail_(
        messages[m].getPlainBody(),
        messages[m].getSubject(),
        messages[m].getTo()
      );
      if (email) {
        bouncedSet[email.toLowerCase().trim()] = true;
      }
    }
    processedThreads.push(threads[t]);
  }

  var bounced = Object.keys(bouncedSet);

  if (bounced.length === 0) {
    ui.alert(
      'Found ' + threads.length + ' bounce thread(s) but could not parse any ' +
      'email addresses from them.\n\nOpen one of those emails and check the ' +
      'format — you may need to adjust the parser patterns in the script.'
    );
    return;
  }

  // 2. Open the spreadsheet
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var prospectSheet = findSheet_(ss, PROSPECT_TAB_NAMES);
  var scrapedSheet  = findSheet_(ss, SCRAPED_TAB_NAMES);

  if (!prospectSheet) {
    ui.alert('Could not find the Prospect List tab. Check PROSPECT_TAB_NAMES in the script.');
    return;
  }
  if (!scrapedSheet) {
    ui.alert('Could not find the Scraped Data tab. Check SCRAPED_TAB_NAMES in the script.');
    return;
  }

  // 3. Remove from Prospect List (delete entire row, work bottom-up)
  var removedCount   = 0;
  var prospectData   = prospectSheet.getDataRange().getValues();
  var rowsToDelete   = [];

  for (var r = 1; r < prospectData.length; r++) {  // row 0 = header
    var cellEmail = normalizeEmail_(prospectData[r][PROSPECT_EMAIL_COL - 1]);
    if (cellEmail && bouncedSet[cellEmail]) {
      rowsToDelete.push(r + 1);  // convert to 1-based sheet row
      removedCount++;
    }
  }

  for (var d = rowsToDelete.length - 1; d >= 0; d--) {
    prospectSheet.deleteRow(rowsToDelete[d]);
  }

  // 4. Flag in Scraped Data (column K)
  var flaggedCount = 0;
  var scrapedData  = scrapedSheet.getDataRange().getValues();

  for (var r = 1; r < scrapedData.length; r++) {
    var cellEmail = normalizeEmail_(scrapedData[r][SCRAPED_EMAIL_COL - 1]);
    if (cellEmail && bouncedSet[cellEmail]) {
      scrapedSheet.getRange(r + 1, SCRAPED_FLAG_COL).setValue(SCRAPED_FLAG_VALUE);
      flaggedCount++;
    }
  }

  // 5. Mark Gmail threads as read
  for (var t = 0; t < processedThreads.length; t++) {
    processedThreads[t].markRead();
  }

  // 6. Summary
  ui.alert(
    '✓ Done\n\n' +
    'Bounced addresses detected: ' + bounced.length + '\n' +
    '  ' + bounced.join('\n  ') + '\n\n' +
    'Rows removed from Prospect List: ' + removedCount + '\n' +
    'Rows flagged in Scraped Data (col K): ' + flaggedCount + '\n\n' +
    'Gmail threads marked as read: ' + processedThreads.length
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Tries to extract the bounced recipient address from a bounce message.
 * Works through a priority-ordered list of patterns covering the most
 * common mailer-daemon / postmaster formats.
 */
function extractBouncedEmail_(body, subject, originalTo) {
  var text = (subject || '') + '\n' + (body || '');

  var patterns = [
    // RFC 3464 DSN headers (most reliable)
    /Final-Recipient\s*:\s*rfc822\s*;\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
    /Original-Recipient\s*:\s*rfc822\s*;\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,

    // Common human-readable bounce phrases
    /(?:failed to reach|could not deliver.*?to|undeliverable.*?to|delivery.*?failed.*?to)\s*[:<]?\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
    /(?:the following address.*?failed|message.*?rejected.*?for)\s*[:<]?\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
    /(?:this message was created automatically.*?\n.*?)([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,

    // Forwarded original "To:" header inside the bounce body
    /^To:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/im,

    // Angle-bracket notation  <user@domain>
    /<([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>/
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match && match[1]) {
      // Skip mailer-daemon / postmaster return addresses
      var addr = match[1].toLowerCase();
      if (addr.indexOf('mailer-daemon') === -1 && addr.indexOf('postmaster') === -1) {
        return addr;
      }
    }
  }

  return null;
}

/** Returns the first sheet whose name (case-insensitive) matches the candidates list. */
function findSheet_(ss, candidates) {
  var sheets = ss.getSheets();
  for (var c = 0; c < candidates.length; c++) {
    for (var s = 0; s < sheets.length; s++) {
      if (sheets[s].getName().toLowerCase() === candidates[c].toLowerCase()) {
        return sheets[s];
      }
    }
  }
  return null;
}

/** Lowercases and trims an email; returns empty string if falsy. */
function normalizeEmail_(value) {
  return (value || '').toString().toLowerCase().trim();
}
