const floodAlertTemplate = ({ region, severity }) => {
  return `
    <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
      <div style="max-width:600px; margin:auto; background:white; border-radius:10px; padding:20px;">
        
        <h2 style="color:#dc2626;">🚨 Flood Alert</h2>

        <p>Dear User,</p>

        <p>
          A <b style="color:#dc2626;">${severity}</b> flood alert has been issued for 
          <b>${region}</b>.
        </p>

        <div style="background:#fef2f2; padding:15px; border-radius:8px; margin:20px 0;">
          <p><b>Region:</b> ${region}</p>
          <p><b>Severity:</b> ${severity}</p>
        </div>

        <p style="color:#374151;">
          Please take necessary precautions and stay safe.
        </p>

        <hr />

        <p style="font-size:13px; color:#9ca3af;">
          RideShield Alerts • Safety Notification System
        </p>
      </div>
    </div>
  `;
};

module.exports = floodAlertTemplate;