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
            channel.on("close", () => {
                console.log("MainService RabbitMQ channel closed. Closing connection to trigger reconnect...");
                if (conn) {
                    conn.close().catch(() => {});
                }
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

    const policyServiceUrl = process.env.POLICY_SERVICE_URL || 'http://localhost:5002';
    let dailyWage = 600; // Default fallback wage if service is down
    let hasActivePolicy = true;

    try {
        console.log(`[User: ${userId}] Querying PolicyService for active plan...`);
        const policyRes = await axios.get(`${policyServiceUrl}/api/policy/user/${userId}`);
        if (policyRes.data && policyRes.data.dailyWage) {
            dailyWage = policyRes.data.dailyWage;
            console.log(`[User: ${userId}] Active policy found: Plan ${policyRes.data.planName}, Daily Wage Protected: ₹${dailyWage}`);
        }
    } catch (policyErr) {
        if (policyErr.response && policyErr.response.status === 404) {
            console.log(`[User: ${userId}] No active policy found in PolicyService.`);
            hasActivePolicy = false;
        } else {
            console.warn(`[User: ${userId}] PolicyService call failed: ${policyErr.message}. Falling back to standard wage ₹600.`);
        }
    }

    if (!hasActivePolicy) {
        console.log(`[User: ${userId}] Claim rejected: No active insurance policy.`);
        const rejectEvent = {
            userId,
            email: driverEmail || 'driver@rideshield.com',
            amount: "0.00",
            disruptedHours: 0,
            date,
            status: 'REJECTED',
            reason: 'Rejected: No active RideShield policy found for this driver.',
            timestamp: new Date().toISOString()
        };
        publishToPaymentQueue(rejectEvent);
        return;
    }

    // Merge all possible weather and social strike disruptions
    const allDisruptions = [...(disruptionsByType.weather || []), ...(disruptionsByType.social || [])];

    // Fetch shift activity first to display online slots in all rejections
    let logData = null;
    let onlineHoursList = [];
    let logPullSuccess = false;
    try {
        console.log(`[User: ${userId}] Checking API Rapido logs for shift activity...`);
        const logRes = await axios.get(`${dummyRapidoUrl}/api/partners/daily-logs/${userId}/${date}`);
        logData = logRes.data.log;
        logPullSuccess = true;
        if (logData && logData.hourlyActivity) {
            logData.hourlyActivity.forEach(activity => {
                if (activity.isOnline === true) {
                    let slot = activity.timeSlot || "00:00";
                    if (!slot.includes("-")) {
                        const startHr = parseInt(slot.split(':')[0]);
                        const endHr = startHr + 1;
                        const formatHr = (h) => `${String(h).padStart(2, '0')}:00`;
                        slot = `${formatHr(startHr)}-${formatHr(endHr)}`;
                    }

                    // Check if date is today and if slot hour is in the future (in IST timezone)
                    const startPart = slot.split('-')[0].trim();
                    let slotHour = parseInt(startPart.split(':')[0]);
                    if (startPart.toLowerCase().includes('pm') && slotHour < 12) {
                        slotHour += 12;
                    } else if (startPart.toLowerCase().includes('am') && slotHour === 12) {
                        slotHour = 0;
                    }

                    const istOffset = 5.5 * 60 * 60 * 1000;
                    const istTime = new Date(Date.now() + istOffset);
                    const istDateStr = istTime.toISOString().split('T')[0];
                    const currentIstHour = istTime.getUTCHours();

                    if (date === istDateStr && slotHour > currentIstHour) {
                        return; // Skip future shift hour
                    }

                    onlineHoursList.push(slot);
                }
            });
        }
    } catch (err) {
        console.error(`Failed to pull API DummyRapido data for user ${userId}:`, err.message);
    }

    const shiftStr = onlineHoursList.length > 0 ? onlineHoursList.join(', ') : '';

    if (!logPullSuccess) {
        console.error(`[User: ${userId}] Skipping compensation check due to Rapido log pull failure.`);
        return;
    }

    if (allDisruptions.length === 0) {
        console.log(`[User: ${userId}] [NO DATA FOUND] Location clear for ${date}. No disruption events detected by ML.`);
        const reasonStr = shiftStr 
            ? `Rejected: Clear weather and no strike disruptions officially detected. (Shift: ${shiftStr})`
            : `Rejected: Clear weather and no strike disruptions officially detected. (Driver Offline)`;
        const rejectEvent = {
            userId,
            email: driverEmail || 'driver@rideshield.com',
            amount: "0.00",
            disruptedHours: 0,
            date,
            status: 'REJECTED',
            reason: reasonStr,
            timestamp: new Date().toISOString()
        };
        publishToPaymentQueue(rejectEvent);
        return;
    }

    if (!logData || !logData.hourlyActivity || onlineHoursList.length === 0) {
        console.log(`[User: ${userId}] Rapido returned zero hours logged. No payout required.`);
        const rejectEvent = {
            userId,
            email: driverEmail || 'driver@rideshield.com',
            amount: "0.00",
            disruptedHours: 0,
            date,
            status: 'REJECTED',
            reason: 'Rejected: Driver was offline / did not log shift activity for the day.',
            timestamp: new Date().toISOString()
        };
        publishToPaymentQueue(rejectEvent);
        return;
    }

    try {
        console.log(`[User: ${userId}] ML Model flagged ${allDisruptions.length} disruption event(s)! Checking API Rapido logs...`);

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

                // Check future hour in IST
                const istOffset = 5.5 * 60 * 60 * 1000;
                const istTime = new Date(Date.now() + istOffset);
                const istDateStr = istTime.toISOString().split('T')[0];
                const currentIstHour = istTime.getUTCHours();

                if (date === istDateStr && actHour > currentIstHour) {
                    return; // Skip future hour
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
        const totalLoginHours = onlineHoursList.length;

        if (disruptedHours > 0) {
            // Formula specified precisely: Payout = (Daily Wage ÷ Login Hours) × Total Disrupted Hours
            const effectiveHours = totalLoginHours > 0 ? totalLoginHours : 1;
            const payout = (dailyWage / effectiveHours) * disruptedHours;

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
            
            // Format the disruptions string
            const disruptionStr = allDisruptions
                .map(d => `${d.type.charAt(0).toUpperCase() + d.type.slice(1)}: ${d.time}`)
                .join(', ');

            // Check overlap
            let hasShiftOverlap = false;
            logData.hourlyActivity.forEach(activity => {
                if (activity.isOnline === true) {
                    const timeSlot = activity.timeSlot || "00:00";
                    const startPart = timeSlot.split('-')[0].trim();
                    let actHour = parseInt(startPart.split(':')[0]);
                    if (startPart.toLowerCase().includes('pm') && actHour < 12) {
                        actHour += 12;
                    } else if (startPart.toLowerCase().includes('am') && actHour === 12) {
                        actHour = 0;
                    }

                    // Check future hour in IST
                    const istOffset = 5.5 * 60 * 60 * 1000;
                    const istTime = new Date(Date.now() + istOffset);
                    const istDateStr = istTime.toISOString().split('T')[0];
                    const currentIstHour = istTime.getUTCHours();

                    if (date === istDateStr && actHour > currentIstHour) {
                        return; // Skip future hour
                    }

                    if (disruptedHoursSet.has(actHour)) {
                        hasShiftOverlap = true;
                    }
                }
            });

            let rejectReason = '';
            if (!hasShiftOverlap) {
                rejectReason = `Rejected: Driver was offline / did not log shift activity during the disruption window. (Shift: ${shiftStr}, Disruption: ${disruptionStr})`;
            } else {
                rejectReason = `Rejected: Normal ride count (rides > 1) accepted during disruption window. (Shift: ${shiftStr}, Disruption: ${disruptionStr})`;
            }

            const rejectEvent = {
                userId,
                email: driverEmail || 'driver@rideshield.com',
                amount: "0.00",
                disruptedHours: 0,
                date,
                status: 'REJECTED',
                reason: rejectReason,
                timestamp: new Date().toISOString()
            };
            publishToPaymentQueue(rejectEvent);
        }

    } catch (err) {
        console.error(`Failed to complete compensation checks for user ${userId}:`, err.message);
    }
};

app.listen(PORT, () => {
    console.log(`🚀 MainService Core executing on port ${PORT}`);
    connectQueue();
});
