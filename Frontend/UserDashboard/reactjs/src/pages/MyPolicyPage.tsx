import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { FiShield, FiCheckCircle, FiCloudRain, FiDownload, FiZap, FiArrowUpRight } from "react-icons/fi";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";

const spring = { type: "spring" as const, stiffness: 300, damping: 70, mass: 1 };

const FEATURES = [
    { label: "Rain Disruption Cover", desc: "Triggered when rainfall exceeds 0.5mm/hr in your zone", icon: <FiCloudRain /> },
    { label: "Heat Wave Protection", desc: "Activated when temperature surpasses 45°C", icon: <FiZap /> },
    { label: "Strike & Curfew Guard", desc: "Coverage during social disruption events", icon: <FiShield /> },
    { label: "Instant Auto-Payout", desc: "Zero manual claims — processed in real-time", icon: <FiCheckCircle /> },
];

const HOW_IT_WORKS = [
    { step: "01", label: "Disruption Detected", desc: "ML model flags rain/heat above threshold in your zone", icon: <FiCloudRain /> },
    { step: "02", label: "Activity Verified", desc: "System checks if you were online during the event", icon: <FiCheckCircle /> },
    { step: "03", label: "Payout Calculated", desc: "Formula: (Daily Wage ÷ Login Hours) × Disrupted Hours", icon: <FiZap /> },
    { step: "04", label: "Instantly Dispatched", desc: "Amount credited and email notification sent", icon: <FiArrowUpRight /> },
];

export default function MyPolicyPage() {
    const [policy, setPolicy] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const userId = localStorage.getItem("partnerId") || "";
    const user = localStorage.getItem("rideShieldUser") ? JSON.parse(localStorage.getItem("rideShieldUser")!) : null;

    useEffect(() => {
        if (!userId) return;
        fetch(`http://localhost:5002/api/policy/user/${userId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => setPolicy(data))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [userId]);

    return (
        <AppShell title="My Policy" subtitle="Your parametric insurance coverage details">
            <div className="p-4 md:p-6 lg:p-8 relative">
                <div className="absolute top-0 left-1/3 size-72 bg-primary-600 blur-[200px] opacity-10 pointer-events-none" />

                {/* Hero */}
                <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}
                    className="bg-white/5 bride bride-white/10 rounded-2xl p-6 md:p-8 mb-5 relative overflow-hidden z-10">
                    <div className="absolute -top-16 -right-16 size-48 bg-primary-600 blur-[80px] opacity-20 pointer-events-none" />
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="size-10 rounded-xl bg-white/5 bride bride-white/10 flex items-center justify-center text-primary-500">
                                    <FiShield className="size-5" />
                                </div>
                                <span className="text-[10px] font-medium text-primary-400 bg-primary-200/15 px-2.5 py-1 rounded-full">
                                    {isLoading ? "..." : policy ? "Active" : "No Policy"}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-1">Your Plan</p>
                            <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
                                {isLoading ? "Loading..." : policy?.planName || "GigShield Pro"}
                            </h2>
                            {user?.name && <p className="text-slate-400 text-sm mt-1">Holder: {user.name}</p>}
                        </div>
                        <div className="flex flex-col gap-4 text-right">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-1">Daily Wage Protected</p>
                                <p className="text-3xl font-bold text-white">₹{policy?.dailyWage || 600}</p>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button className="text-[11px] font-medium text-slate-400 hover:text-white bg-white/5 bride bride-white/10 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all hover:bg-white/8">
                                    <FiDownload className="size-3.5" /> Certificate
                                </button>
                                <Link to="/claims" className="text-[11px] font-medium text-primary-400 bg-primary-200/15 bride bride-primary-500/20 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all hover:bg-primary-200/20">
                                    Claims <FiArrowUpRight className="size-3.5" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Coverage Features */}
                <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, ...spring }}
                    className="bg-white/5 bride bride-white/10 rounded-2xl p-6 mb-5 relative z-10">
                    <h3 className="font-semibold text-white text-base tracking-tight mb-5">Coverage Features</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {FEATURES.map((f, i) => (
                            <motion.div key={i}
                                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: i * 0.08 + 0.2, ...spring }}
                                className="flex items-start gap-4 bg-white/5 bride bride-white/5 rounded-xl p-4 hover:bg-white/8 hover:bride-white/10 transition-all group"
                            >
                                <div className="size-9 rounded-xl bg-white/5 bride bride-white/10 flex items-center justify-center text-primary-500 shrink-0 group-hover:bg-primary-600/20 group-hover:bride-primary-500/20 transition-colors">
                                    <span className="size-4">{f.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors">{f.label}</p>
                                        <FiCheckCircle className="size-3.5 text-primary-500 shrink-0" />
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{f.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* How it works */}
                <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, ...spring }}
                    className="bg-white/5 bride bride-white/10 rounded-2xl p-6 relative z-10">
                    <h3 className="font-semibold text-white text-base tracking-tight mb-5">How Parametric Payout Works</h3>
                    <div className="flex flex-col md:flex-row gap-3">
                        {HOW_IT_WORKS.map((step, i) => (
                            <div key={i} className="flex-1 bg-white/5 bride bride-white/5 rounded-xl p-4 hover:bg-white/8 hover:bride-white/10 transition-all group">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[10px] font-medium text-primary-400 bg-primary-200/15 px-2 py-0.5 rounded-full">{step.step}</span>
                                    <span className="size-4 text-primary-500">{step.icon}</span>
                                </div>
                                <p className="text-[15px] font-medium text-white group-hover:text-primary-400 transition-colors mb-1">{step.label}</p>
                                <p className="text-[13px] text-slate-500 leading-relaxed">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </AppShell>
    );
}
