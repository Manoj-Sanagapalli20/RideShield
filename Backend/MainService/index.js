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
const redis = require('redis');
const Queue = require('bull');

const app = express();
app.use(express.json());
const PORT = 5005;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = redis.createClient({ url: redisUrl });
redisClient.connect().then(() => {
    console.log("✅ MainService connected to Redis for daily cron & social overrides");
}).catch(err => {
    console.warn("⚠️ MainService failed to connect to Redis:", err.message);
});

// Setup repeatable daily Bull cron job at 6:00 AM IST
const payoutQueue = new Queue('daily-payout-cron', redisUrl, {
    redis: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
    }
});
payoutQueue.add({}, {
    repeat: { cron: '0 6 * * *', tz: 'Asia/Kolkata' }
}).then(() => {
    console.log("⏰ Daily 6:00 AM IST Payout Cron job registered with Bull");
}).catch(err => {
    console.warn("⚠️ Failed to register Bull repeatable cron:", err.message);
});

payoutQueue.process(async (job) => {
    console.log("⏰ Bull Queue Cron Worker processing daily payout run at 6:00 AM IST...");
    await runDailyPayouts();
});

// Setup repeatable weekly premium adjustment Bull cron job at 5:00 AM IST on Mondays
const premiumQueue = new Queue('weekly-premium-cron', redisUrl, {
    redis: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
    }
});
premiumQueue.add({}, {
    repeat: { cron: '0 5 * * 1', tz: 'Asia/Kolkata' }
}).then(() => {
    console.log("⏰ Weekly Monday 5:00 AM IST Premium Adjust Cron job registered with Bull");
}).catch(err => {
    console.warn("⚠️ Failed to register Bull weekly premium cron:", err.message);
});

premiumQueue.process(async (job) => {
    console.log("⏰ Bull Queue Cron Worker processing weekly premium adjustments...");
    await runWeeklyPremiumAdjustments();
});

const runWeeklyPremiumAdjustments = async () => {
    console.log(`[Cron] Triggering weekly premium adjustments for upcoming week...`);
    try {
        const policyServiceUrl = process.env.POLICY_SERVICE_URL || 'http://localhost:5002';
        const res = await axios.post(`${policyServiceUrl}/api/policy/cron/weekly-premium-adjustment`);
        console.log(`[Cron] Weekly premium adjustments completed successfully:`, res.data);
    } catch (err) {
        console.error(`[Cron] Weekly premium adjustments failed:`, err.message);
    }
};

