const nodemailer = require('nodemailer');

let transporter;

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mailtrap.io';
const SMTP_PORT = process.env.SMTP_PORT || 2525;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'notifications@rideshield.com';

if (SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT == 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  console.log('📧 Email service initialized');
} else {
  console.warn('⚠️ SMTP credentials missing; emails will be mocked');
}

// ----------------------
// Universal Email Sender
// ----------------------
const sendEmail = async ({
  to,
  subject,
  text,
  html,
  template,
  data = {}
}) => {
  try {
    if (template && typeof template === 'function') {
      html = template(data);
    }

    if (!text && html) {
      text = html.replace(/<[^>]*>?/gm, '');
    }

    if (!transporter) {
      console.log(`
      📨 [Mock Email]
        To: ${to}
        Subject: ${subject}
        Content:
        ${text}
      `);
      return { success: true, mocked: true };
    }

    const mailOptions = {
      from: FROM_EMAIL,
      to,
      subject,
      text,
      html,
    };
    
    // console.log("HTML BEING SENT:\n", html); // Commented out to keep terminal clean
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to} | ID: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    throw error;
  }
};

module.exports = {
  sendEmail,
};