export const config = { maxDuration: 120 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const appsScriptUrl = process.env.PIZZOH_APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    return res.status(500).json({ ok: false, error: 'PIZZOH_APPS_SCRIPT_URL is missing' });
  }

  // Body may arrive as a string (text/plain) or a parsed object (application/json)
  const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // Retry reads only. Never retry writes (saveTrade, savePlan, etc.)
  let fn = '';
  try { fn = JSON.parse(payload).fn || ''; } catch (e) {}
  const attempts = /^get/.test(fn) || fn === 'checkPending' ? 4 : 1;

  let lastText = '';
  let lastStatus = 0;

  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
      });
      lastStatus = response.status;
      lastText = await response.text();

      try {
        return res.status(200).json(JSON.parse(lastText));
      } catch (e) {
        // Not JSON: Google returned an HTML error page. Retry after a pause.
      }
    } catch (error) {
      lastText = error.message || String(error);
    }

    if (i < attempts - 1) await sleep(1000 * (i + 1));
  }

  return res.status(502).json({
    ok: false,
    error: 'Apps Script did not return JSON (status ' + lastStatus + '): ' + String(lastText).slice(0, 300),
  });
}
