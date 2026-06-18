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
        const peakPrecip = results.peak_precipitation || 0.0;
        let reasonStr;
        if (peakPrecip > 0.0) {
            reasonStr = shiftStr
                ? `Rejected: Peak rainfall was ${peakPrecip.toFixed(2)} mm/hr, which is below the RideShield threshold of 0.5 mm/hr. (Shift: ${shiftStr})`
                : `Rejected: Peak rainfall was ${peakPrecip.toFixed(2)} mm/hr, which is below the RideShield threshold of 0.5 mm/hr. (Driver Offline)`;
        } else {
            reasonStr = shiftStr
                ? `Rejected: Clear weather and no strike disruptions officially detected. (Shift: ${shiftStr})`
                : `Rejected: Clear weather and no strike disruptions officially detected. (Driver Offline)`;
        }
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
        const slotRejections = [];
        const successSlots = [];

        // Build a Map of actHour to activity to check for completely offline/missing hours
        const activityMap = new Map();
        logData.hourlyActivity.forEach(activity => {
            const timeSlot = activity.timeSlot || "00:00";
            const startPart = timeSlot.split('-')[0].trim();
            let actHour = parseInt(startPart.split(':')[0]);
            if (startPart.toLowerCase().includes('pm') && actHour < 12) {
                actHour += 12;
            } else if (startPart.toLowerCase().includes('am') && actHour === 12) {
                actHour = 0;
            }
            activityMap.set(actHour, activity);
        });

        const findDisruptionTypeForHour = (hour) => {
            const d = allDisruptions.find(dis => {
                const [startStr, endStr] = dis.time.split('-');
                const startHour = parseInt(startStr.split(':')[0]);
                const endHour = parseInt(endStr.split(':')[0]);
                return hour >= startHour && hour < endHour;
            });
            return d ? (d.type.charAt(0).toUpperCase() + d.type.slice(1)) : 'Disruption';
        };

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

                // Standardize slot name representation for rejections (e.g. 10:00 becomes 10:00-11:00)
                let slotName = timeSlot;
                if (!slotName.includes("-")) {
                    const startHr = parseInt(slotName.split(':')[0]);
                    const endHr = startHr + 1;
                    const formatHr = (h) => `${String(h).padStart(2, '0')}:00`;
                    slotName = `${formatHr(startHr)}-${formatHr(endHr)}`;
                }

                const rides = activity.ridesAccepted !== undefined ? activity.ridesAccepted : 0;

                if (disruptedHoursSet.has(actHour)) {
                    if (rides === 0) {
                        trigger1Hours++; // Trigger 1: Online but 0 rides accepted
                        const disType = findDisruptionTypeForHour(actHour);
                        successSlots.push(`${disType} Disruption (${slotName})`);
                    } else if (rides > 0 && rides <= 1) {
                        trigger2Hours++; // Trigger 2: Online but stuck/delayed (rides <= 1)
                        const disType = findDisruptionTypeForHour(actHour);
                        successSlots.push(`${disType} Disruption (${slotName})`);
                    } else {
                        const disType = findDisruptionTypeForHour(actHour);
                        slotRejections.push(`${slotName} rejected (Normal rides during ${disType} Disruption)`);
                    }
                } else {
                    // Only show rejection if the driver accepted <= 1 ride (claiming low rides but no rain)
                    if (rides <= 1) {
                        slotRejections.push(`${slotName} rejected (Clear weather)`);
                    }
                }
            } else {
                // If offline during a disruption window, report it as rejected offline
                const timeSlot = activity.timeSlot || "00:00";
                const startPart = timeSlot.split('-')[0].trim();
                let actHour = parseInt(startPart.split(':')[0]);
                if (startPart.toLowerCase().includes('pm') && actHour < 12) {
                    actHour += 12;
                } else if (startPart.toLowerCase().includes('am') && actHour === 12) {
                    actHour = 0;
                }
                if (disruptedHoursSet.has(actHour)) {
                    let slotName = timeSlot;
                    if (!slotName.includes("-")) {
                        const startHr = parseInt(slotName.split(':')[0]);
                        const endHr = startHr + 1;
                        const formatHr = (h) => `${String(h).padStart(2, '0')}:00`;
                        slotName = `${formatHr(startHr)}-${formatHr(endHr)}`;
                    }
                    const disType = findDisruptionTypeForHour(actHour);
                    slotRejections.push(`${slotName} rejected (Offline during ${disType} Disruption)`);
                }
            }
        });

        // Add disrupted hours where the driver had absolutely no logs at all (completely offline)
        disruptedHoursSet.forEach(disHour => {
            if (!activityMap.has(disHour)) {
                const endHr = disHour + 1;
                const formatHr = (h) => `${String(h).padStart(2, '0')}:00`;
                const slotName = `${formatHr(disHour)}-${formatHr(endHr)}`;
                const disType = findDisruptionTypeForHour(disHour);
                slotRejections.push(`${slotName} rejected (Offline during ${disType} Disruption)`);
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

            let reasonStr = successSlots.join(', ');

            if (slotRejections.length > 0) {
                reasonStr += `. Rejections: ${slotRejections.join(', ')}`;
            }

            // --- ML Fraud Check Integration ---
            let status = 'PROCESSED';
            let finalPayout = payout;
            let isFraudBlocked = false;
            let fraudReason = '';

            // 1. Calculate ordersLast2hr (max sum of rides accepted in any contiguous 2-hour window)
            let ordersLast2hr = 0;
            if (logData && logData.hourlyActivity) {
                const ridesAcceptedList = logData.hourlyActivity.map(h => h.ridesAccepted || 0);
                if (ridesAcceptedList.length === 1) {
                    ordersLast2hr = ridesAcceptedList[0];
                } else if (ridesAcceptedList.length > 1) {
                    for (let i = 0; i < ridesAcceptedList.length - 1; i++) {
                        const sum = ridesAcceptedList[i] + ridesAcceptedList[i+1];
                        if (sum > ordersLast2hr) {
                            ordersLast2hr = sum;
                        }
                    }
                }
            }

            // 2. Calculate claimsLast30Days by querying PaymentService
            let claimsLast30Days = 0;
            try {
                const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5003';
                const claimsRes = await axios.get(`${paymentServiceUrl}/api/disruption-payouts/${userId}`);
                const payouts = claimsRes.data.payouts || [];
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                claimsLast30Days = payouts.filter(p => {
                    const pDate = new Date(p.createdAt || p.timestamp || p.date);
                    return pDate >= thirtyDaysAgo;
                }).length;
            } catch (err) {
                console.warn(`[User: ${userId}] Could not fetch past claims for fraud check: ${err.message}. Defaulting to 0.`);
            }

            // 3. Request ML-Service fraud check
            try {
                const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
                const gpsLat = results.lat || 16.0145;
                const gpsLng = results.lng || 80.7828;
                console.log(`[User: ${userId}] Calling ML-Service /fraud-check with: ordersLast2hr=${ordersLast2hr}, claimsLast30Days=${claimsLast30Days}, amountINR=${payout.toFixed(2)}`);
                const fraudRes = await axios.post(`${mlServiceUrl}/api/ml/fraud-check`, {
                    gps: { lat: gpsLat, lng: gpsLng },
                    ordersLast2hr,
                    claimsLast30Days,
                    amountINR: parseFloat(payout.toFixed(2)),
                    hourOfDay: new Date().getHours(),
                    deviceType: 'mobile'
                });

                const fraudData = fraudRes.data;
                console.log(`[User: ${userId}] Fraud check response: Anomaly Score: ${fraudData.anomalyScore}, Verdict: ${fraudData.verdict}`);

                if (fraudData.verdict === 'flag') {
                    isFraudBlocked = true;
                    status = 'REJECTED';
                    finalPayout = 0;
                    fraudReason = `Rejected: Fraud/Anomaly detected by ML Risk Engine (Anomaly Score: ${fraudData.anomalyScore})`;
                    console.warn(`[User: ${userId}] 🚨 TRANSACTION BLOCKED BY FRAUD DETECTION ENGINE! Anomaly Score: ${fraudData.anomalyScore}`);
                } else if (fraudData.verdict === 'review') {
                    console.log(`[User: ${userId}] ⚠️ Transaction marked for manual review (Anomaly Score: ${fraudData.anomalyScore}), proceeding with payout.`);
                }
            } catch (err) {
                console.error(`[User: ${userId}] ⚠️ ML-Service fraud check failed: ${err.message}. Proceeding with standard validation.`);
            }

            const payoutEvent = {
                userId,
                email: driverEmail || 'driver@rideshield.com',
                amount: finalPayout.toFixed(2),
                disruptedHours: isFraudBlocked ? 0 : disruptedHours,
                date,
                status: status,
                reason: isFraudBlocked ? fraudReason : reasonStr,
                timestamp: new Date().toISOString()
            };

            publishToPaymentQueue(payoutEvent);

        } else {
            console.log(`[User: ${userId}] Driver was active but had normal ride counts, or was completely offline during the rain/strike window.`);
            
            let rejectReason = '';
            if (slotRejections.length > 0) {
                rejectReason = `Rejected: ${slotRejections.join(', ')}`;
            } else {
                // Fallback if slotRejections is empty
                const disruptionStr = allDisruptions
                    .map(d => `${d.type.charAt(0).toUpperCase() + d.type.slice(1)}: ${d.time}`)
                    .join(', ');
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
                        if (disruptedHoursSet.has(actHour)) {
                            hasShiftOverlap = true;
                        }
                    }
                });

                if (!hasShiftOverlap) {
                    rejectReason = `Rejected: Driver was offline / did not log shift activity during the disruption window. (Shift: ${shiftStr}, Disruption: ${disruptionStr})`;
                } else {
                    rejectReason = `Rejected: Normal ride count (rides > 1) accepted during disruption window. (Shift: ${shiftStr}, Disruption: ${disruptionStr})`;
                }
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
