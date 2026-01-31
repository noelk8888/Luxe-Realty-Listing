import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SPREADSHEET_ID = "1OYk_LGiLYb_ayGoVJ-tistDias2VdETdR60SP5ALBlo";

// Tab configs: where GEO ID and STATUS live in each tab
const TABS = [
  { name: "Sheet1", geoIdCol: "AC", statusCol: "AQ" },
  { name: "SUPABASE", geoIdCol: "D", statusCol: "R" },
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

async function sheetsUpdate(
  token: string,
  range: string,
  values: string[][]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ range, values }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets PUT ${range} failed: ${res.status} ${errText}`);
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
    const newStatus = record["STATUS"];
    const oldStatus = oldRecord["STATUS"];

    if (!geoId || !newStatus) {
      console.log("Missing GEO ID or STATUS in payload");
      return new Response(
        JSON.stringify({ error: "Missing GEO ID or STATUS" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Skip if STATUS didn't actually change
    if (oldStatus && oldStatus === newStatus) {
      console.log(`STATUS unchanged for ${geoId}, skipping`);
      return new Response(
        JSON.stringify({ message: "STATUS unchanged, skipped" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing STATUS for GEO ID ${geoId}: "${oldStatus}" → "${newStatus}"`);

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

      // Update the STATUS cell
      const statusCell = `${tab.name}!${tab.statusCol}${rowIndex}`;
      console.log(`Updating ${statusCell} to "${newStatus}"`);
      await sheetsUpdate(token, statusCell, [[newStatus]]);
      console.log(`Updated ${statusCell} successfully`);
    }

    return new Response(
      JSON.stringify({ success: true, geoId, newStatus }),
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
