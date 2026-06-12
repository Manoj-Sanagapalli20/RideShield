const { sendEmail } = require('../services/emailService');

const handleDisruptionPayout = async (data) => {
  const { userId, email, amount, disruptedHours, date, reason } = data;
  
  if (data.status === 'REJECTED') {
    console.log(`ℹ️ Skipping email notification for REJECTED claim for user ${userId} on ${date}`);
    return;
  }
  
  const subject = `💰 Disruption Payout Triggered - RideShield 🌧️`;
  
  const text = `Hello Driver ${userId},
  
We detected a significant disruption in your area on ${date} due to ${reason}. 
Since you were logged into the network during these ${disruptedHours} hours, an automatic insurance payout has been triggered.

Amount: ₹${amount}
Disruption Window: ${disruptedHours} hour(s) covered

The amount has been credited to your RideShield wallet. Thank you for your hard work!`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #4CAF50;">💰 Disruption Payout Triggered!</h2>
      <p>Hello Driver <strong>${userId}</strong>,</p>
      <p>We detected a significant disruption in your area on <strong>${date}</strong> due to <strong>${reason}</strong>.</p>
      <p>Since you were logged into the network during these <strong>${disruptedHours}</strong> hours, an automatic insurance payout has been triggered.</p>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Payout Amount:</strong> <span style="font-size: 20px; color: #e91e63;">₹${amount}</span></p>
        <p style="margin: 5px 0;"><strong>Covered Hours:</strong> ${disruptedHours} hrs</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
      </div>

      <p>The amount has been automatically credited to your RideShield wallet. No manual claim required!</p>
      <p>Stay safe out there! 🛡️</p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
      <p style="font-size: 12px; color: #888;">RideShield - Parametric Income Protection</p>
    </div>
  `;
  
  try {
    await sendEmail({ to: email, subject, text, html });
    console.log(`✅ Handled DISRUPTION_PAYOUT EMAIL for ${email} (₹${amount})`);
  } catch (err) {
    console.error(`❌ Failed to send disruption payout email to ${email}:`, err.message);
  }
};

module.exports = handleDisruptionPayout;
