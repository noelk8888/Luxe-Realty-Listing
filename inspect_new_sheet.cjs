
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

// Constants
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
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

async function inspectSheet() {
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
    
    console.log('📊 Inspecting Sheet structure...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A1:AZ5', // Headers and first few rows
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      console.log('Sheet is empty or inaccessible.');
      return;
    }

    console.log('Headers:');
    rows[0].forEach((header, index) => {
      console.log(`${index}: ${header}`);
    });

    console.log('\nSample Data (Row 2):');
    if (rows[1]) {
      rows[1].forEach((val, index) => {
         console.log(`${index}: ${val?.substring(0, 50)}...`);
      });
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

inspectSheet();
