const fs = require('fs');
const path = require('path');
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        process.env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
} catch (e) {
  console.warn('Failed to load local .env file manually:', e.message);
}
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001; // Using 5001 to avoid conflict with DummyRapido backend (which uses 5000)

app.use(cors());
app.use(express.json());

// Admin Auth Route for Admin Dashboard
app.post('/auth/admin/login', (req, res) => {
  const { passcode } = req.body;
  if (!passcode) {
    return res.status(400).json({ message: "Passcode is required" });
  }

  const expectedPasscode = process.env.ADMIN_PASSCODE || "RigvidaManoj29";
  if (passcode === expectedPasscode) {
    return res.status(200).json({ success: true, token: expectedPasscode });
  } else {
    return res.status(401).json({ message: "Invalid passcode. Access denied." });
  }
});

// Main Auth Route for User Dashboard
app.post('/auth/login', async (req, res) => {
  try {
    const { partnerId } = req.body;

    if (!partnerId) {
      return res.status(400).json({ message: "partnerId is required" });
    }

    const dummyRapidoUrl = process.env.DUMMYRAPIDO_URL || 'http://localhost:5000';
    const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5003';

    // Call the DummyRapido API to verify the partnerId
    const rapidoResponse = await axios.post(`${dummyRapidoUrl}/api/partners/login-partner-id`, {
      partnerId: partnerId
    });

    let hasPlan = false;
    try {
      // Query the PaymentService to check if this specific user has purchased a plan
      const paymentRes = await axios.get(`${paymentServiceUrl}/api/payments/status/${partnerId}`);
      if (paymentRes.data && paymentRes.data.hasPlan) {
        hasPlan = true;
      }
    } catch (paymentErr) {
      console.error("AuthService failed to reach PaymentService:", paymentErr.message);
    }

    // Attach true payment state to the client payload
    const finalResponse = {
      ...rapidoResponse.data,
      hasPlan
    };

    // If successful, pass the response data back to the User Dashboard
    res.status(200).json(finalResponse);
  } catch (error) {
    console.error("AuthService Login Error:", error.response?.data || error.message);
    
    // Pass along whatever error the DummyRapido API sent, or a generic 500
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ message: "Internal Auth Service Error" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`🔐 Auth Service is running on port ${PORT}`);
});