// Trigger daily payouts execution (for yesterday)
const runDailyPayouts = async (targetDateStr) => {
    let dateStr = targetDateStr;
    if (!dateStr) {
        // Calculate yesterday's date (local timezone)
        const d = new Date();
        d.setDate(d.getDate() - 1);
        dateStr = d.toISOString().split('T')[0];
    }
    console.log(`[Cron] Executing daily claims processing for date: ${dateStr}`);

    try {
        // Trigger inactivity check in Policy Service
        const policyServiceUrl = process.env.POLICY_SERVICE_URL || 'http://localhost:5002';
        console.log(`[Cron] Triggering driver inactivity auto-pause checks at PolicyService...`);
        axios.post(`${policyServiceUrl}/api/policy/cron/inactivity-check`)
            .then(res => console.log(`[Cron] Inactivity checks completed:`, res.data))
            .catch(err => console.error(`[Cron] Inactivity checks failed:`, err.message));

        const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5003';
        const usersRes = await axios.get(`${paymentServiceUrl}/api/payments/active-users`);
        const { userIds } = usersRes.data;

        if (!userIds || userIds.length === 0) {
            console.log("[Cron] No active policies found. Skipping payout checks.");
            return;
        }

        console.log(`[Cron] Found ${userIds.length} active users to check. Retrieving location profiles from Redis...`);
        for (const userId of userIds) {
            try {
                const locStr = await redisClient.get(`worker:${userId}:location`);
                if (locStr) {
                    const loc = JSON.parse(locStr);
                    console.log(`[Cron] Geolocated active user ${userId} to pincode ${loc.pincode}. Queuing yesterday's analysis...`);
                    
                    const payload = {
                        userId,
                        lat: parseFloat(loc.lat),
                        lng: parseFloat(loc.lng),
                        pincode: loc.pincode,
                        date: dateStr,
                        extraData: {}
                    };
                    
                    if (channel) {
                        channel.sendToQueue('location.update', Buffer.from(JSON.stringify(payload)), { persistent: true });
                    }
                } else {
                    console.warn(`[Cron] No last known location cached in Redis for user ${userId}. Skipping.`);
                }
            } catch (driverErr) {
                console.error(`[Cron] Failed to process scheduling for driver ${userId}:`, driverErr.message);
            }
        }
    } catch (err) {
        console.error("[Cron] Failed to run daily payouts:", err.message);
    }
};

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
            await channel.assertQueue('payment.disruption_priority', { 
                durable: true,
                arguments: { 'x-max-priority': 10 }
            });

            // Bind them for Pub/Sub
            await channel.bindQueue('notification.disruption', 'disruption_payout_fanout', '');
            await channel.bindQueue('payment.disruption_priority', 'disruption_payout_fanout', '');

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
            const msgPriority = payoutEvent.priority === 'high' ? 10 : 1;
            channel.publish('disruption_payout_fanout', '', messageBuffer, { 
                persistent: true,
                priority: msgPriority
            });
            console.log(`📡 Disruption event published to 'disruption_payout_fanout' (Priority: ${msgPriority}):\n`, JSON.stringify(payoutEvent, null, 2));
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
    let dailyWage = 600; // Default fallback
    let hasActivePolicy = true;
    let planName = 'Standard'; // Default fallback

    try {
        console.log(`[User: ${userId}] Querying PolicyService for active plan...`);
        const policyRes = await axios.get(`${policyServiceUrl}/api/policy/user/${userId}`);
        if (policyRes.data && policyRes.data.dailyWage) {
            dailyWage = policyRes.data.dailyWage;
            planName = policyRes.data.planName || 'Standard';
            console.log(`[User: ${userId}] Active policy found: Plan ${planName}, Daily Wage Protected: ₹${dailyWage}`);
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

    // Filter disruptions based on policy coverage tier:
    // 1. Basic Plan covers rain and heat only.
    // 2. Standard/Medium Plan covers rain, heat, pollution (AQI), strike, and curfew.
    // 3. Pro/Premium Plan covers rain, heat, pollution (AQI), strike, and curfew + priority payout.
    const rawWeather = disruptionsByType.weather || [];
    let rawSocial = [...(disruptionsByType.social || [])];

    // Fetch Zone Manager confirmations from Redis (Edge Case 3)
    try {
        const overrideKey = `confirmed-social:${date}:${results.zone}`;
        const overrideStr = await redisClient.get(overrideKey);
        if (overrideStr) {
            const override = JSON.parse(overrideStr);
            const exists = rawSocial.some(s => s.type === override.type);
            if (!exists) {
                rawSocial.push({
                    time: "00:00-24:00", // Full day impact
                    type: override.type,
                    level: "heavy",
                    source: "Zone Manager Override",
                    title: `Zone Manager manual confirmation: [${override.type.toUpperCase()}] active.`
                });
                console.log(`[User: ${userId}] Zone Manager override merged for user: added social trigger [${override.type}]`);
            }
        }
    } catch (overrideErr) {
        console.warn(`[User: ${userId}] Failed to retrieve Zone Manager overrides from Redis:`, overrideErr.message);
    }
    
    let allDisruptions = [];
    const plan = planName.toLowerCase().trim();

    if (plan === 'basic') {
        allDisruptions = rawWeather.filter(d => d.type === 'rain' || d.type === 'heat');
    } else {
        // Standard, Medium, Pro, and Premium all cover all triggers
        allDisruptions = [...rawWeather, ...rawSocial];
    }

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

            // 2. Calculate claimsLast30Days and enforce weekly payout limit by querying PaymentService
            let claimsLast30Days = 0;
            let weeklyPayoutSum = 0;
            const weeklyLimitMap = {
                'basic': 400,
                'standard': 600,
                'medium': 600,
                'pro': 800,
                'pro shield': 800
            };
            const planLower = planName.toLowerCase().trim();
            const weeklyLimit = weeklyLimitMap[planLower] || 600;

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

                // Calculate week bounds for the target date (Sunday to Saturday calendar week)
                const dateParts = date.split('-');
                const targetDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0);
                const day = targetDate.getDay();
                
                const startOfWeek = new Date(targetDate);
                startOfWeek.setDate(targetDate.getDate() - day);
                startOfWeek.setHours(0, 0, 0, 0);

                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);

                // Sum payouts in the same calendar week, excluding current day's record if any and REJECTED status
                const processedPayoutsThisWeek = payouts.filter(p => {
                    if (p.status === 'REJECTED') return false;
                    if (p.date === date) return false;
                    let pDate;
                    if (p.date) {
                        const pParts = p.date.split('-');
                        pDate = new Date(parseInt(pParts[0]), parseInt(pParts[1]) - 1, parseInt(pParts[2]), 12, 0, 0);
                    } else {
                        pDate = new Date(p.timestamp || p.createdAt);
                    }
                    return pDate >= startOfWeek && pDate <= endOfWeek;
                });

                weeklyPayoutSum = processedPayoutsThisWeek.reduce((sum, p) => sum + (p.amount || 0), 0);
                console.log(`[User: ${userId}] Payout history this week (excluding target date): ₹${weeklyPayoutSum.toFixed(2)} / ₹${weeklyLimit.toFixed(2)} limit`);
            } catch (err) {
                console.warn(`[User: ${userId}] Could not fetch past claims for weekly cap check: ${err.message}. Defaulting to 0.`);
            }

            // Enforce weekly payout limit
            const remainingWeeklyBudget = Math.max(0, weeklyLimit - weeklyPayoutSum);
            if (remainingWeeklyBudget <= 0) {
                // If limit is already reached, reject the payout with a clear reason
                finalPayout = 0;
                status = 'REJECTED';
                reasonStr = `Rejected: Weekly coverage limit of ₹${weeklyLimit} has already been fully claimed and exhausted for this calendar week.`;
                console.log(`[User: ${userId}] ❌ Claim rejected! Weekly limit of ₹${weeklyLimit} already fully claimed.`);
            } else if (finalPayout > remainingWeeklyBudget) {
                const originalPayout = finalPayout;
                finalPayout = remainingWeeklyBudget;
                reasonStr = `${reasonStr}. (Capped by Weekly Payout Limit: ₹${finalPayout.toFixed(2)} paid instead of ₹${originalPayout.toFixed(2)} due to ₹${weeklyLimit} weekly limit)`;
                console.log(`[User: ${userId}] ⚠️ Payout capped by weekly limit! Original: ₹${originalPayout.toFixed(2)}, Final Capped: ₹${finalPayout.toFixed(2)}`);
            }

            // 3. Request ML-Service fraud check with full anti-spoofing signals
            try {
                const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

                // --- Extract Anti-Spoofing Signals ---
                // extraData may be supplied by the client (location update payload) or set to defaults
                const extraData = data.extraData || {};

                // Feature 0: GPS Zone vs Cell Tower match (default 1 = matching — safe baseline)
                const gpsZoneVsCellTowerZoneMatch = extraData.gpsZoneVsCellTowerZoneMatch !== undefined
                    ? parseInt(extraData.gpsZoneVsCellTowerZoneMatch) : 1;

                // Feature 1: Accelerometer motion during claim (default 0.8 = active driver)
                const accelerometerMotionDuringClaim = extraData.accelerometerMotionDuringClaim !== undefined
                    ? parseFloat(extraData.accelerometerMotionDuringClaim) : 0.8;

                // Feature 2: Login-to-trigger gap (minutes between Rapido login and disruption start)
                // Calculate from shift start vs first disruption time if not provided
                let loginToTriggerGapMinutes = 120.0; // Safe default
                if (extraData.loginToTriggerGapMinutes !== undefined) {
                    loginToTriggerGapMinutes = parseFloat(extraData.loginToTriggerGapMinutes);
                } else if (allDisruptions.length > 0 && onlineHoursList.length > 0) {
                    // Estimate: first shift hour vs first disruption start
                    try {
                        const firstShiftHour = parseInt(onlineHoursList[0].split(':')[0]);
                        const firstDisruptionHour = parseInt(allDisruptions[0].time.split(':')[0]);
                        loginToTriggerGapMinutes = Math.abs(firstDisruptionHour - firstShiftHour) * 60;
                    } catch (_) { /* ignore parse errors */ }
                }

                // Feature 3: Orders in 3hr before disruption (use ordersLast2hr as best approximation)
                const orders3hrBeforeDisruption = extraData.orders3hrBeforeDisruption !== undefined
                    ? parseInt(extraData.orders3hrBeforeDisruption) : ordersLast2hr;

                // Feature 5: Neighbor claims in the same time window (from ML output or default zone size)
                const neighborClaimsSameWindow = extraData.neighborClaimsSameWindow !== undefined
                    ? parseInt(extraData.neighborClaimsSameWindow) : 15;

                // Feature 6: Registration cohort size (drivers registered in same batch window)
                const registrationCohortSize = extraData.registrationCohortSize !== undefined
                    ? parseInt(extraData.registrationCohortSize) : 5;

                // Feature 7: Device fingerprint cluster score (0 = unique device, 1 = mass-cloned ring)
                const deviceFingerprintClusterScore = extraData.deviceFingerprintClusterScore !== undefined
                    ? parseFloat(extraData.deviceFingerprintClusterScore) : 0.1;

                console.log(`[User: ${userId}] Calling ML-Service /fraud-check — Anti-Spoofing signals: GPS/Cell Match=${gpsZoneVsCellTowerZoneMatch}, Accel=${accelerometerMotionDuringClaim}, LoginGap=${loginToTriggerGapMinutes}m, Orders3hr=${orders3hrBeforeDisruption}, Claims30d=${claimsLast30Days}, NeighborClaims=${neighborClaimsSameWindow}, CohortSize=${registrationCohortSize}, DeviceCluster=${deviceFingerprintClusterScore}`);

                const fraudRes = await axios.post(`${mlServiceUrl}/api/ml/fraud-check`, {
                    gpsZoneVsCellTowerZoneMatch,
                    accelerometerMotionDuringClaim,
                    loginToTriggerGapMinutes,
                    orders3hrBeforeDisruption,
                    claimsLast30Days,
                    neighborClaimsSameWindow,
                    registrationCohortSize,
                    deviceFingerprintClusterScore
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
                    status = 'REVIEW';
                    console.log(`[User: ${userId}] ⚠️ Transaction marked for manual review (Anomaly Score: ${fraudData.anomalyScore}) for all tiers. Status set to REVIEW.`);
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
                priority: (planName.toLowerCase().trim() === 'pro' || planName.toLowerCase().trim() === 'premium') ? 'high' : 'normal',
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

// Developer endpoint to manually trigger/simulate 6 AM cron run
app.post('/api/claims/trigger-cron', async (req, res) => {
    try {
        const { date } = req.body;
        await runDailyPayouts(date);
        res.status(200).json({ success: true, message: `Cron execution simulated successfully for date: ${date || 'yesterday'}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Developer endpoint to manually trigger/simulate weekly premium adjustments cron run
app.post('/api/claims/trigger-premium-cron', async (req, res) => {
    try {
        await runWeeklyPremiumAdjustments();
        res.status(200).json({ success: true, message: `Weekly premium adjustments simulated successfully.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Zone Manager strike confirmation / manual disruption override (Edge Case 3)
app.post('/api/disruptions/confirm-social', async (req, res) => {
    try {
        const { date, city, pincode, type } = req.body;
        if (!date || !city || !pincode || !type) {
            return res.status(400).json({ error: 'Missing required fields (date, city, pincode, type)' });
        }
        
        // Normalize zone name to match geo_utils output
        const zoneName = `${city}-${pincode}`;
        const redisKey = `confirmed-social:${date}:${zoneName}`;
        
        await redisClient.set(redisKey, JSON.stringify({ type, status: 'confirmed' }), { EX: 86400 * 7 }); // keep for 7 days
        console.log(`[Override] Zone Manager confirmed social disruption [${type}] for ${zoneName} on ${date}`);
        
        res.status(200).json({
            success: true,
            message: `Social disruption [${type}] confirmed successfully for zone [${zoneName}] on ${date}.`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 MainService Core executing on port ${PORT}`);
    connectQueue();
});
