import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FiCloudRain, FiAlertCircle, FiCheckCircle, FiDownload, FiZap, FiX } from "react-icons/fi";
import AppShell from "../components/AppShell";

interface Payout {
    _id: string;
    amount: number;
    disruptedHours: number;
    date: string;
    reason: string;
    status: string;
    priority?: string;
    createdAt: string;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 70, mass: 1 };

const getDisruptionDetails = (reasonStr: string) => {
    if (!reasonStr) return "";
    const match = reasonStr.match(/Claim Details: (.*)$/);
    return match ? match[1] : reasonStr;
};

const parseReason = (reasonStr: string) => {
    if (!reasonStr) return { approved: [], rejected: [], isFullRejection: false };
    
    // Clean to only parse the actual disruption slot details
    reasonStr = getDisruptionDetails(reasonStr);
    
    if (reasonStr.startsWith("Rejected:")) {
        return {
            approved: [],
            rejected: [{ time: "", reason: reasonStr.replace("Rejected: ", "").trim() }],
            isFullRejection: true
        };
    }
    
    // Extract weekly capping reason if present
    let cappingReason = "";
    const capMatch = reasonStr.match(/\((Capped by Weekly Payout Limit:.*?)\)/);
    if (capMatch) {
        cappingReason = capMatch[1];
        // Remove capping text from reasonStr so slot matcher executes cleanly
        reasonStr = reasonStr.replace(/\.?\s*\(Capped by Weekly Payout Limit:.*?\)/g, "").trim();
    }
    
    const parts = reasonStr.split('. Rejections: ');
    const approvedPart = parts[0];
    const rejectedPart = parts[1] || "";
    
    const approved = approvedPart ? approvedPart.split(', ').map(item => {
        const match = item.match(/(.*?)\s*\((.*?)\)/);
        if (match) {
            return { type: match[1].trim(), time: match[2].trim() };
        }
        return { type: "Disruption", time: item.trim() };
    }).filter(x => x.time) : [];
    
    const rejected = rejectedPart ? rejectedPart.split(', ').map(item => {
        const match = item.match(/(.*?)\s*rejected\s*\((.*?)\)/);
        if (match) {
            return { time: match[1].trim(), reason: match[2].trim() };
        }
        return { time: "", reason: item.trim() };
    }).filter(x => x.reason) : [];
    
    if (cappingReason) {
        rejected.push({ time: "", reason: cappingReason });
    }
    
    return { approved, rejected, isFullRejection: false };
};

const getApprovedReasonOnly = (reason: string) => {
    if (!reason) return "";
    
    const scoreMatch = reason.match(/^Pending Audit \(Anomaly Score: ([0-9.]+)\)/);
    const detailsPart = getDisruptionDetails(reason).split('. Rejections: ')[0];
    
    if (scoreMatch) {
        return `Pending Audit (Anomaly Score: ${scoreMatch[1]}) - ${detailsPart}`;
    }
    
    if (reason.startsWith("Rejected:")) {
        return reason;
    }
    return detailsPart;
};

