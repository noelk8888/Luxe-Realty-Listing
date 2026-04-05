
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

// Constants
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = '1T-LUc3cKn0ojq1p3VvgpFs4NzB8Z6ZKV4iJaoEhfwKM';
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

async function exportDuplicatesWithDescriptions() {
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
    
    console.log('📊 Fetching all rows to identify duplicates...');
    const fetchResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A2:AZ5000', 
    });

    const rows = fetchResponse.data.values || [];
    const descriptionMap = new Map();
    const tripletMap = new Map();

    rows.forEach((row, index) => {
      const rowNumber = index + 2; 
      const colA = (row[0] || '').trim();
      const normalizedDesc = colA.toLowerCase().replace(/[\s\r\n]+/g, ' ');
      
      if (normalizedDesc) {
        if (!descriptionMap.has(normalizedDesc)) descriptionMap.set(normalizedDesc, []);
        descriptionMap.get(normalizedDesc).push({ rowNumber, colA });
      }

      const city = (row[3] || '').trim().toLowerCase();
      const area = (row[4] || '').trim().toLowerCase().replace(/,/g, '');
      const price = (row[6] || '').trim().toLowerCase().replace(/,/g, '');
      
      if (city && area && price && area !== '0' && price !== '0') {
         const tripletKey = `${city}|${area}|${price}`;
         if (!tripletMap.has(tripletKey)) tripletMap.set(tripletKey, []);
         tripletMap.get(tripletKey).push({ rowNumber, colA });
      }
    });

    const exportRows = [['Match Type', 'Match Key (City|Area|Price)', 'Row Number', 'Description (Column A)']];

    // Add Description Matches
    for (const [desc, items] of descriptionMap.entries()) {
      if (items.length > 1) {
        items.forEach(item => {
          exportRows.push(['Description Exact Match', 'N/A', item.rowNumber, item.colA]);
        });
        exportRows.push(['---', '---', '---', '---']); // Separator
      }
    }

    // Add Triplet Matches
    for (const [triplet, items] of tripletMap.entries()) {
      if (items.length > 1) {
        // Skip if exact description match already caught it (simplified logic)
        items.forEach(item => {
          exportRows.push(['Data Triplet Match', triplet, item.rowNumber, item.colA]);
        });
        exportRows.push(['---', '---', '---', '---']); // Separator
      }
    }

    if (exportRows.length <= 1) {
      console.log('✅ No duplicates found, skipping export.');
      return;
    }

    // 2. Create the new tab
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const newTabName = `Duplicate-Fuzzy-Report-${timestamp}`;
    
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
    console.log(`✍️  Writing fuzzy match data to ${newTabName}...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${newTabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: exportRows,
      },
    });

    console.log(`✅ Success! Tab "${newTabName}" created successfully.`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

exportDuplicatesWithDescriptions();
