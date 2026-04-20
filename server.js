const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'roi-calculator.html'));
});

const PORT = process.env.PORT || 3000;
function fmt(n) { return Math.round(n).toLocaleString(); }

app.post('/api/submit', async (req, res) => {
  const data = req.body;
  console.log('Submit received for:', data.email);

  // ── Google Sheets ───────────────────────────────────────────────
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
      requestBody: { values: [[
        new Date().toISOString(),
        data.firstName, data.lastName, data.email, data.company, data.phone||'',
        data.employees, data.avgSalary, data.healthPremium,
        data.stressRate, data.participRate, data.turnoverRate,
        data.absDays, data.eapPct, data.investment, data.wellnessFund||0,
        data.medSavings, data.absSavings, data.pressSavings,
        data.turnoverSavings, data.wcSavings,
        data.annualSavings, data.total3yr, data.netROI, data.paybackMonths
      ]] }
    });
    console.log('Google Sheets: success');
  } catch(err) {
    console.error('Sheets error:', err.message);
  }

  // ── Email via SendGrid ──────────────────────────────────────────
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const brokerHtml = `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;background:#fdfbf7;margin:0;color:#1c1917}
      .wrap{max-width:580px;margin:0 auto;padding:32px 20px}
      .hdr{background:#4a2040;color:white;border-radius:16px 16px 0 0;padding:28px 32px}
      .hdr h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px}
      .hdr p{margin:6px 0 0;font-size:13px;opacity:.75}
      .body{background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:28px 32px}
      .kpis{display:flex;gap:12px;margin:20px 0}
      .kpi{flex:1;background:#f9f7f4;border-radius:12px;padding:14px;text-align:center;border:1px solid #e5e7eb}
      .kpi-val{display:block;font-size:22px;font-weight:800;color:#4a2040;margin-bottom:4px}
      .kpi-lbl{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#78716c}
      .section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#78716c;margin:20px 0 10px}
      .dr{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0eeec;font-size:13px}
      .dr-label{color:#57534e;font-weight:500}
      .dr-val{font-weight:800;color:#4a2040;margin-left:16px}
      .total-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:2px solid #e5e7eb;margin-top:4px}
      .total-label{font-weight:800;font-size:14px;color:#1c1917}
      .total-val{font-weight:800;font-size:16px;color:#4a2040;margin-left:16px}
      .disclaimer{background:#f9f7f4;border-left:3px solid #4a2040;border-radius:0 8px 8px 0;padding:12px 16px;font-size:12px;color:#57534e;line-height:1.6;margin:20px 0}
      .cta{background:#4a2040;color:#ffffff !important;display:block;text-align:center;padding:16px 24px;border-radius:50px;font-weight:800;font-size:14px;text-decoration:none;margin:24px 0 0;letter-spacing:.04em}
      .pdf-note{background:#f0fdf9;border:1px solid #6ee7b7;border-radius:12px;padding:12px 16px;font-size:12px;color:#065f46;margin:16px 0;text-align:center}
      .foot{text-align:center;font-size:11px;color:#a8a29e;margin-top:20px;line-height:1.6}
    </style></head><body><div class="wrap">
      <div class="hdr">
        <h1>skillfulmeans</h1>
        <p>Mental Fitness ROI Analysis &mdash; ${data.firstName} at ${data.company}</p>
      </div>
      <div class="body">
        <p style="font-size:15px;font-weight:600;margin-bottom:4px">Hi ${data.firstName},</p>
        <p style="font-size:14px;color:#57534e;line-height:1.6;margin-top:4px">Here's your ROI analysis for a <strong>${parseInt(data.employees).toLocaleString()}-person workforce</strong> at ${Math.round(data.participRate)}% program participation. Your full PDF report is attached.</p>
        ${(data.wellnessFund > 0) ? `<div style="background:#f0fdf9;border:1px solid #6ee7b7;border-radius:10px;padding:10px 14px;font-size:12px;color:#065f46;margin:12px 0"><strong>Wellness Fund Available:</strong> $${Math.round(data.wellnessFund).toLocaleString()} — estimated out-of-pocket after funding: <strong>$${Math.max(0,Math.round((data.investment||0)-(data.wellnessFund||0))).toLocaleString()}</strong></div>` : ''}

        <div class="kpis">
          <div class="kpi"><span class="kpi-val">$${fmt(data.total3yr)}</span><span class="kpi-lbl">3-Year Impact</span></div>
          <div class="kpi"><span class="kpi-val">${Math.round(data.netROI)}%</span><span class="kpi-lbl">Net ROI</span></div>
          <div class="kpi"><span class="kpi-val">${data.paybackMonths} mo</span><span class="kpi-lbl">Payback</span></div>
        </div>

        <div class="disclaimer">
          <strong>Full Engagement Model:</strong> These figures reflect a complete SkillfulMeans program including Leadership EQ, workshops, 14-day challenges, and wellness incentives. Want to experience the quality before the full investment? A single workshop starts at $1,500.
        </div>

        <p class="section-title">Annual Savings by Driver</p>
        <div class="dr"><span class="dr-label">Medical Claims Reduction</span><span class="dr-val">$${fmt(data.medSavings)}</span></div>
        <div class="dr"><span class="dr-label">Absenteeism Reduction</span><span class="dr-val">$${fmt(data.absSavings)}</span></div>
        <div class="dr"><span class="dr-label">Presenteeism Recovery</span><span class="dr-val">$${fmt(data.pressSavings)}</span></div>
        <div class="dr"><span class="dr-label">Voluntary Turnover Reduction</span><span class="dr-val">$${fmt(data.turnoverSavings)}</span></div>
        <div class="dr" style="border:none"><span class="dr-label">Workers&rsquo; Comp BH Comorbidity</span><span class="dr-val">$${fmt(data.wcSavings)}</span></div>
        <div class="total-row"><span class="total-label">Projected Annual Savings</span><span class="total-val">$${fmt(data.annualSavings)}</span></div>

        <div class="pdf-note">📎 Your full 3-page analysis with study citations and next steps is attached to this email.</div>

        <a href="https://calendly.com/skillfulmeans/skms-corporate-wellness-offerings-2" class="cta">Book a 15-Min Strategy Call &rarr;</a>

        <p style="font-size:12px;color:#78716c;margin-top:20px;line-height:1.6">Questions? Visit <a href="https://www.skillfulmeans.life" style="color:#4a2040;font-weight:600">skillfulmeans.life</a></p>
      </div>
      <div class="foot">skillfulmeans.life &middot; Confidential &mdash; prepared for broker use only</div>
    </div></body></html>`;

    // Build attachments array if PDF was sent
    const attachments = [];
    if (data.pdfBase64) {
      attachments.push({
        content: data.pdfBase64,
        filename: `SkillfulMeans-ROI-${(data.company||'Analysis').replace(/\s+/g,'-')}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment'
      });
    }

    // Broker confirmation email
    const brokerMsg = {
      to: data.email,
      from: { email: 'admin@skillfulmeans.life', name: 'SkillfulMeans' },
      subject: `Your SkillfulMeans ROI Analysis — ${data.company}`,
      html: brokerHtml
    };
    if (attachments.length > 0) brokerMsg.attachments = attachments;
    await sgMail.send(brokerMsg);
    console.log('Broker email: success');

    // Internal lead notification
    if (process.env.NOTIFY_EMAIL) {
      await sgMail.send({
        to: process.env.NOTIFY_EMAIL,
        from: { email: 'admin@skillfulmeans.life', name: 'SkillfulMeans ROI' },
        subject: `🎯 New Lead: ${data.firstName} ${data.lastName} — ${data.company} ($${fmt(data.total3yr)} 3-yr)`,
        text: `New lead from the SkillfulMeans ROI Calculator\n\nNAME: ${data.firstName} ${data.lastName}\nEMAIL: ${data.email}\nCOMPANY: ${data.company}\nPHONE: ${data.phone||'Not provided'}\n\nANALYSIS:\n  Employees: ${parseInt(data.employees).toLocaleString()}\n  Participation: ${data.participRate}%\n  Investment: $${fmt(data.investment)}/year\n\n  Annual Savings: $${fmt(data.annualSavings)}\n  3-Year Impact: $${fmt(data.total3yr)}\n  Net ROI: ${Math.round(data.netROI)}%\n  Payback: ${data.paybackMonths} months\n\nNEXT STEP: Add to Notion CRM as "Warmed up lead"`
      });
      console.log('Lead notification: success');
    }

  } catch(err) {
    console.error('Email error:', err.message);
    if (err.response) console.error('SendGrid details:', JSON.stringify(err.response.body));
  }

  res.json({ success: true });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => console.log(`SkillfulMeans ROI running on port ${PORT}`));
