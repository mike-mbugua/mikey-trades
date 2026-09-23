export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  try {
    const response = await fetch(process.env.PIZZOH_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({
        ok: false,
        error: 'Apps Script returned an invalid response',
        raw: text.substring(0, 500)
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Proxy request failed'
    });
  }
}
