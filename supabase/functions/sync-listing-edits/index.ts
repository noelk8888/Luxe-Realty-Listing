import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SPREADSHEET_ID = Deno.env.get("SPREADSHEET_ID") || "12Z8X3RmYRBMiihsxf-J0f650Ifj2irxRQsYC64Cgbw0";
const SPREADSHEET_ID_BACKUP = Deno.env.get("BACKUP_SPREADSHEET_ID") || "1jK5Sv4OO-6RHZhXITQd-S_kQxthZDiBzGcCZPelNGOw";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tab configs: column mappings for each tab
const TABS = [
  {
    name: "Sheet1",
    geoIdCol: "AC",
    columns: {
      salePrice: "AS",
      salePricePerSqm: "AT",
      leasePrice: "AU",
      leasePricePerSqm: "AV",
      notes: "AW",
      lotArea: "AO",
      floorArea: "AP",
      dateUpdated: "BC",
      latLong: "BE",
      lat: "BF",
      long: "BG",
      monthlyDues: "BB",
      fbLink: "Z",
      postLinkLuxe: "BP",
      postLinkNexia: "BQ",
      postLinkAdolf: "BR",
      postLinkPco: "BS",
      postLinkSloo: "BT",
      postLinkTaoke: "BU",
      mapVerified: "BV",
      client: "BW",
    },
  },
  {
    name: "Sheet2",
    geoIdCol: "AC",
    columns: {
      salePrice: "G",
      salePricePerSqm: "AT",
      leasePrice: "AU",
      leasePricePerSqm: "AV",
      notes: "AW",
      lotArea: "AO",
      floorArea: "AP",
      dateUpdated: "BC",
      latLong: "BE",
      lat: "BF",
      long: "BG",
      monthlyDues: "BB",
      fbLink: "Z",
      postLinkLuxe: "BP",
      postLinkNexia: "BQ",
      postLinkAdolf: "BR",
      postLinkPco: "BS",
      postLinkSloo: "BT",
      postLinkTaoke: "BU",
      mapVerified: "BV",
      client: "BW",
    },
  },
];

// --- Google Auth (Service Account JWT → Access Token) ---

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getAccessToken(
  email: string,
  privateKey: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(signingInput)
  );
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return data.access_token;
}

// --- Google Sheets helpers ---

async function sheetsGet(
  token: string,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets GET ${range} failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return data.values || [];
}

