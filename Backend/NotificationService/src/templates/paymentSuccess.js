const paymentSuccessTemplate = ({ name, amount, transactionId }) => {
  return `
    <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
      <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; padding:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="text-align:center;">
          <h2 style="color:#16a34a; margin-bottom:10px;">✅ Payment Successful</h2>
          <p style="color:#6b7280; font-size:14px;">Thank you for using RideShield</p>
        </div>

        <hr style="margin:20px 0;" />

        <!-- Greeting -->
        <p style="font-size:16px; color:#111827;">
          Hi <b>${name}</b>,
        </p>

        <!-- Message -->
        <p style="font-size:15px; color:#374151;">
          Your payment of <b style="color:#16a34a;">₹${amount}</b> has been successfully processed.
        </p>

        <!-- Transaction Details -->
        <div style="background:#f9fafb; padding:16px; border-radius:8px; margin:20px 0;">
          <p style="margin:5px 0;"><b>Transaction ID:</b> ${transactionId}</p>
          <p style="margin:5px 0;"><b>Date:</b> ${new Date().toLocaleString()}</p>
          <p style="margin:5px 0;"><b>Status:</b> <span style="color:#16a34a;">Success</span></p>
        </div>

        <!-- CTA Button -->
        <div style="text-align:center; margin:20px 0;">
          <a href="https://rideshield.com/dashboard"
             style="display:inline-block; padding:12px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">
             View Dashboard
          </a>
        </div>

        <!-- Footer -->
        <hr style="margin:20px 0;" />

        <p style="font-size:13px; color:#6b7280; text-align:center;">
          If you did not make this payment, please contact support immediately.
        </p>

        <p style="font-size:12px; color:#9ca3af; text-align:center;">
          © ${new Date().getFullYear()} RideShield • Secure Payments
        </p>

      </div>
    </div>
  `;
};

module.exports = paymentSuccessTemplate;