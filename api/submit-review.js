// Vercel Serverless Function — POST /api/submit-review
// Receives a guest-review JSON payload and emails it to reservations@bravohuatulco.com via Resend.

const { Resend } = require('resend');

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const b = req.body || {};

    if (!b.name || !b.email || !b.review) {
      return res.status(400).json({ error: 'Name, email and review are required.' });
    }
    const rating = parseInt(b.rating, 10);
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    // Honeypot
    if (b.website) return res.status(200).json({ ok: true });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY not set');
      return res.status(500).json({ error: 'Email service not configured.' });
    }

    const to   = process.env.INQUIRY_TO_EMAIL   || 'reservations@bravohuatulco.com';
    const from = process.env.INQUIRY_FROM_EMAIL || 'Bravo Huatulco <onboarding@resend.dev>';

    const resend = new Resend(apiKey);

    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    const rows = [
      ['Name',     b.name],
      ['Email',    b.email],
      ['Phone',    b.phone],
      ['Property', b.property],
      ['Stay Date',b.stayDate],
      ['Rating',   `${stars}  (${rating}/5)`],
    ];

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#0C1F3F;">
        <h2 style="font-family:Georgia,serif;color:#0C1F3F;margin:0 0 12px 0;">New Guest Review</h2>
        <p style="color:#6b7280;margin:0 0 20px 0;font-size:13px;">Pending moderation — posted to bravohuatulco.com once approved.</p>
        <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
          ${rows.map(([k,v]) => `
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="color:#6b7280;width:140px;vertical-align:top;"><strong>${esc(k)}</strong></td>
              <td style="color:#0C1F3F;">${k === 'Rating' ? `<span style="color:#C8A44D;font-size:18px;letter-spacing:2px;">${stars}</span>  <span style="color:#6b7280;">(${rating}/5)</span>` : (esc(v) || '<span style="color:#9ca3af;">—</span>')}</td>
            </tr>`).join('')}
        </table>
        <h3 style="font-family:Georgia,serif;color:#0C1F3F;margin:24px 0 8px 0;">Review</h3>
        <div style="background:#f9fafb;border-left:3px solid #C8A44D;padding:14px 16px;white-space:pre-wrap;font-size:14px;line-height:1.6;font-style:italic;">${esc(b.review)}</div>
        <p style="color:#9ca3af;margin:28px 0 0 0;font-size:12px;">Reply directly to this email to respond to ${esc(b.name)} at ${esc(b.email)}.</p>
      </div>`;

    const text = [
      'New Guest Review — bravohuatulco.com',
      '',
      ...rows.map(([k, v]) => `${k}: ${k === 'Rating' ? `${rating}/5 ${stars}` : (v || '—')}`),
      '',
      'Review:',
      b.review,
    ].join('\n');

    await resend.emails.send({
      from,
      to,
      replyTo: b.email,
      subject: `New Guest Review — ${b.property || 'Bravo Huatulco'} (${rating}★)`,
      html,
      text,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('submit-review error:', err);
    return res.status(500).json({ error: 'Failed to send. Please try again.' });
  }
};
