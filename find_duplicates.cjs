
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

// Constants
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const SPREADSHEET_ID = '12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0';
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

async function findDuplicates() {
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
    
    console.log('📊 Fetching GEO IDs from Sheet1!AC2:AC...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!AC2:AC',
    });

    const rows = response.data.values || [];
    console.log(`✅ Fetched ${rows.length} rows.`);

    const geoIdMap = new Map();
    const duplicates = [];

    rows.forEach((row, index) => {
      const geoId = (row[0] || '').trim();
      if (geoId) {
        const rowNumber = index + 2; // +2 for header and 0-indexing
        if (geoIdMap.has(geoId)) {
          geoIdMap.get(geoId).push(rowNumber);
        } else {
          geoIdMap.set(geoId, [rowNumber]);
        }
      }
    });

    for (const [geoId, rowNumbers] of geoIdMap.entries()) {
      if (rowNumbers.length > 1) {
        duplicates.push({ geoId, rowNumbers });
      }
    }

    if (duplicates.length > 0) {
      console.log('\n--- Duplicate GEO IDs Found ---');
      duplicates.forEach(d => {
        console.log(`📍 ${d.geoId}: Rows ${d.rowNumbers.join(', ')}`);
      });
      console.log(`\nTotal unique IDs with duplicates: ${duplicates.length}`);
    } else {
      console.log('\n✅ No duplicate GEO IDs found.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

findDuplicates();
