
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

async function findDuplicatesWithoutGeoId() {
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
    
    console.log('📊 Fetching rows to analyze...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A2:AZ5000', // A to AZ (up to 5000 rows)
    });

    const rows = response.data.values || [];
    console.log(`✅ Success! Analyzing ${rows.length} rows...`);

    const descriptionMap = new Map(); // Normalised Description text -> Row numbers
    const tripletMap = new Map(); // Tuple of City + LotArea + Price -> Row numbers

    rows.forEach((row, index) => {
      const rowNumber = index + 2; 
      
      // 1. Check by Description (Blasted Format)
      const desc = (row[0] || '').trim();
      const normalizedDesc = desc.toLowerCase().replace(/[\s\r\n]+/g, ' '); // simple normalization
      
      if (normalizedDesc) {
        if (!descriptionMap.has(normalizedDesc)) descriptionMap.set(normalizedDesc, []);
        descriptionMap.get(normalizedDesc).push(rowNumber);
      }

      // 2. Check by Triplet (City + LotArea + Price)
      const city = (row[3] || '').trim().toLowerCase();
      const area = (row[4] || '').trim().toLowerCase().replace(/,/g, '');
      const price = (row[6] || '').trim().toLowerCase().replace(/,/g, '');
      
      if (city && area && price && area !== '0' && price !== '0') {
         const tripletKey = `${city}|${area}|${price}`;
         if (!tripletMap.has(tripletKey)) tripletMap.set(tripletKey, []);
         tripletMap.get(tripletKey).push(rowNumber);
      }
    });

    const duplicatesByDesc = [];
    for (const [desc, rowNumbers] of descriptionMap.entries()) {
      if (rowNumbers.length > 1) {
        duplicatesByDesc.push({ desc: desc.substring(0, 50) + '...', rowNumbers });
      }
    }

    const duplicatesByTriplet = [];
    for (const [triplet, rowNumbers] of tripletMap.entries()) {
      if (rowNumbers.length > 1) {
        // Only consider if not already caught by description exact match
        duplicatesByTriplet.push({ triplet, rowNumbers });
      }
    }

    if (duplicatesByDesc.length > 0 || duplicatesByTriplet.length > 0) {
      console.log('\n--- IDENTIFIED DUPLICATE LISTINGS ---');
      
      if (duplicatesByDesc.length > 0) {
          console.log('\n[By Exact Description Match]:');
          duplicatesByDesc.forEach(d => {
            console.log(`- Rows: ${d.rowNumbers.join(', ')} | Sample: ${d.desc}`);
          });
      }

      if (duplicatesByTriplet.length > 0) {
          console.log('\n[By City/Area/Price Triplet Match]:');
          duplicatesByTriplet.forEach(d => {
            console.log(`- Rows: ${d.rowNumbers.join(', ')} | Key: ${d.triplet}`);
          });
      }
      
      console.log(`\nFound ${duplicatesByDesc.length} duplicates by description and ${duplicatesByTriplet.length} duplicates by data triplet.`);
    } else {
      console.log('\n✅ No duplicates found in the analyzed range.');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

findDuplicatesWithoutGeoId();
