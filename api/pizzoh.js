export const config = { maxDuration: 120 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A real doPost reply is {ok:false,error} or {ok:true,data}. Anything else (e.g. the doGet ping) is invalid.
const isValid = (d) =>
  d && typeof d === 'object' && typeof d.ok === 'boolean' && (d.ok === false || 'data' in d);

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

      let parsed = null;
      try { parsed = JSON.parse(lastText); } catch (e) {}

      if (isValid(parsed)) return res.status(200).json(parsed);

      console.log('[pizzoh] bad reply', fn, 'attempt', i + 1, 'status', lastStatus, lastText.slice(0, 150));
    } catch (error) {
      lastText = error.message || String(error);
      console.log('[pizzoh] fetch error', fn, lastText);
    }

    if (i < attempts - 1) await sleep(1000 * (i + 1));
  }

  return res.status(502).json({
    ok: false,
    error: 'Apps Script returned an invalid reply (status ' + lastStatus + '): ' + String(lastText).slice(0, 300),
  });
}
