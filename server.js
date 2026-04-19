const express = require('express');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const express = require('express');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'roi-calculator.html'));
});
// ── CONFIG (set these in Railway environment variables) ────────────
const PORT                = process.env.PORT || 3000;
const GOOGLE_SHEET_ID     = process.env.GOOGLE_SHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY  = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const NOTIFY_EMAIL        = process.env.NOTIFY_EMAIL;   // e.g. heather@skillfulmeans.life
const SMTP_HOST           = process.env.SMTP_HOST;       // e.g. smtp.gmail.com
const SMTP_USER           = process.env.SMTP_USER;       // sending gmail address
const SMTP_PASS           = process.env.SMTP_PASS;       // gmail app password

// ── GOOGLE SHEETS HELPER ───────────────────────────────────────────
async function appendToSheet(data) {
  const auth = new google.auth.JWT(
    GOOGLE_CLIENT_EMAIL,
    null,
    GOOGLE_PRIVATE_KEY,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  const sheets = google.sheets({ version: 'v4', auth });

  // Create header row if sheet is empty
  const check = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: 'ROI Leads!A1:A1',
  }).catch(() => null);

  if (!check || !check.data.values) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: 'ROI Leads!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'Timestamp','First Name','Last Name','Email','Company','Phone',
          'Employees','Avg Salary ($)','Health Premium ($)',
          'Stress Rate (%)','Participation Rate (%)','Turnover Rate (%)',
          'Absence Days','EAP Utilization (%)','SM Investment ($)',
          'Medical Savings ($)','Absence Savings ($)','Presenteeism Savings ($)',
          'Turnover Savings ($)','WC Savings ($)',
          'Annual Savings ($)','3-Year Total ($)','Net ROI (%)','Payback (months)'
        ]]
      }
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: 'ROI Leads!A:X',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        new Date().toISOString(),
        data.firstName, data.lastName, data.email, data.company, data.phone || '',
        data.employees, data.avgSalary, data.healthPremium,
        data.stressRate, data.participRate, data.turnoverRate,
        data.absDays, data.eapPct, data.investment,
        data.medSavings, data.absSavings, data.pressSavings,
        data.turnoverSavings, data.wcSavings,
        data.annualSavings, data.total3yr, data.netROI, data.paybackMonths
      ]]
    }
  });
}

// ── EMAIL HELPER ───────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransporter({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

function fmt(n) { return Math.round(n).toLocaleString(); }

