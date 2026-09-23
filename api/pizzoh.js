export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const appsScriptUrl = process.env.PIZZOH_APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    return res.status(500).json({ ok: false, error: 'PIZZOH_APPS_SCRIPT_URL is missing' });
  }

  try {
    // Body may already be a string (text/plain) or a parsed object (application/json)
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({
        ok: false,
        error: 'Apps Script did not return JSON (status ' + response.status + '): ' + text.slice(0, 300),
      });
    }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
}
