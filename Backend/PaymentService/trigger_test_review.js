const mongoose = require('mongoose');
require('dotenv').config();
const DisruptionPayout = require('./src/models/disruption_payout.model');

async function trigger() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected!");

    const testDriverId = 'wk_test123';
    const getIstToday = () => {
      const istTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      return istTime.getFullYear() + '-' + String(istTime.getMonth() + 1).padStart(2, '0') + '-' + String(istTime.getDate()).padStart(2, '0');
    };
    const targetDate = getIstToday();

    // Delete existing test claim for today if any
    await DisruptionPayout.deleteMany({ userId: testDriverId, date: targetDate });

    // Insert a new claim flagged for REVIEW
    const claim = new DisruptionPayout({
      userId: testDriverId,
      email: 'driver_test@rideshield.com',
      amount: 320.50,
      disruptedHours: 4,
      date: targetDate,
      reason: 'Flagged: High Device Fingerprint Cluster Score (Anomaly Score: 0.42)',
      status: 'REVIEW',
      priority: 'high',
      timestamp: new Date()
    });

    await claim.save();
    console.log(`\n🎉 Test claim created successfully!`);
    console.log(`Driver ID: ${testDriverId}`);
    console.log(`Date: ${targetDate}`);
    console.log(`Amount: ₹320.50`);
    console.log(`Status: REVIEW`);
    console.log(`Reason: ${claim.reason}\n`);
    console.log(`Go to the Admin Dashboard (http://localhost:3002) -> Claims Queue to audit it!`);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error("Error creating test claim:", err.message);
  }
}

trigger();
