export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  const appsScriptUrl = process.env.PIZZOH_APPS_SCRIPT_URL;

  if (!appsScriptUrl) {
    return res.status(500).json({
      ok: false,
      error: 'PIZZOH_APPS_SCRIPT_URL is missing'
    });
  }

  try {
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();

    return res.status(200).json({
      proxy_ok: true,
      apps_script_status: response.status,
      apps_script_response: text
    });

  } catch (error) {
    return res.status(500).json({
      proxy_ok: false,
      error: error.message || String(error)
    });
  }
}
