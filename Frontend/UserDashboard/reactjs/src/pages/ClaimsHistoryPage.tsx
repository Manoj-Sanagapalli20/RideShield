import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { FiCloudRain, FiAlertCircle, FiCheckCircle, FiDownload, FiZap } from "react-icons/fi";
import AppShell from "../components/AppShell";

interface Payout {
    _id: string;
    amount: number;
    disruptedHours: number;
    date: string;
    reason: string;
    status: string;
    createdAt: string;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 70, mass: 1 };

export default function ClaimsHistoryPage() {
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [totalPayout, setTotalPayout] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const userId = localStorage.getItem("partnerId") || "";

    useEffect(() => {
        if (!userId) return;

        fetch(`http://localhost:5003/api/disruption-payouts/${userId}`)
            .then(res => res.json())
            .then(data => {
                setPayouts(data.payouts || []);
                setTotalPayout(data.totalAmount || 0);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [userId]);

    return (
        <AppShell title="Claims History" subtitle="All your insurance payout records">
            <div className="p-4 md:p-6 lg:p-8 relative">

                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                    {[
                        { label: "Total Claimed", value: `₹${totalPayout.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, icon: <FiZap /> },
                        { label: "Total Claims", value: payouts.length.toString(), icon: <FiCloudRain /> },
                        { 
                            label: "Success Rate", 
                            value: payouts.length > 0 
                                ? `${Math.round((payouts.filter(p => p.status !== 'REJECTED').length / payouts.length) * 100)}%` 
                                : "100%", 
                            icon: <FiCheckCircle /> 
                        },
                    ].map((stat, i) => (
                        <motion.div key={i}
                            initial={{ y: 30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: i * 0.08, ...spring }}
                            className="bg-white/5 bride bride-white/10 rounded-2xl p-4"
                        >
                            <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
                            <p className="text-xl font-semibold text-white">
                                {isLoading ? "—" : stat.value}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white/5 bride bride-white/10 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 bride-b bride-white/5 flex justify-between">
                        <h2 className="font-semibold text-white">Payout Records</h2>
                        <button className="text-xs flex items-center gap-1">
                            <FiDownload /> Export
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="p-5 text-slate-400">Loading...</div>
                    ) : payouts.length === 0 ? (
                        <div className="p-5 text-center text-slate-400">
                            <FiAlertCircle className="mx-auto mb-2" />
                            No claims yet
                        </div>
                    ) : (
                        <div>
                            {payouts.map((payout) => {
                                const isRejected = payout.status === 'REJECTED';
                                return (
                                    <div key={payout._id}
                                        className="px-6 py-4 flex justify-between bride-b bride-white/5 items-center hover:bg-white/2 transition-colors"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-white font-medium">{payout.reason}</p>
                                                {isRejected && (
                                                    <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-medium">
                                                        Rejected
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-slate-500 text-sm mt-0.5">{payout.date}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={isRejected ? "text-slate-500 font-semibold" : "text-primary-400 font-semibold"}>
                                                {isRejected ? "₹0.00" : `+₹${payout.amount.toFixed(2)}`}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {payout.disruptedHours} hrs covered
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}