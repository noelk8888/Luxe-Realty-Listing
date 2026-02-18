import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SPREADSHEET_ID = "1OYk_LGiLYb_ayGoVJ-tistDias2VdETdR60SP5ALBlo";

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
    },
  },
  {
    name: "SUPABASE",
    geoIdCol: "D",
    columns: {
      salePrice: "T",
      salePricePerSqm: "U",
      leasePrice: "V",
      leasePricePerSqm: "W",
      notes: "X",
      lotArea: "P",
      floorArea: "Q",
      dateUpdated: "AD",
      latLong: "AF",
      lat: "AG",
      long: "AH",
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
  range: string
): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
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
  updates: { range: string; values: (string | number)[][] }[]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`;
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
  try {
    // Only accept POST
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await req.json();
    console.log("Webhook payload:", JSON.stringify(body));

    // Support both direct payload and wrapped { record, old_record } format
    const record = body.record ?? body;
    const oldRecord = body.old_record ?? {};

    const geoId = record["GEO ID"];

    if (!geoId) {
      console.log("Missing GEO ID in payload");
      return new Response(
        JSON.stringify({ error: "Missing GEO ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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
    ];

    for (const field of fieldMappings) {
      if (record[field.db] !== oldRecord[field.db]) {
        changedFields.push(field.key);
      }
    }

    if (changedFields.length === 0) {
      console.log("No relevant fields changed, skipping");
      return new Response(
        JSON.stringify({ message: "No relevant fields changed" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing fields for GEO ID ${geoId}:`, changedFields);

    // Get Google credentials from Supabase secrets
    const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");

    if (!email || !privateKey) {
      throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY secrets");
    }

    // Get access token
    const token = await getAccessToken(email, privateKey);
    console.log("Got Google access token");

    // Update each tab
    for (const tab of TABS) {
      console.log(`Processing tab: ${tab.name}`);

      // Read the GEO ID column to find the row
      const geoRange = `${tab.name}!${tab.geoIdCol}:${tab.geoIdCol}`;
      const rows = await sheetsGet(token, geoRange);

      // Find the row index (1-based in Sheets)
      let rowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const cellValue = rows[i]?.[0]?.toString().trim();
        if (cellValue === geoId.toString().trim()) {
          rowIndex = i + 1; // Sheets rows are 1-based
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
          values: [[record["DATE UPDATED"] ?? ""]],
        });
      }

      if (changedFields.includes("latLong")) {
        updates.push({
          range: `${tab.name}!${tab.columns.latLong}${rowIndex}`,
          values: [[record["LAT LONG"] ?? ""]],
        });
      }

      if (changedFields.includes("lat")) {
        updates.push({
          range: `${tab.name}!${tab.columns.lat}${rowIndex}`,
          values: [[record["LAT"] ?? ""]],
        });
      }

      if (changedFields.includes("long")) {
        updates.push({
          range: `${tab.name}!${tab.columns.long}${rowIndex}`,
          values: [[record["LONG"] ?? ""]],
        });
      }

      if (updates.length > 0) {
        console.log(`Updating ${updates.length} cells in ${tab.name}`);
        await sheetsBatchUpdate(token, updates);
        console.log(`Updated ${tab.name} successfully`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, geoId, changedFields }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
