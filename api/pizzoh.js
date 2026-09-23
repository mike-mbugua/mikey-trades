export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const appsScriptUrl = process.env.PIZZOH_APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    return res.status(500).json({ ok: false, error: 'PIZZOH_APPS_SCRIPT_URL is missing' });
  }

  try {
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Apps Script didn't return JSON — usually means the deployment
      // isn't public, or returned an HTML login/error page.
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
