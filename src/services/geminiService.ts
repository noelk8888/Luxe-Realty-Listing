/**
 * Slim Gemini client for Luxe Listing.
 * Calls the Gemini REST API directly from the browser.
 * Copied and trimmed from /repos/ReOrganize Listing/src/services/geminiService.ts
 */

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Browser-exposed API key (set VITE_GEMINI_API_KEY in Vercel / .env.local)
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

export interface ReorganizedOutputs {
  output1: string;
  output2: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 4000;

function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const status = (error as { httpStatus?: number }).httpStatus;
    // Explicit non-retryable: 400 Bad Request, 401 Unauthorized, 403 Forbidden
    if (status !== undefined) return status !== 400 && status !== 401 && status !== 403;
    // No httpStatus = raw fetch/network error or cold-start timeout → always retry
    return true;
  }
  return true;
}

function parseJson(text: string): ReorganizedOutputs {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fence ? fence[1].trim() : text.trim()) as ReorganizedOutputs;
}

async function callGeminiDirect(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  if (response.ok) {
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response.');
    return text;
  }

  const body = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } })) as { error?: { message?: string } };
  const msg = body?.error?.message || `HTTP ${response.status}`;
  const err = Object.assign(new Error(`[${response.status}] ${msg}`), { httpStatus: response.status });
  throw err;
}

/**
 * Extracts output2 (Client Version) from a raw listing text.
 * Retries up to 4× on any transient error (network, 429, 5xx, cold-start).
 */
export async function extractClientVersion(prompt: string): Promise<ReorganizedOutputs> {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not set. Add it to .env.local and Vercel environment variables.');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const text = await callGeminiDirect(prompt, apiKey);
      return parseJson(text);
    } catch (error) {
      lastError = error;
      if (isRetryable(error) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[geminiService] Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
