import type { IFeature } from "../types";
import { UserCheck, Zap, CloudLightning, Activity, ShieldCheck, Smartphone, Bell, CalendarClock, Lock } from "lucide-react";

export const featuresData: IFeature[] = [
    {
        icon: <UserCheck className="size-8 text-primary-500" strokeWidth={1.5} />,
        title: "Rapido ID login",
        description: "No new account needed. Your Rapido Partner ID is your identity on RideShield — we verify your active status automatically.",
    },
    {
        icon: <Zap className="size-8 text-primary-500" strokeWidth={1.5} />,
        title: "Zero-touch payouts",
        description: "No claim to file. No call to make. When disruption hits, we detect it, verify it, and pay you — while you sleep.",
    },
    {
        icon: <CloudLightning className="size-8 text-primary-500" strokeWidth={1.5} />,
        title: "Multi-disruption coverage",
        description: "Heavy rain, extreme heat, severe AQI, local bandh, curfews — all covered depending on your plan.",
    },
    {
        icon: <Activity className="size-8 text-primary-500" strokeWidth={1.5} />,
        title: "Proportional payouts",
        description: "You're not paid a flat amount. Payout is calculated based on exactly how many hours were disrupted. Completely fair.",
    },
    {
        icon: <ShieldCheck className="size-8 text-primary-500" strokeWidth={1.5} />,
        title: "Fraud-proof verification",
        description: "Three checks on every claim — Rapido login, disruption data, ride activity. Keeps the pool fair for everyone.",
    },
    {
        icon: <Smartphone className="size-8 text-primary-500" strokeWidth={1.5} />,
        title: "Works on any phone",
        description: "No app download needed. RideShield is a PWA — open it in Chrome, tap the WhatsApp link, and you're registered in 2 minutes.",
    },
    {
        icon: <Bell className="size-8 text-primary-500" strokeWidth={1.5} />,
        title: "Smart disruption alerts",
        description: "Get notified before disruptions hit — 'heavy rain forecast at 3 PM in your zone, work before 2 PM to maximise earnings.'",
    },
    {
        icon: <CalendarClock className="size-8 text-primary-500" strokeWidth={1.5} />,
        title: "Weekly billing",
        description: "Pay weekly — not monthly or annually. Aligned with how Rapido pays you, so you never pay from savings.",
    },
    {
        icon: <Lock className="size-8 text-primary-500" strokeWidth={1.5} />,
        title: "Secure & private",
        description: "Your Rapido ID and UPI details are encrypted at rest. We never share your data. Coverage pauses if you go inactive.",
    }
];
