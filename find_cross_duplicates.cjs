
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

async function findCrossSheetDuplicates() {
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
    
    // 1. Fetch GEO IDs from Sheet1
    console.log('📊 Fetching GEO IDs from Sheet1!AC2:AC...');
    const res1 = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!AC2:AC',
    });
    const ids1 = new Map();
    (res1.data.values || []).forEach((row, i) => {
      const id = (row[0] || '').trim();
      if (id) {
        if (!ids1.has(id)) ids1.set(id, []);
        ids1.get(id).push(i + 2);
      }
    });

    // 2. Fetch GEO IDs from Sheet2
    console.log('📊 Fetching GEO IDs from Sheet2!AC2:AC...');
    const res2 = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet2!AC2:AC',
    });
    const ids2 = new Map();
    (res2.data.values || []).forEach((row, i) => {
      const id = (row[0] || '').trim();
      if (id) {
        if (!ids2.has(id)) ids2.set(id, []);
        ids2.get(id).push(i + 2);
      }
    });

    const crossSheetDuplicates = [];

    // 3. Compare sets
    for (const [id, rows2] of ids2.entries()) {
      if (ids1.has(id)) {
        crossSheetDuplicates.push({
          id,
          rowsInSheet1: ids1.get(id),
          rowsInSheet2: rows2
        });
      }
    }

    if (crossSheetDuplicates.length > 0) {
      console.log('\n--- Cross-Sheet Duplicates Found (Sheet1 vs Sheet2) ---');
      crossSheetDuplicates.forEach(d => {
        console.log(`📍 ${d.id}: Sheet1 Rows [${d.rowsInSheet1.join(', ')}] | Sheet2 Rows [${d.rowsInSheet2.join(', ')}]`);
      });
      console.log(`\nTotal cross-sheet duplicates: ${crossSheetDuplicates.length}`);
    } else {
      console.log('\n✅ No cross-sheet duplicates found between Sheet1 and Sheet2.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

findCrossSheetDuplicates();
