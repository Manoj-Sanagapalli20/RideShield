const claimApprovedTemplate = ({ name, amount, claimId }) => {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
        
        <div style="max-width:600px; margin:auto; background:white; border-radius:12px; padding:24px;">
          
          <!-- Header -->
          <div style="text-align:center;">
            <h2 style="color:#16a34a;">🎉 Claim Approved</h2>
            <p style="color:#6b7280;">RideShield Insurance</p>
          </div>

          <hr style="margin:20px 0;" />

          <!-- Greeting -->
          <p style="font-size:16px;">Hi <b>${name}</b>,</p>

          <!-- Message -->
          <p style="font-size:15px; color:#374151;">
            Great news! Your insurance claim has been <b style="color:#16a34a;">approved</b>.
          </p>

          <!-- Details -->
          <div style="background:#f9fafb; padding:15px; border-radius:8px; margin:20px 0;">
            <p><b>Claim ID:</b> ${claimId}</p>
            <p><b>Approved Amount:</b> ₹${amount}</p>
            <p><b>Status:</b> <span style="color:#16a34a;">Approved</span></p>
            <p><b>Date:</b> ${new Date().toLocaleString()}</p>
          </div>

          <!-- CTA -->
          <div style="text-align:center; margin:20px 0;">
            <a href="http://localhost:5173/claims"
               style="display:inline-block; padding:12px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:6px;">
               View Claim Details
            </a>
          </div>

          <!-- Footer -->
          <hr style="margin:20px 0;" />

          <p style="font-size:14px; color:#6b7280;">
            The approved amount will be processed shortly to your registered account.
          </p>

          <p style="font-size:12px; color:#9ca3af; text-align:center;">
            © ${new Date().getFullYear()} RideShield • Secure Insurance Platform
          </p>

        </div>
      </body>
    </html>
  `;
};

module.exports = claimApprovedTemplate;