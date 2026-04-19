const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'roi-calculator.html'));
});

const PORT = process.env.PORT || 3000;

function fmt(n) { return Math.round(n).toLocaleString(); }

app.post('/api/submit', async (req, res) => {
  const data = req.body;
  console.log('Submit received for:', data.email);

  // Google Sheets
  try {
    const { google } = require('googleapis');
    let key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const check = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'ROI Leads!A1:A1'
    }).catch(() => null);
    if (!check || !check.data.values) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'ROI Leads!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [['Timestamp','First Name','Last Name','Email','Company','Phone','Employees','Avg Salary','Health Premium','Stress %','Participation %','Turnover %','Absence Days','EAP %','Investment','Medical','Absence','Presenteeism','Turnover','WC','Annual','3-Year','ROI %','Payback']] }
      });
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'ROI Leads!A:X',
      valueInputOption: 'RAW',
      requestBody: { values: [[new Date().toISOString(), data.firstName, data.lastName, data.email, data.company, data.phone||'', data.employees, data.avgSalary, data.healthPremium, data.stressRate, data.participRate, data.turnoverRate, data.absDays, data.eapPct, data.investment, data.medSavings, data.absSavings, data.pressSavings, data.turnoverSavings, data.wcSavings, data.annualSavings, data.total3yr, data.netROI, data.paybackMonths]] }
    });
    console.log('Google Sheets: success');
  } catch(err) {
    console.error('Sheets error:', err.message);
  }

  // Email via SendGrid
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const html = `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;background:#fdfbf7;margin:0;color:#1c1917}
      .wrap{max-width:580px;margin:0 auto;padding:32px 20px}
      .hdr{background:#4a2040;color:white;border-radius:16px 16px 0 0;padding:28px 32px}
      .hdr h1{margin:0;font-size:22px;font-weight:800}
      .body{background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:28px 32px}
      .kpis{display:flex;gap:12px;margin:20px 0}
      .kpi{flex:1;background:#f9f7f4;border-radius:12px;padding:14px;text-align:center}
      .kpi b{display:block;font-size:22px;color:#4a2040}
      .kpi small{font-size:10px;text-transform:uppercase;color:#78716c}
      .dr{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0eeec;font-size:13px}
      .cta{background:#0f766e;color:white;display:block;text-align:center;padding:16px;border-radius:50px;font-weight:800;font-size:13px;text-decoration:none;margin:24px 0 0}
    </style></head><body><div class="wrap">
      <div class="hdr"><h1>skillfulmeans</h1><p style="margin:6px 0 0;opacity:.75">ROI Analysis — ${data.firstName} at ${data.company}</p></div>
      <div class="body">
        <p>Hi ${data.firstName},</p>
        <p>Here's your ROI analysis for a <strong>${parseInt(data.employees).toLocaleString()}-person workforce</strong>.</p>
        <div class="kpis">
          <div class="kpi"><b>$${fmt(data.total3yr)}</b><small>3-Year Impact</small></div>
          <div class="kpi"><b>${Math.round(data.netROI)}%</b><small>Net ROI</small></div>
          <div class="kpi"><b>${data.paybackMonths} mo</b><small>Payback</small></div>
        </div>
        <div class="dr"><span>Medical Claims</span><strong>$${fmt(data.medSavings)}</strong></div>
        <div class="dr"><span>Absenteeism</span><strong>$${fmt(data.absSavings)}</strong></div>
        <div class="dr"><span>Presenteeism</span><strong>$${fmt(data.pressSavings)}</strong></div>
        <div class="dr"><span>Turnover</span><strong>$${fmt(data.turnoverSavings)}</strong></div>
        <div class="dr" style="border:none"><span>Workers Comp</span><strong>$${fmt(data.wcSavings)}</strong></div>
        <div class="dr" style="border-top:2px solid #e5e7eb"><strong>Annual Savings</strong><strong>$${fmt(data.annualSavings)}</strong></div>
        <a href="https://calendly.com/skillfulmeans/skms-corporate-wellness-offerings-2" class="cta">Book a 15-Min Strategy Call →</a>
      </div>
    </div></body></html>`;

    // Send to broker
    await sgMail.send({
      to: data.email,
      from: { email: 'admin@skillfulmeans.life', name: 'SkillfulMeans' },
      subject: `Your SkillfulMeans ROI Analysis — ${data.company}`,
      html
    });
    console.log('Broker email: success');

    // Send lead notification
    if (process.env.NOTIFY_EMAIL) {
      await sgMail.send({
        to: process.env.NOTIFY_EMAIL,
        from: { email: 'admin@skillfulmeans.life', name: 'SkillfulMeans ROI' },
        subject: `New Lead: ${data.firstName} ${data.lastName} — ${data.company} ($${fmt(data.total3yr)})`,
        text: `New lead\n\nName: ${data.firstName} ${data.lastName}\nEmail: ${data.email}\nCompany: ${data.company}\nPhone: ${data.phone||'n/a'}\n\n3-Year Impact: $${fmt(data.total3yr)}\nROI: ${Math.round(data.netROI)}%\nPayback: ${data.paybackMonths} months\nAnnual Savings: $${fmt(data.annualSavings)}\n\nAdd to Notion CRM as Warmed up lead`
      });
      console.log('Lead notification: success');
    }
  } catch(err) {
    console.error('Email error:', err.message);
    if (err.response) console.error('SendGrid error details:', JSON.stringify(err.response.body));
  }

  res.json({ success: true });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => console.log(`SkillfulMeans ROI running on port ${PORT}`));
