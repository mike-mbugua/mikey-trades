// api/pizzoh.js
//
// Proxies the frontend's calls through to the Apps Script web app.
//
// IMPORTANT: `maxDuration` below is only honored on Vercel plans that support it. On the
// Hobby plan, serverless functions are hard-capped at 10s regardless of this value — if your
// project is on Hobby, everything in this file has to fit inside that real 10s ceiling, not 120s.
// That's why retries are now few, short, and individually time-boxed rather than "try hard forever".
export const config = { maxDuration: 120 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A real doPost reply is {ok:false,error} or {ok:true,data}. Anything else (e.g. the doGet ping,
// or a Google consent/bot-check page) is invalid and should be retried or reported, not returned.
const isValid = (d) =>
  d && typeof d === 'object' && typeof d.ok === 'boolean' && (d.ok === false || 'data' in d);

// Give each individual fetch its own hard timeout, so one hanging attempt can't eat the whole
// function's time budget and turn into a 504 with zero useful error message.
const PER_ATTEMPT_TIMEOUT_MS = 7000;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const appsScriptUrl = process.env.PIZZOH_APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    return res.status(500).json({ ok: false, error: 'PIZZOH_APPS_SCRIPT_URL is missing' });
  }

  const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  let fn = '';
  try { fn = JSON.parse(payload).fn || ''; } catch (e) {}

  // Reads get a couple of short retries (Apps Script cold starts / transient hiccups are common);
  // writes get exactly one attempt — retrying a write risks double-submitting a trade or a plan.
  const isRead = /^get/.test(fn) || fn === 'checkPending';
  const attempts = isRead ? 2 : 1;
  const backoffMs = 400; // flat, short — not exponential. Keeps total worst case well under 10s.

  let lastText = '';
  let lastStatus = 0;

  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetchWithTimeout(
        appsScriptUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
            // A plain server-to-server fetch with no User-Agent/Accept looks unusual to some
            // abuse-detection layers. These are harmless to include and cheap insurance.
            'User-Agent': 'Mozilla/5.0 (compatible; PizzohProxy/1.0; +https://vercel.com)',
            Accept: 'application/json',
          },
          body: payload,
        },
        PER_ATTEMPT_TIMEOUT_MS
      );
      lastStatus = response.status;
      lastText = await response.text();

      let parsed = null;
      try { parsed = JSON.parse(lastText); } catch (e) {}

      if (isValid(parsed)) return res.status(200).json(parsed);

      console.log('[pizzoh] bad reply', fn, 'attempt', i + 1, 'status', lastStatus, lastText.slice(0, 150));
    } catch (error) {
      const timedOut = error.name === 'AbortError';
      lastText = timedOut
        ? `Request to Apps Script timed out after ${PER_ATTEMPT_TIMEOUT_MS}ms`
        : (error.message || String(error));
      console.log('[pizzoh] fetch error', fn, 'attempt', i + 1, lastText);
    }

    if (i < attempts - 1) await sleep(backoffMs);
  }

  return res.status(502).json({
    ok: false,
    error: 'Apps Script returned an invalid reply (status ' + lastStatus + '): ' + String(lastText).slice(0, 300),
  });
}
