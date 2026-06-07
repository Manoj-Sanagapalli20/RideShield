const { sendEmail } = require('../services/emailService');
const floodAlertTemplate = require('../templates/floodAlert');

const handleFloodAlert = async (data) => {
  const { region, severity, users } = data;

  const subject = `🚨 Flood Alert for ${region}`;
  const text = `A ${severity} flood alert has been issued for ${region}. Please stay safe.`;
  const html = floodAlertTemplate({ region, severity });

  for (const user of users) {
    await sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });
  }

  console.log(`✅ Handled FLOOD_ALERT for region ${region} (${users.length} users notified)`);
};

module.exports = handleFloodAlert;