async function sheetsBatchUpdate(
  token: string,
  spreadsheetId: string,
  updates: { range: string; values: (string | number)[][] }[]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: updates,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets batchUpdate failed: ${res.status} ${errText}`);
  }
}

// --- Main handler ---

serve(async (req) => {
  // Handle CORS preflight (required for direct browser calls)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only accept POST
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const body = await req.json();
    console.log("Webhook payload:", JSON.stringify(body));

    // Support both direct payload and wrapped { record, old_record } format
    const record = body.record ?? body;
    const oldRecord = body.old_record ?? {};

    // Exhaustive logging
    console.log("--- START PAYLOAD DIAGNOSTIC ---");
    Object.keys(record).forEach(key => {
      console.log(`Key: [${key}] Value: [${record[key]}]`);
    });
    console.log("--- END PAYLOAD DIAGNOSTIC ---");

    const getColValue = (obj: any, colName: string) => {
      if (obj === null || obj === undefined) return undefined;
      if (obj[colName] !== undefined) return obj[colName];
      
      // Fallback: Case-insensitive search across all keys
      const searchKey = colName.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
      const actualKey = Object.keys(obj).find(k => 
        k.toLowerCase().replace(/\s+/g, '').replace(/_/g, '') === searchKey
      );
      
      if (actualKey) {
        console.log(`Found match for ${colName} using key: [${actualKey}]`);
        return obj[actualKey];
      }
      return undefined;
    };

    const geoId = getColValue(record, "GEO ID");

    if (!geoId) {
      console.log("Missing GEO ID in payload");
      return new Response(
        JSON.stringify({ error: "Missing GEO ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- RECOVERY LOGIC: Fetch current metadata from Supabase ---
    // Sometimes webhooks omit columns that Supabase thinks haven't changed.
    // We fetch them here to ensure they always sync if a sync is triggered.
    let mapVerifiedValue = getColValue(record, "MAP VERIFIED");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (mapVerifiedValue === undefined || mapVerifiedValue === null) {
      try {
        // [RECOVERY LOGIC] If MAP VERIFIED or SOCMED fields are missing, fetch from DB
        // Vital fields that we must preserve
        const vitalFields = [
          { key: "fbLink", db: "FB LINK" },
          { key: "postLinkLuxe", db: "BP" },
          { key: "postLinkNexia", db: "BQ" },
          { key: "postLinkAdolf", db: "BR" },
          { key: "postLinkPco", db: "BS" },
          { key: "postLinkSloo", db: "BT" },
          { key: "postLinkTaoke", db: "BU" },
        ];
        const isVitalMissing = vitalFields.some(f => record[f.key] === undefined || record[f.key] === null);

        if (mapVerifiedValue === undefined || mapVerifiedValue === null || isVitalMissing) {
          console.log(`[SYNC-DEBUG] Missing vital fields (MapVerified: ${mapVerifiedValue}, VitalMissing: ${isVitalMissing}). Recovering from DB for GEO ID: ${geoId}`);
          
          const selectFields = ["MAP VERIFIED", "FB LINK", "BP", "BQ", "BR", "BS", "BT", "BU"];
          const queryUrl = `${supabaseUrl}/rest/v1/${encodeURIComponent("KIU Properties")}?select=${encodeURIComponent(selectFields.join(","))}&${encodeURIComponent("GEO ID")}=eq.${encodeURIComponent(geoId)}`;
          console.log(`[SYNC-DEBUG] Recovery Query: ${queryUrl}`);
          
          const dbRes = await fetch(queryUrl, {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Accept": "application/json",
            },
          });

          if (dbRes.ok) {
            const rows = await dbRes.json();
            console.log(`[SYNC-DEBUG] DB Response Rows: ${rows.length}`);
            if (rows.length > 0) {
              const dbData = rows[0];
              if (mapVerifiedValue === undefined || mapVerifiedValue === null) {
                mapVerifiedValue = dbData["MAP VERIFIED"] ?? "";
                console.log(`[SYNC-DEBUG] Recovered MAP VERIFIED: [${mapVerifiedValue}]`);
              }
              
              vitalFields.forEach(f => {
                if (record[f.key] === undefined || record[f.key] === null) {
                  record[f.key] = dbData[f.db] ?? "";
                  console.log(`[SYNC-DEBUG] Recovered ${f.key} (${f.db}): [${record[f.key] ? 'Found' : 'Empty'}]`);
                }
              });
            } else {
              console.warn(`[SYNC-DEBUG] No rows found for GEO ID: ${geoId}`);
            }
          } else {
            console.error(`[SYNC-DEBUG] DB Recovery failed: ${dbRes.status}`);
          }
        }
      } catch (err) {
        console.error("Failed to fetch recovery data:", err);
      }
    }

    // Check which fields changed
    const changedFields: string[] = [];
    const fieldMappings = [
      { db: "Extracted Sale Price", key: "salePrice" },
      { db: "Sale Price/Sqm", key: "salePricePerSqm" },
      { db: "Extracted Lease Price", key: "leasePrice" },
      { db: "Lease Price/Sqm", key: "leasePricePerSqm" },
      { db: "COMMENTS", key: "notes" },
      { db: "DATE UPDATED", key: "dateUpdated" },
      { db: "LAT LONG", key: "latLong" },
      { db: "LAT", key: "lat" },
      { db: "LONG", key: "long" },
      { db: "MONTHLY DUES", key: "monthlyDues" },
      { db: "FB LINK", key: "fbLink" },
      { db: "BP", key: "postLinkLuxe" },
      { db: "BQ", key: "postLinkNexia" },
      { db: "BR", key: "postLinkAdolf" },
      { db: "BS", key: "postLinkPco" },
      { db: "BT", key: "postLinkSloo" },
      { db: "BU", key: "postLinkTaoke" },
      { db: "MAP VERIFIED", key: "mapVerified" },
      { db: "BW", key: "client" },
    ];

    for (const field of fieldMappings) {
      const newVal = field.key === "mapVerified" ? mapVerifiedValue : getColValue(record, field.db);
      const oldVal = getColValue(oldRecord, field.db);
      
      // If mapVerified is present (either in webhook or recovered from DB), always sync it if it's non-empty
      if (newVal !== oldVal || (field.key === "mapVerified" && newVal)) {
        console.log(`Field to sync: ${field.db} = [${newVal}]`);
        changedFields.push(field.key);
      }
    }

    if (changedFields.length === 0) {
      console.log("No relevant fields changed, skipping");
      return new Response(
        JSON.stringify({ message: "No relevant fields changed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing ${changedFields.length} fields for GEO ID ${geoId}:`, changedFields);

    // Get Google credentials from Supabase secrets
    const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");

    if (!email || !privateKey) {
      throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY secrets");
    }

    // Get Access Token
    const token = await getAccessToken(email, privateKey);
    console.log("Got Google access token");

    // Update each tab
    for (const tab of TABS) {
      console.log(`Processing tab: ${tab.name}`);

      // Read the GEO ID column to find the row
      const geoRange = `${tab.name}!${tab.geoIdCol}:${tab.geoIdCol}`;
      const rows = await sheetsGet(token, SPREADSHEET_ID, geoRange);

      // Find the row index (1-based in Sheets)
      let rowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const cellValue = rows[i]?.[0]?.toString().trim();
        if (cellValue === geoId.toString().trim()) {
          rowIndex = i + 1; // Sheets rows are 1-based
          console.log(`[SYNC-DEBUG] Found row ${rowIndex} for GEO ID [${geoId}] in tab [${tab.name}]`);
          console.log(`[SYNC-DEBUG] Match found for GEO ID [${geoId}] at rowIndex [${rowIndex}] in tab [${tab.name}]`);
          break;
        }
      }

      if (rowIndex === -1) {
        console.log(`GEO ID ${geoId} not found in tab ${tab.name}, skipping`);
        continue;
      }

      // Prepare batch updates
      const updates: { range: string; values: (string | number)[][] }[] = [];

      // Add updates for changed fields
      if (changedFields.includes("salePrice")) {
        updates.push({
          range: `${tab.name}!${tab.columns.salePrice}${rowIndex}`,
          values: [[record["Extracted Sale Price"] ?? ""]],
        });
      }

      if (changedFields.includes("salePricePerSqm")) {
        updates.push({
          range: `${tab.name}!${tab.columns.salePricePerSqm}${rowIndex}`,
          values: [[record["Sale Price/Sqm"] ?? ""]],
        });
      }

      if (changedFields.includes("leasePrice")) {
        updates.push({
          range: `${tab.name}!${tab.columns.leasePrice}${rowIndex}`,
          values: [[record["Extracted Lease Price"] ?? ""]],
        });
      }

      if (changedFields.includes("leasePricePerSqm")) {
        updates.push({
          range: `${tab.name}!${tab.columns.leasePricePerSqm}${rowIndex}`,
          values: [[record["Lease Price/Sqm"] ?? ""]],
        });
      }

      if (changedFields.includes("notes")) {
        updates.push({
          range: `${tab.name}!${tab.columns.notes}${rowIndex}`,
          values: [[record["COMMENTS"] ?? ""]],
        });
      }

      if (changedFields.includes("dateUpdated")) {
        updates.push({
          range: `${tab.name}!${tab.columns.dateUpdated}${rowIndex}`,
          values: [[getColValue(record, "DATE UPDATED") ?? ""]],
        });
      }

      if (changedFields.includes("latLong")) {
        updates.push({
          range: `${tab.name}!${tab.columns.latLong}${rowIndex}`,
          values: [[getColValue(record, "LAT LONG") ?? ""]],
        });
      }

      if (changedFields.includes("lat")) {
        updates.push({
          range: `${tab.name}!${tab.columns.lat}${rowIndex}`,
          values: [[getColValue(record, "LAT") ?? ""]],
        });
      }

      if (changedFields.includes("long")) {
        updates.push({
          range: `${tab.name}!${tab.columns.long}${rowIndex}`,
          values: [[getColValue(record, "LONG") ?? ""]],
        });
      }

      if (changedFields.includes("monthlyDues") && tab.columns.monthlyDues) {
        updates.push({
          range: `${tab.name}!${tab.columns.monthlyDues}${rowIndex}`,
          values: [[getColValue(record, "MONTHLY DUES") ?? ""]],
        });
      }

      if (changedFields.includes("fbLink")) {
        updates.push({
          range: `${tab.name}!${tab.columns.fbLink}${rowIndex}`,
          values: [[getColValue(record, "FB LINK") ?? ""]],
        });
      }

      if (changedFields.includes("postLinkLuxe") && tab.columns.postLinkLuxe) {
        updates.push({ range: `${tab.name}!${tab.columns.postLinkLuxe}${rowIndex}`, values: [[getColValue(record, "BP") ?? ""]] });
      }
      if (changedFields.includes("postLinkNexia") && tab.columns.postLinkNexia) {
        updates.push({ range: `${tab.name}!${tab.columns.postLinkNexia}${rowIndex}`, values: [[getColValue(record, "BQ") ?? ""]] });
      }
      if (changedFields.includes("postLinkAdolf") && tab.columns.postLinkAdolf) {
        updates.push({ range: `${tab.name}!${tab.columns.postLinkAdolf}${rowIndex}`, values: [[getColValue(record, "BR") ?? ""]] });
      }
      if (changedFields.includes("postLinkPco") && tab.columns.postLinkPco) {
        updates.push({ range: `${tab.name}!${tab.columns.postLinkPco}${rowIndex}`, values: [[getColValue(record, "BS") ?? ""]] });
      }
      if (changedFields.includes("postLinkSloo") && tab.columns.postLinkSloo) {
        updates.push({ range: `${tab.name}!${tab.columns.postLinkSloo}${rowIndex}`, values: [[getColValue(record, "BT") ?? ""]] });
      }
      if (changedFields.includes("postLinkTaoke") && tab.columns.postLinkTaoke) {
        updates.push({ range: `${tab.name}!${tab.columns.postLinkTaoke}${rowIndex}`, values: [[getColValue(record, "BU") ?? ""]] });
      }
      if (changedFields.includes("mapVerified") && tab.columns.mapVerified) {
        const val = mapVerifiedValue;
        console.log(`Writing MAP VERIFIED to ${tab.name}!${tab.columns.mapVerified}${rowIndex}: [${val ?? ""}]`);
        updates.push({
          range: `${tab.name}!${tab.columns.mapVerified}${rowIndex}`,
          values: [[val ?? ""]],
        });
      }

      if (changedFields.includes("client") && tab.columns.client) {
        updates.push({
          range: `${tab.name}!${tab.columns.client}${rowIndex}`,
          values: [[record["BW"] ?? ""]],
        });
      }

      if (updates.length > 0) {
        console.log(`[SYNC-DEBUG] Sending ${updates.length} updates for [${geoId}] to [${tab.name}]:`, JSON.stringify(updates));
        console.log(`Updating ${updates.length} cells in ${tab.name}`);
        await sheetsBatchUpdate(token, SPREADSHEET_ID, updates);
        console.log(`Updated ${tab.name} successfully`);

        // --- BACKUP SYNC LOGIC ---
        // LUXE DBASE (Sheet1): Backup A-BW
        // LUXE COPY (Sheet2): Backup strictly A-Q only
        try {
          const colToNum = (col: string) => {
            let num = 0;
            for (let i = 0; i < col.length; i++) {
              num = num * 26 + (col.charCodeAt(i) - 64);
            }
            return num;
          };

          const limitCol = tab.name === "Sheet1" ? "BW" : "Q";
          const limitNum = colToNum(limitCol);

          // Filter updates based on the column limit for this specific tab's backup
          const filteredBackupUpdates = updates.filter(u => {
            // Extract the column letter from the range (e.g., "Sheet1!AS123" -> "AS")
            const match = u.range.match(/!([A-Z]+)/);
            if (!match) return false;
            const colLetter = match[1];
            return colToNum(colLetter) <= limitNum;
          });

          if (filteredBackupUpdates.length > 0) {
            const backupGeoRange = `${tab.name}!${tab.geoIdCol}:${tab.geoIdCol}`;
            const backupRows = await sheetsGet(token, SPREADSHEET_ID_BACKUP, backupGeoRange);
            let backupRowIndex = -1;
            for (let i = 0; i < backupRows.length; i++) {
              if (backupRows[i]?.[0]?.toString().trim() === geoId.toString().trim()) {
                backupRowIndex = i + 1;
                break;
              }
            }

            if (backupRowIndex !== -1) {
              const finalBackupUpdates = filteredBackupUpdates.map((u) => ({
                ...u,
                range: u.range.replace(/(\d+)$/, backupRowIndex.toString()),
              }));
              await sheetsBatchUpdate(token, SPREADSHEET_ID_BACKUP, finalBackupUpdates);
              console.log(`Mirrored ${filteredBackupUpdates.length} updates for ${tab.name} to backup spreadsheet (row ${backupRowIndex}) [Limit: ${limitCol}]`);
            } else {
              console.log(`GEO ID ${geoId} not found in backup ${tab.name}, skipping backup sync`);
            }
          } else {
            console.log(`No updates within ${limitCol} range for ${tab.name} backup, skipping`);
          }
        } catch (backupErr: any) {
          console.warn(`Backup sync failed for ${tab.name} (non-fatal):`, backupErr.message);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, geoId, changedFields }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
