const { sendEmail } = require('../services/emailService');
const claimApprovedTemplate = require('../templates/claimApproved');

const handleClaimApproved = async (data) => {
  const { email, claimId, amount, userName } = data;
  
  const subject = `🛡️ Claim Approved - ${claimId}`;
  const text = `Your claim ${claimId} has been approved. You will receive a payout of ₹${amount} shortly.`;
  const html = claimApprovedTemplate({ userName, amount, claimId });
  
  await sendEmail({ to: email, subject, text, html });
  
  console.log(`✅ Handled CLAIM_APPROVED for ${email}`);
};

module.exports = handleClaimApproved;
