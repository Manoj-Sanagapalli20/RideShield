const { sendEmail } = require('../services/emailService');
const paymentSuccessTemplate = require('../templates/paymentSuccess');

const handlePaymentSuccess = async (data) => {
  const { userId, amount, email, transactionId } = data;

  const subject = `✅ Payment Receipt - ${transactionId}`;
  const text = `Hello user ${userId}, your payment of ₹${amount} was successful. Transaction ID: ${transactionId}.`;
  const html = paymentSuccessTemplate({
    name: `User ${userId}`,
    amount,
    transactionId,
  });

  await sendEmail({
    to: email,
    subject,
    text,
    html,
  });

  console.log(`✅ Handled PAYMENT_SUCCESS for ${email}`);
};

module.exports = handlePaymentSuccess;