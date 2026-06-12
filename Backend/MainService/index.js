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
const amqp = require('amqplib');
const axios = require('axios');

const app = express();
const PORT = 5005;

let channel;

const connectQueue = async () => {
    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    let attempt = 0;

    while (true) {
        try {
            attempt++;
            console.log(`MainService connecting to RabbitMQ (Attempt ${attempt})...`);
            const conn = await amqp.connect(url);

            conn.on("error", (err) => {
                console.error("MainService RabbitMQ connection error:", err.message);
            });
            conn.on("close", () => {
                console.log("MainService RabbitMQ connection closed. Reconnecting in 5 seconds...");
                channel = null;
                setTimeout(connectQueue, 5000);
            });

            channel = await conn.createChannel();
            channel.on("error", (err) => {
                console.error("MainService RabbitMQ channel error:", err.message);
            });

            await channel.assertQueue('ml.disruptions.processed', { durable: true });

            // Setup Pub/Sub for Payout Events
            await channel.assertExchange('disruption_payout_fanout', 'fanout', { durable: true });
            await channel.assertQueue('notification.disruption', { durable: true });
            await channel.assertQueue('payment.disruption', { durable: true });

            // Bind them for Pub/Sub
            await channel.bindQueue('notification.disruption', 'disruption_payout_fanout', '');
            await channel.bindQueue('payment.disruption', 'disruption_payout_fanout', '');

            console.log('✅ MainService connected to RabbitMQ (CloudAMQP) - Pub/Sub Ready');

            channel.consume('ml.disruptions.processed', async (msg) => {
                if (msg !== null) {
                    try {
                        const data = JSON.parse(msg.content.toString());
                        await processCompensation(data);
                    } catch (e) {
                        console.error("Payload parse error:", e);
                    }
                    channel.ack(msg);
                }
            });
            return;
        } catch (err) {
            console.warn(`⚠️ MainService RabbitMQ connection attempt ${attempt} failed: ${err.message}. Retrying in 3 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
};

const publishToPaymentQueue = (payoutEvent) => {
    if (channel) {
        try {
            const messageBuffer = Buffer.from(JSON.stringify(payoutEvent));
            channel.publish('disruption_payout_fanout', '', messageBuffer, { persistent: true });
            console.log(`📡 Disruption event published to 'disruption_payout_fanout':\n`, JSON.stringify(payoutEvent, null, 2));
        } catch (publishErr) {
            console.error("Failed to publish event to fanout queue:", publishErr.message);
        }
    } else {
        console.warn("Could not publish event: RabbitMQ channel is offline");
    }
};

const processCompensation = async (data) => {
    const { userId, email, results } = data || {};

    if (!userId || !results) {
        console.log(`[User: Unknown] [NO DATA FOUND] Received an empty or corrupted message from RabbitMQ.`);
        return;
    }

    const { date, disruptionsByType } = results;
    const dummyRapidoUrl = process.env.DUMMYRAPIDO_URL || 'http://localhost:5000';

    let driverEmail = email;
    if (!driverEmail) {
        try {
            const profileRes = await axios.get(`${dummyRapidoUrl}/api/partners/profile/${userId}`);
            if (profileRes.data && profileRes.data.partner) {
                driverEmail = profileRes.data.partner.email;
            }
        } catch (profileErr) {
            console.warn(`Could not fetch driver profile for ${userId} to get email:`, profileErr.message);
        }
    }

    // Merge all possible weather and social strike disruptions
    const allDisruptions = [...(disruptionsByType.weather || []), ...(disruptionsByType.social || [])];

    if (allDisruptions.length === 0) {
        console.log(`[User: ${userId}] [NO DATA FOUND] Location clear for ${date}. No disruption events detected by ML.`);
        const rejectEvent = {
            userId,
            email: driverEmail || 'driver@rideshield.com',
            amount: "0.00",
            disruptedHours: 0,
            date,
            status: 'REJECTED',
            reason: 'Rejected: Clear weather and no strike disruptions officially detected.',
            timestamp: new Date().toISOString()
        };
        publishToPaymentQueue(rejectEvent);
        return;
    }

    try {
        console.log(`[User: ${userId}] ML Model flagged ${allDisruptions.length} disruption event(s)! Checking API Rapido logs...`);

        // Securely fetch DummyRapido hourly activity for cross validation
        const logRes = await axios.get(`${dummyRapidoUrl}/api/partners/daily-logs/${userId}/${date}`);
        const logData = logRes.data.log;

        if (!logData || !logData.hourlyActivity || logData.hourlyActivity.length === 0) {
            console.log(`[User: ${userId}] Rapido returned zero hours logged. No payout required.`);
            const rejectEvent = {
                userId,
                email: driverEmail || 'driver@rideshield.com',
                amount: "0.00",
                disruptedHours: 0,
                date,
                status: 'REJECTED',
                reason: 'Rejected: Driver was offline / did not log shift activity during the disruption window.',
                timestamp: new Date().toISOString()
            };
            publishToPaymentQueue(rejectEvent);
            return;
        }

        // Build a Set of disrupted hours to avoid double-counting overlapping events
        const disruptedHoursSet = new Set();
        allDisruptions.forEach(disruption => {
            const [startStr, endStr] = disruption.time.split('-');
            const startHour = parseInt(startStr.split(':')[0]);
            const endHour = parseInt(endStr.split(':')[0]);
            for (let h = startHour; h < endHour; h++) {
                disruptedHoursSet.add(h);
            }
        });

        let trigger1Hours = 0;
        let trigger2Hours = 0;

        logData.hourlyActivity.forEach(activity => {
            if (activity.isOnline === true) {
                const timeSlot = activity.timeSlot || "00:00";

                // Parse starting hour from the start part of the timeSlot string
                const startPart = timeSlot.split('-')[0].trim();
                let actHour = parseInt(startPart.split(':')[0]);
                if (startPart.toLowerCase().includes('pm') && actHour < 12) {
                    actHour += 12;
                } else if (startPart.toLowerCase().includes('am') && actHour === 12) {
                    actHour = 0;
                }

                if (disruptedHoursSet.has(actHour)) {
                    const rides = activity.ridesAccepted !== undefined ? activity.ridesAccepted : 0;
                    if (rides === 0) {
                        trigger1Hours++; // Trigger 1: Online but 0 rides accepted
                    } else if (rides > 0 && rides <= 1) {
                        trigger2Hours++; // Trigger 2: Online but stuck/delayed (rides <= 1)
                    }
                }
            }
        });

        const disruptedHours = trigger1Hours + trigger2Hours;
        const totalLoginHours = logData.hourlyActivity.filter(a => a.isOnline === true).length;

        if (disruptedHours > 0) {
            // Formula specified precisely: Payout = (Daily Wage ÷ Login Hours) × Total Disrupted Hours
            const simulatedDailyWage = 600; // Mocked Hackathon flat wage baseline average
            const effectiveHours = totalLoginHours > 0 ? totalLoginHours : 1;
            const payout = (simulatedDailyWage / effectiveHours) * disruptedHours;

            console.log(`\n=============================================================`);
            console.log(`💸 INSURANCE CLAIM PAYOUT VERIFIED & TRIGGERED! (Rapido Network)`);
            console.log(`=============================================================`);
            console.log(`Driver ID:        ${userId}`);
            console.log(`Date:             ${date}`);
            console.log(`Total Shifts:     ${totalLoginHours} hrs on Rapido network`);
            console.log(`Disrupted Hours:  ${disruptedHours} hrs total`);
            console.log(`  - Trigger 1 (Zero Trips):      ${trigger1Hours} hrs`);
            console.log(`  - Trigger 2 (Severe Congestion): ${trigger2Hours} hrs`);
            console.log(`Calculated Fund:  ₹${payout.toFixed(2)} automatically dispatched!`);
            console.log(`=============================================================\n`);

            const payoutEvent = {
                userId,
                email: driverEmail || 'driver@rideshield.com',
                amount: payout.toFixed(2),
                disruptedHours,
                date,
                status: 'PROCESSED',
                reason: allDisruptions
                    .map(d => `${d.type.charAt(0).toUpperCase() + d.type.slice(1)} Disruption (${d.time})`)
                    .join(', '),
                timestamp: new Date().toISOString()
            };

            publishToPaymentQueue(payoutEvent);

        } else {
            console.log(`[User: ${userId}] Driver was active but had normal ride counts, or was completely offline during the rain/strike window.`);
            const rejectEvent = {
                userId,
                email: driverEmail || 'driver@rideshield.com',
                amount: "0.00",
                disruptedHours: 0,
                date,
                status: 'REJECTED',
                reason: 'Rejected: Normal ride count (rides > 1) accepted during disruption window.',
                timestamp: new Date().toISOString()
            };
            publishToPaymentQueue(rejectEvent);
        }

    } catch (err) {
        console.error(`Failed to pull API DummyRapido data for user ${userId}:`, err.message);
    }
};

app.listen(PORT, () => {
    console.log(`🚀 MainService Core executing on port ${PORT}`);
    connectQueue();
});
