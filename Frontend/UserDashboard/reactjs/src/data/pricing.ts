import type { IPricing } from "../types";

export const pricingData: IPricing[] = [
    {
        name: "Basic",
        price: 20,
        period: "week",
        features: [
            "Max Payout: ₹250/week",
            "Coverage: Environmental only",
            "Zero-touch claim processing"
        ],
        mostPopular: false
    },
    {
        name: "Standard",
        price: 35,
        period: "week",
        features: [
            "Max Payout: ₹350/week",
            "Coverage: Environmental + Social",
            "Zero-touch claim processing",
            "Smart disruption alerts"
        ],
        mostPopular: true
    },
    {
        name: "Pro",
        price: 49,
        period: "week",
        features: [
            "Max Payout: ₹500/week",
            "Coverage: All triggers",
            "Zero-touch claim processing",
            "Smart disruption alerts",
            "Priority instant payout"
        ],
        mostPopular: false
    }
];
