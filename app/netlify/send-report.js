/*
  Netlify Function: send-report
  ──────────────────────────────
  Receives a base64-encoded PDF from the Telematics Dashboard and emails it
  using Resend (https://resend.com). The Resend API key lives only in
  Netlify's environment variables — it is never sent to the browser.

  SETUP (see HOSTING_EMAIL_SETUP.md for the full walkthrough):
    1. Create a free Resend account, verify a sending domain (or use their
       shared onboarding@resend.dev sender for testing).
    2. Create an API key in Resend.
    3. In Netlify: Site settings -> Environment variables, add:
         RESEND_API_KEY   = re_xxxxxxxxxxxx
         REPORT_FROM      = SWITCH Reports <reports@yourdomain.com>
    4. Deploy. This file is auto-detected as long as it lives in
       netlify/functions/ and your netlify.toml points functions there
       (see netlify.toml in this project).
*/

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON body" };
  }

  const { to, subject, summary, fileName, pdfBase64 } = payload;

  if (!to || !pdfBase64) {
    return { statusCode: 400, body: "Missing required fields: to, pdfBase64" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.REPORT_FROM || "SWITCH Reports <onboarding@resend.dev>";

  if (!apiKey) {
    return { statusCode: 500, body: "Server is missing RESEND_API_KEY. Set it in Netlify environment variables." };
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject: subject || "Telematics Dashboard Report",
        html: `
          <p>Hi,</p>
          <p>Attached is the latest Telematics Dashboard report.</p>
          <p style="color:#525878">${summary || ""}</p>
          <p style="color:#9AA0BE;font-size:12px">Sent automatically from the SWITCH Telematics Dashboard.</p>
        `,
        attachments: [
          {
            filename: fileName || "telematics_report.pdf",
            content: pdfBase64, // Resend accepts a base64 string directly
          },
        ],
      }),
    });

    const resultText = await resp.text();
    if (!resp.ok) {
      return { statusCode: resp.status, body: `Resend API error: ${resultText}` };
    }

    return { statusCode: 200, body: resultText };
  } catch (err) {
    return { statusCode: 500, body: `Failed to send email: ${err.message}` };
  }
};