async function sendBrokerEmail(data) {
  const transporter = createTransporter();
  const html = `
<!DOCTYPE html><html><head><style>
  body{font-family:Arial,sans-serif;background:#fdfbf7;margin:0;padding:0;color:#1c1917}
  .wrap{max-width:580px;margin:0 auto;padding:32px 20px}
  .hdr{background:#4a2040;color:white;border-radius:16px 16px 0 0;padding:28px 32px}
  .hdr h1{margin:0;font-size:22px;font-weight:800}
  .hdr p{margin:6px 0 0;font-size:13px;opacity:.75}
  .body{background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:28px 32px}
  .kpi-row{display:flex;gap:12px;margin:20px 0}
  .kpi{flex:1;background:#f9f7f4;border-radius:12px;padding:14px;text-align:center}
  .kpi .val{font-size:22px;font-weight:800;color:#4a2040;display:block}
  .kpi .lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#78716c;display:block;margin-top:3px}
  .dr{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0eeec}
  .dr .dn{font-size:12px;font-weight:600}
  .dr .dv{font-size:13px;font-weight:800;color:#4a2040}
  .cta{background:#0f766e;color:white;display:block;text-align:center;padding:16px;border-radius:50px;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:.08em;text-decoration:none;margin:24px 0 0}
  .foot{text-align:center;font-size:11px;color:#a8a29e;margin-top:20px}
</style></head><body><div class="wrap">
  <div class="hdr"><h1>skillfulmeans</h1><p>Mental Fitness ROI Analysis — ${data.firstName} at ${data.company}</p></div>
  <div class="body">
    <p style="font-size:15px;font-weight:600">Hi ${data.firstName},</p>
    <p style="font-size:14px;color:#57534e;line-height:1.6">Here's your ROI analysis for a <strong>${parseInt(data.employees).toLocaleString()}-person workforce</strong> at ${Math.round(data.participRate)}% program participation. Download the PDF from the calculator for the full 3-page broker report.</p>
    <div class="kpi-row">
      <div class="kpi"><span class="val">$${fmt(data.total3yr)}</span><span class="lbl">3-Year Impact</span></div>
      <div class="kpi"><span class="val">${Math.round(data.netROI)}%</span><span class="lbl">Net ROI</span></div>
      <div class="kpi"><span class="val">${data.paybackMonths} mo</span><span class="lbl">Payback</span></div>
    </div>
    <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#78716c;margin:20px 0 10px">Annual Savings by Driver</p>
    <div class="dr"><span class="dn">Medical Claims Reduction</span><span class="dv">$${fmt(data.medSavings)}</span></div>
    <div class="dr"><span class="dn">Absenteeism Reduction</span><span class="dv">$${fmt(data.absSavings)}</span></div>
    <div class="dr"><span class="dn">Presenteeism Recovery</span><span class="dv">$${fmt(data.pressSavings)}</span></div>
    <div class="dr"><span class="dn">Voluntary Turnover Reduction</span><span class="dv">$${fmt(data.turnoverSavings)}</span></div>
    <div class="dr" style="border:none"><span class="dn">Workers' Comp BH Comorbidity</span><span class="dv">$${fmt(data.wcSavings)}</span></div>
    <div class="dr" style="border-top:2px solid #e5e7eb;margin-top:4px"><strong>Projected Annual Savings</strong><span class="dv">$${fmt(data.annualSavings)}</span></div>
    <a href="https://calendly.com/skillfulmeans/skms-corporate-wellness-offerings-2" class="cta">Book a 15-Min Strategy Call →</a>
    <p style="font-size:12px;color:#78716c;margin-top:20px;line-height:1.6">Questions? Visit <a href="https://www.skillfulmeans.life" style="color:#4a2040">skillfulmeans.life</a></p>
  </div>
  <div class="foot">skillfulmeans.life · Confidential — prepared for broker use only</div>
</div></body></html>`;

  await transporter.sendMail({
    from: `"SkillfulMeans" <${SMTP_USER}>`,
    to: data.email,
    subject: `Your SkillfulMeans ROI Analysis — ${data.company}`,
    html
  });
}

async function sendLeadNotification(data) {
  if (!NOTIFY_EMAIL) return;
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"SkillfulMeans ROI Tool" <${SMTP_USER}>`,
    to: NOTIFY_EMAIL,
    subject: `🎯 New ROI Lead: ${data.firstName} ${data.lastName} — ${data.company} ($${fmt(data.total3yr)} 3-yr)`,
    text: `
New lead from the SkillfulMeans ROI Calculator

NAME:     ${data.firstName} ${data.lastName}
EMAIL:    ${data.email}
COMPANY:  ${data.company}
PHONE:    ${data.phone || 'Not provided'}

ANALYSIS:
  Employees:        ${parseInt(data.employees).toLocaleString()}
  Avg Salary:       $${fmt(data.avgSalary)}
  Participation:    ${data.participRate}%
  SM Investment:    $${fmt(data.investment)}/year

  Annual Savings:   $${fmt(data.annualSavings)}
  3-Year Impact:    $${fmt(data.total3yr)}
  Net ROI:          ${Math.round(data.netROI)}%
  Payback:          ${data.paybackMonths} months

NEXT STEP: Add to Notion CRM → "Warmed up lead"
    `.trim()
  });
}

// ── API ROUTE ──────────────────────────────────────────────────────
app.post('/api/submit', async (req, res) => {
  try {
    const data = req.body;

    // Save to Google Sheets
    if (GOOGLE_SHEET_ID && GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY) {
      await appendToSheet(data);
    }

    // Send broker confirmation email
    if (SMTP_USER && SMTP_PASS && data.email) {
      await sendBrokerEmail(data);
    }

    // Send internal lead notification to Heather
    if (SMTP_USER && SMTP_PASS && NOTIFY_EMAIL) {
      await sendLeadNotification(data);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── HEALTH CHECK ───────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`SkillfulMeans ROI running on port ${PORT}`));
