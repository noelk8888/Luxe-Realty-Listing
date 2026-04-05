
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

// Constants
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SOURCE_SPREADSHEET_ID = '1T-LUc3cKn0ojq1p3VvgpFs4NzB8Z6ZKV4iJaoEhfwKM';
const TARGET_SPREADSHEET_ID = '12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0';
const ENV_PATH = '/Users/noelk/repos/LUXE Edit/luxe-listings/.env.local';

function parseEnv(filePath) {
  const env = {};
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        env[match[1]] = value.replace(/\\n/g, '\n');
      }
    });
  }
  return env;
}

function extractPhotoLink(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  
  // Usually the last line or second to last line contains the photo link
  // Look for common photo host patterns
  const photoPattern = /https:\/\/photos\.app\.goo\.gl\/[a-zA-Z0-9_-]+|https:\/\/(?:www\.)?google\.com\/photos\b/i;
  
  // Check last 2 lines
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 2); i--) {
    const match = lines[i].match(photoPattern);
    if (match) return match[0];
  }
  return null;
}

async function exportRefinedDuplicates() {
  try {
    const env = parseEnv(ENV_PATH);
    const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = env.GOOGLE_PRIVATE_KEY;

    if (!email || !privateKey) {
      throw new Error('Google service account credentials not found in .env.local');
    }
    
    const auth = new JWT({
      email: email,
      key: privateKey,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log('📊 Fetching all rows from SOURCE sheet...');
    const fetchResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SOURCE_SPREADSHEET_ID,
      range: 'Sheet1!A2:AZ5000', 
    });

    const rows = fetchResponse.data.values || [];
    const photoMap = new Map(); // PhotoLink -> List of {rowNumber, colA, tripletKey}
    const tripletMap = new Map(); // TripletKey -> List of {rowNumber, colA} (only for those without photo links)

    rows.forEach((row, index) => {
      const rowNumber = index + 2; 
      const colA = (row[0] || '').trim();
      const photoLink = extractPhotoLink(colA);

      const city = (row[3] || '').trim().toLowerCase();
      const area = (row[4] || '').trim().toLowerCase().replace(/,/g, '');
      const price = (row[6] || '').trim().toLowerCase().replace(/,/g, '');
      const tripletKey = (city && area && price && area !== '0' && price !== '0') ? `${city}|${area}|${price}` : null;

      if (photoLink) {
        if (!photoMap.has(photoLink)) photoMap.set(photoLink, []);
        photoMap.get(photoLink).push({ rowNumber, colA });
      } else if (tripletKey) {
        if (!tripletMap.has(tripletKey)) tripletMap.set(tripletKey, []);
        tripletMap.get(tripletKey).push({ rowNumber, colA });
      }
    });

    const exportRows = [['Match Type', 'Match Key (Photo Link or Triplet)', 'Row Number', 'Description (Column A)']];

    // 1. Add Photo Link Matches
    let photoCount = 0;
    for (const [photo, items] of photoMap.entries()) {
      if (items.length > 1) {
        items.forEach(item => {
          exportRows.push(['PHOTO LINK MATCH', photo, item.rowNumber, item.colA]);
        });
        exportRows.push(['---', '---', '---', '---']);
        photoCount++;
      }
    }

    // 2. Add Triplet Matches (only for those without photo links)
    let tripletCount = 0;
    for (const [triplet, items] of tripletMap.entries()) {
      if (items.length > 1) {
        items.forEach(item => {
          exportRows.push(['TRIPLET MATCH (No Photo)', triplet, item.rowNumber, item.colA]);
        });
        exportRows.push(['---', '---', '---', '---']);
        tripletCount++;
      }
    }

    if (exportRows.length <= 1) {
      console.log('✅ No duplicates found with refined criteria.');
      return;
    }

    // 3. Update the tab in TARGET sheet (Luxe Dbase)
    const newTabName = 'ORIG DUPLICATES';
    
    console.log(`🆕 Updating tab "${newTabName}" in Luxe Dbase...`);
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: TARGET_SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: newTabName,
                },
              },
            },
          ],
        },
      });
    } catch (e) {
       // Tab already exists, we will clear and update
    }

    // Clear existing content in the tab
    await sheets.spreadsheets.values.clear({
      spreadsheetId: TARGET_SPREADSHEET_ID,
      range: `${newTabName}!A1:Z5000`,
    });

    // Write refined data
    console.log(`✍️  Writing refined data to ${newTabName}...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: TARGET_SPREADSHEET_ID,
      range: `${newTabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: exportRows,
      },
    });

    console.log(`✅ Success! Found ${photoCount} photo matches and ${tripletCount} fallback triplet matches.`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

exportRefinedDuplicates();
