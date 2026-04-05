
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

// Constants
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
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

async function createDuplicatesTab() {
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
    
    // 1. Fetch current duplicates again
    console.log('📊 Fetching GEO IDs from Sheet1!AC2:AC...');
    const fetchResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!AC2:AC',
    });

    const rows = fetchResponse.data.values || [];
    const geoIdMap = new Map();
    const duplicates = [];

    rows.forEach((row, index) => {
      const geoId = (row[0] || '').trim();
      if (geoId) {
        const rowNumber = index + 2; 
        if (geoIdMap.has(geoId)) {
          geoIdMap.get(geoId).push(rowNumber);
        } else {
          geoIdMap.set(geoId, [rowNumber]);
        }
      }
    });

    for (const [geoId, rowNumbers] of geoIdMap.entries()) {
      if (rowNumbers.length > 1) {
        duplicates.push([geoId, rowNumbers.join(', ')]);
      }
    }

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found, skipping tab creation.');
      return;
    }

    // 2. Create the new tab
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const newTabName = `Duplicates-Export-${timestamp}`;
    
    console.log(`🆕 Creating new tab: ${newTabName}...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
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

    // 3. Write data to the new tab
    const dataToWrite = [
      ['GEO ID', 'Row Numbers'], // Headers
      ...duplicates
    ];

    console.log(`✍️  Writing ${duplicates.length} rows to ${newTabName}...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${newTabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: dataToWrite,
      },
    });

    console.log(`✅ Success! Tab "${newTabName}" created successfully.`);
    console.log(`URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=(new-gid)`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

createDuplicatesTab();