export default function ClaimsHistoryPage() {
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [totalPayout, setTotalPayout] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);

    const isPayoutPaid = (p: Payout) => {
        const dateStr = p.createdAt || p.date;
        if (!dateStr) return true;
        const createdTime = new Date(dateStr);
        if (isNaN(createdTime.getTime())) return true;

        const payoutTime = new Date(createdTime);
        if (createdTime.getHours() < 6) {
            payoutTime.setHours(6, 0, 0, 0);
        } else {
            payoutTime.setDate(createdTime.getDate() + 1);
            payoutTime.setHours(6, 0, 0, 0);
        }
        return new Date() >= payoutTime;
    };

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
                            className="bg-white/5 border border-white/10 rounded-2xl p-4"
                        >
                            <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
                            <p className="text-xl font-semibold text-white">
                                {isLoading ? "—" : stat.value}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5 flex justify-between">
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
                                        onClick={() => setSelectedPayout(payout)}
                                        className="px-6 py-4 flex justify-between border-b border-white/5 items-center hover:bg-white/2 transition-colors cursor-pointer group"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-white font-medium group-hover:text-primary-400 transition-colors">{getApprovedReasonOnly(payout.reason)}</p>
                                                 {isRejected ? (
                                                     <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-medium">
                                                         Rejected
                                                     </span>
                                                 ) : payout.status === 'REVIEW' ? (
                                                     <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                                                         Under Review
                                                     </span>
                                                 ) : payout.status === 'PROCESSED' ? (
                                                     isPayoutPaid(payout) ? (
                                                         <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                                                             Credited to UPI
                                                         </span>
                                                     ) : (
                                                         <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium">
                                                             Awaiting Payout
                                                         </span>
                                                     )
                                                 ) : null}
                                                 {payout.priority === 'high' && !isRejected && payout.status !== 'REVIEW' && (
                                                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                                                          ⚡ Priority Dispatched
                                                      </span>
                                                 )}
                                            </div>
                                            <p className="text-slate-500 text-sm mt-0.5">
                                                {payout.date}
                                                <span className="text-primary-400 opacity-0 group-hover:opacity-100 transition-all ml-2 text-xs font-semibold">
                                                    · View Receipt →
                                                </span>
                                            </p>
                                        </div>
                                        <div className="text-right flex items-center gap-3">
                                            <div>
                                                 <p className={isRejected ? "text-slate-500 font-semibold text-sm" : payout.status === 'REVIEW' ? "text-amber-400 font-semibold text-sm" : "text-emerald-400 font-semibold text-sm"}>
                                                     {isRejected ? "₹0.00" : `+₹${payout.amount.toFixed(2)}`}
                                                 </p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">
                                                    {payout.disruptedHours} hrs covered
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Payout Details Modal */}
            <AnimatePresence>
                {selectedPayout && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center backdrop-blur-md p-4"
                        onClick={() => setSelectedPayout(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={spring}
                            className="bg-[#121214] border border-white/10 rounded-2xl p-6 w-full max-w-3xl relative overflow-hidden text-left shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close Button */}
                            <button 
                                onClick={() => setSelectedPayout(null)}
                                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-lg"
                            >
                                <FiX className="size-5" />
                            </button>

                            <div className="text-center pb-5 border-b border-white/5 mb-5">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Parametric Insurance Receipt</span>
                                <h3 className="text-base font-bold text-white mb-3">{selectedPayout.date}</h3>
                                
                                <div className="inline-flex flex-col items-center">
                                     <span className={`text-3xl font-extrabold tracking-tight ${selectedPayout.status === 'REJECTED' ? 'text-slate-500' : selectedPayout.status === 'REVIEW' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                         {selectedPayout.status === 'REJECTED' ? '₹0.00' : `+₹${selectedPayout.amount}`}
                                     </span>
                                     <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider mt-2 border ${
                                         selectedPayout.status === 'REJECTED' 
                                             ? 'text-red-400 bg-red-500/10 border-red-500/20' 
                                             : selectedPayout.status === 'REVIEW'
                                                 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                                 : isPayoutPaid(selectedPayout)
                                                     ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                     : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                     }`}>
                                         {selectedPayout.status === 'REJECTED' 
                                             ? 'Rejected' 
                                             : selectedPayout.status === 'REVIEW' 
                                                 ? 'Reviewing' 
                                                 : isPayoutPaid(selectedPayout)
                                                     ? 'Credited to UPI' 
                                                     : 'Approved (Awaiting Payout)'}
                                     </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                                {/* Left Column: Approved Windows */}
                                <div className="space-y-2.5">
                                    <h4 className="text-[11px] text-slate-500 uppercase tracking-wider font-bold mb-2">Approved Windows</h4>
                                    {parseReason(selectedPayout.reason).approved.length > 0 ? (
                                        <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                            {parseReason(selectedPayout.reason).approved.map((app, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-3.5 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-2 rounded-full bg-emerald-500" />
                                                        <span className="text-xs font-semibold text-white">{app.type}</span>
                                                    </div>
                                                    <span className="text-xs text-emerald-400 font-bold">{app.time}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-[120px] md:h-[200px] flex flex-col items-center justify-center border border-white/5 bg-white/[0.01] rounded-xl text-slate-600 text-xs font-medium">
                                            No approved hours for this day
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Exclusions */}
                                <div className="space-y-2.5">
                                    <h4 className="text-[11px] text-slate-500 uppercase tracking-wider font-bold mb-2">Exclusions & Unpaid Shifts</h4>
                                    {parseReason(selectedPayout.reason).rejected.length > 0 ? (
                                        <div className="max-h-[250px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                            {parseReason(selectedPayout.reason).rejected.map((rej, idx) => (
                                                <div key={idx} className="flex items-start justify-between bg-white/[0.02] border border-white/5 rounded-xl px-3.5 py-2">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-semibold text-slate-400 leading-tight">{rej.reason}</span>
                                                        {rej.time && <span className="text-[10px] text-slate-600 font-semibold">{rej.time}</span>}
                                                    </div>
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-red-400/80 shrink-0 bg-red-500/5 px-1.5 py-0.5 rounded border border-red-500/10">Unpaid</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-[120px] md:h-[200px] flex flex-col items-center justify-center border border-white/5 bg-white/[0.01] rounded-xl text-slate-600 text-xs font-medium">
                                            No exclusions for this day
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Info */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 text-[10px] text-slate-500 font-medium grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-slate-600 font-semibold uppercase tracking-wider text-[8px] mb-0.5">Claim Hours Covered</span>
                                    <span className="text-white text-xs font-bold">{selectedPayout.disruptedHours} hrs</span>
                                </div>
                                <div className="text-right">
                                    <span className="block text-slate-600 font-semibold uppercase tracking-wider text-[8px] mb-0.5">Processed Date</span>
                                    <span className="text-white text-xs font-bold">{new Date(selectedPayout.createdAt || new Date()).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AppShell>
    );
}
