import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
    FiShield, FiCloudRain, FiCheckCircle, FiArrowUpRight,
    FiMapPin, FiX, FiZap, FiAlertTriangle
} from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

const PAYMENT_SERVICE = "http://localhost:5003";
const POLICY_SERVICE = "http://localhost:5002";

interface Payout {
    _id: string;
    amount: number;
    disruptedHours: number;
    date: string;
    reason: string;
    status: string;
    createdAt: string;
}

interface PolicyData {
    planName: string;
    dailyWage: number;
    status: string;
}

const spring = { type: "spring" as const, stiffness: 280, damping: 60 };

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

export default function DashboardPage() {
    const [showLocationModal, setShowLocationModal] = useState(true);
    const [manualCity, setManualCity] = useState("Bangalore");
    const [manualPincode, setManualPincode] = useState("560001");
    const [manualDate, setManualDate] = useState(() => {
        const d = new Date();
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split("T")[0];
    });
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStage, setAnalysisStage] = useState("");
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [totalPayout, setTotalPayout] = useState(0);
    const [policy, setPolicy] = useState<PolicyData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const userId = localStorage.getItem("partnerId") || "";
    const user = localStorage.getItem("rideShieldUser")
        ? JSON.parse(localStorage.getItem("rideShieldUser")!)
        : null;
    const firstName = user?.name?.split(" ")[0] || "Driver";

    useEffect(() => {
        if (!userId) { navigate("/login"); return; }
        loadData();
    }, [userId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [payoutRes, policyRes] = await Promise.allSettled([
                fetch(`${PAYMENT_SERVICE}/api/disruption-payouts/${userId}`),
                fetch(`${POLICY_SERVICE}/api/policy/user/${userId}`),
            ]);
            if (payoutRes.status === "fulfilled" && payoutRes.value.ok) {
                const d = await payoutRes.value.json();
                setPayouts(d.payouts || []);
                setTotalPayout(d.totalAmount || 0);
            }
            if (policyRes.status === "fulfilled" && policyRes.value.ok) {
                setPolicy(await policyRes.value.json());
            }
        } catch (e) { console.error(e); }
        setIsLoading(false);
    };

    const pushLocation = (lat: number, lng: number, dateStr?: string, pc?: string) => {
        fetch("http://localhost:5004/api/address/update", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, lat, lng, date: dateStr, pincode: pc, data: { email: user?.email } })
        }).catch(console.error);
    };

    const handleCurrentLocation = () => {
        navigator.geolocation?.getCurrentPosition(
            (p) => {
                const lat = p.coords.latitude;
                const lon = p.coords.longitude;
                setShowLocationModal(false);
                setIsAnalyzing(true);
                setAnalysisStage("Contacting weather station via GPS coordinates...");

                const d = new Date();
                const offset = d.getTimezoneOffset();
                const localDate = new Date(d.getTime() - (offset * 60 * 1000));
                const todayStr = localDate.toISOString().split("T")[0];

                pushLocation(lat, lon, todayStr);

                setTimeout(() => {
                    setAnalysisStage("Retrieving partner shift activity logs...");
                }, 900);

                setTimeout(() => {
                    setAnalysisStage("Verifying hourly rain and social alerts...");
                }, 1800);

                setTimeout(async () => {
                    await loadData();
                    setIsAnalyzing(false);
                }, 2600);
            },
            console.warn, { enableHighAccuracy: true }
        );
    };

    const handleManualLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsFetchingLocation(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(manualCity)}&format=json&limit=1&addressdetails=1`);
            const d = await res.json();
            if (d?.length > 0) {
                const lat = parseFloat(d[0].lat);
                const lon = parseFloat(d[0].lon);
                const pc = manualPincode || d[0].address?.postcode || "000000";

                setShowLocationModal(false);
                setIsAnalyzing(true);
                setAnalysisStage("Contacting regional weather stations...");

                pushLocation(lat, lon, manualDate, pc);

                setTimeout(() => {
                    setAnalysisStage("Retrieving partner shift activity logs...");
                }, 900);

                setTimeout(() => {
                    setAnalysisStage("Verifying hourly rain and social alerts...");
                }, 1800);

                setTimeout(async () => {
                    await loadData();
                    setIsAnalyzing(false);
                }, 2600);
            } else alert("City not found.");
        } catch { alert("Network error."); }
        setIsFetchingLocation(false);
    };

    const latestPayout = payouts[0];
    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

    return (
        <AppShell title="Dashboard" subtitle={`${getGreeting()}, ${firstName}`}>

            {/* Analysis Overlay */}
            <AnimatePresence>
                {isAnalyzing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center backdrop-blur-2xl p-4">
                        <div className="text-center max-w-sm w-full">
                            <div className="relative size-20 mx-auto mb-6 flex items-center justify-center">
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                    className="absolute inset-0 rounded-full border-2 border-t-primary-500 border-r-transparent border-b-transparent border-l-transparent"
                                />
                                <FiShield className="size-8 text-primary-400 animate-pulse" />
                            </div>
                            <h3 className="text-white font-semibold text-lg mb-2">Analyzing Disruption Claim</h3>
                            <p className="text-slate-400 text-sm mb-1">{analysisStage}</p>
                            <div className="w-48 h-1 bg-white/10 rounded-full mx-auto overflow-hidden mt-4">
                                <motion.div 
                                    initial={{ x: "-100%" }} 
                                    animate={{ x: "0%" }} 
                                    transition={{ duration: 2.5, ease: "easeInOut" }} 
                                    className="h-full bg-primary-500" 
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Location Modal */}
            <AnimatePresence>
                {showLocationModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-xl p-4">
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0 }}
                            transition={spring}
                            className="bg-black bride bride-white/10 p-7 rounded-2xl shadow-2xl max-w-sm w-full text-white relative"
                        >
                            <button onClick={() => setShowLocationModal(false)} className="absolute top-4 right-4 text-white/30 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                                <FiX size={15} />
                            </button>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="size-10 rounded-xl bg-white/5 bride bride-white/10 flex items-center justify-center text-primary-500">
                                    <FiMapPin className="size-4" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold">Set Work Location</h2>
                                    <p className="text-[11px] text-slate-500">For disruption simulation</p>
                                </div>
                            </div>
                            <motion.button whileTap={{ scale: 0.97 }} onClick={handleCurrentLocation}
                                className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 rounded-xl font-medium text-sm mb-4 flex justify-center items-center gap-2 transition-colors shadow-lg shadow-primary-600/20">
                                <FiMapPin size={13} /> Use Live GPS
                            </motion.button>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-px bg-white/5 flex-1" />
                                <span className="text-[10px] text-slate-600 uppercase tracking-widest">or manual</span>
                                <div className="h-px bg-white/5 flex-1" />
                            </div>
                            <form onSubmit={handleManualLocation} className="space-y-3">
                                {[
                                    { label: "City", val: manualCity, set: setManualCity, ph: "e.g. Vijayawada...", type: "text", req: true },
                                    { label: "Pincode", val: manualPincode, set: setManualPincode, ph: "e.g. 522503", type: "text", req: false },
                                    { label: "Simulate Date", val: manualDate, set: setManualDate, ph: "", type: "date", req: true },
                                ].map(f => (
                                    <div key={f.label}>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-1.5 block">{f.label}</label>
                                        <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required={f.req}
                                            className="w-full bg-white/5 bride bride-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bride-primary-500/50 text-white placeholder:text-slate-700 transition-colors" />
                                    </div>
                                ))}
                                <button type="submit" disabled={isFetchingLocation}
                                    className="w-full py-2.5 bg-white/5 hover:bg-white/8 rounded-xl text-sm bride bride-white/10 transition-colors disabled:opacity-40">
                                    {isFetchingLocation ? "Locating..." : "Fetch Smart Report"}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dashboard Content */}
            <div className="p-4 md:p-6 relative">

                {/* ── HERO WELCOME ROW ───────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, ...spring }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                    <div>
                        <p className="text-[11px] text-slate-600 uppercase tracking-widest mb-1">{today}</p>
                        <h1 className="text-2xl font-semibold text-white tracking-tight">
                            {getGreeting()}, <span className="text-primary-400">{firstName}</span> 👋
                        </h1>
                        <p className="text-[15px] text-slate-500 mt-0.5">Here's your insurance overview for today.</p>
                    </div>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setShowLocationModal(true)}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-primary-600/20 shrink-0">
                        <FiMapPin className="size-4" /> Simulate disruption
                    </motion.button>
                </motion.div>

                {/* ── BENTO GRID ───────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                    {/* Card 1 — Shield / Policy Card (large) */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, ...spring }}
                        className="md:col-span-1 bg-white/5 bride bride-white/10 rounded-2xl p-5 relative overflow-hidden hover:bg-white/8 transition-colors group">
                        <div className="absolute -top-12 -right-12 size-36 bg-primary-600 blur-[60px] opacity-25 pointer-events-none" />
                        <div className="relative z-10 flex flex-col h-full min-h-[190px] justify-between">
                            <div className="flex justify-between items-start">
                                <div className="size-10 rounded-xl bg-white/5 bride bride-white/10 flex items-center justify-center text-primary-500 group-hover:bg-primary-600/20 group-hover:bride-primary-500/20 transition-colors">
                                    <FiShield className="size-5" />
                                </div>
                                <span className="text-[10px] font-medium text-primary-400 bg-primary-200/15 px-2.5 py-1 rounded-full">
                                    {isLoading ? "..." : policy ? "● Active" : "● No Plan"}
                                </span>
                            </div>
                            <div className="mt-4">
                                <p className="xs text-slate-500 uppercase tracking-widest font-medium mb-1">Current plan</p>
                                <p className="text-[15px] font-semibold text-white">{isLoading ? "—" : policy?.planName || "No Policy"}</p>
                                <p className="text-[13px] text-slate-500 mt-1">Daily wage protected: <span className="text-white font-medium">₹{policy?.dailyWage || "—"}</span></p>
                            </div>
                            <Link to="/policy" className="mt-4 flex items-center gap-1 text-[11px] text-primary-400 hover:text-primary-300 transition-colors font-medium">
                                View policy details <FiArrowUpRight className="size-3" />
                            </Link>
                        </div>
                    </motion.div>

                    {/* Card 2 — Total Earned (accent) */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, ...spring }}
                        className="md:col-span-1 bg-primary-500/7 bride bride-primary-500/20 rounded-2xl p-5 relative overflow-hidden group hover:bg-primary-600/20 transition-colors">
                        <div className="absolute -bottom-10 -left-10 size-32 bg-primary-600 blur-[50px] opacity-30 pointer-events-none" />
                        <div className="relative z-10 flex flex-col min-h-[190px] justify-between">
                            <div className="flex justify-between items-start">
                                <div className="size-10 rounded-xl bg-primary-600/20 bride bride-primary-500/30 flex items-center justify-center text-primary-400">
                                    <FiZap className="size-5" />
                                </div>
                                <span className="text-[10px] font-medium text-primary-400 bg-primary-200/15 px-2.5 py-1 rounded-full">
                                    {isLoading ? "—" : `${payouts.length} claim${payouts.length !== 1 ? "s" : ""}`}
                                </span>
                            </div>
                            <div className="mt-4">
                                <p className="text-[11px] text-primary-400/70 uppercase tracking-widest font-medium mb-1">Total Payout Earned</p>
                                <p className="text-3xl font-bold text-white tracking-tight">
                                    {isLoading ? "—" : `₹${totalPayout.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                                </p>
                                <p className="text-[13px] text-primary-400/60 mt-2 flex items-center gap-1">
                                    <FiCheckCircle className="size-3" /> Auto-credited to your account
                                </p>
                            </div>
                            <Link to="/claims" className="mt-4 flex items-center gap-1 text-[11px] text-primary-400 hover:text-primary-300 transition-colors font-medium">
                                Full claim history <FiArrowUpRight className="size-3" />
                            </Link>
                        </div>
                    </motion.div>

                    {/* Card 3 — Latest Payout */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ...spring }}
                        className="md:col-span-2 xl:col-span-1 bg-white/5 bride bride-white/10 rounded-2xl p-5 hover:bg-white/8 transition-colors">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-[15px] font-semibold text-white">Latest Payout</p>
                            {latestPayout && (
                                <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                                    latestPayout.status === 'REJECTED'
                                        ? 'text-red-400 bg-red-500/10'
                                        : 'text-primary-400 bg-primary-200/15'
                                }`}>
                                    {latestPayout.status === 'REJECTED' ? 'Rejected' : 'Processed'}
                                </span>
                            )}
                        </div>
                        {isLoading ? (
                            <div className="h-28 bg-white/5 rounded-xl animate-pulse" />
                        ) : latestPayout ? (
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`size-10 rounded-xl bg-white/5 bride bride-white/10 flex items-center justify-center shrink-0 ${
                                        latestPayout.status === 'REJECTED' ? 'text-red-400' : 'text-primary-500'
                                    }`}>
                                        {latestPayout.status === 'REJECTED' ? <FiX className="size-4" /> : <FiCloudRain className="size-4" />}
                                    </div>
                                    <div>
                                        <p className="text-[15px] font-medium text-white">{latestPayout.reason}</p>
                                        <p className="text-[13px] text-slate-500">{latestPayout.date}</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 bride bride-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-slate-500 uppercase tracking-widest mb-0.5">
                                            {latestPayout.status === 'REJECTED' ? 'Claim Status' : 'Amount credited'}
                                        </p>
                                        <p className={`text-xl font-bold ${
                                            latestPayout.status === 'REJECTED' ? 'text-red-400' : 'text-primary-400'
                                        }`}>
                                            {latestPayout.status === 'REJECTED' ? '₹0.00' : `+₹${latestPayout.amount.toFixed(2)}`}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Hours covered</p>
                                        <p className="text-xl font-bold text-white">{latestPayout.disruptedHours}h</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-28 flex flex-col items-center justify-center text-center">
                                <FiAlertTriangle className="size-5 text-slate-600 mb-2" />
                                <p className="text-slate-500 text-sm">No payouts yet</p>
                                <p className="text-slate-600 text-xs mt-0.5">Trigger a disruption to start</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Card 4 — Recent Payouts List (wide) */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ...spring }}
                        className="md:col-span-2 bg-white/5 bride bride-white/10 rounded-2xl p-5 hover:bg-white/8 transition-colors">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-[15px] font-semibold text-white">Payout History</p>
                            <Link to="/claims" className="text-[11px] text-primary-400 hover:text-primary-300 flex items-center gap-1 font-medium transition-colors">
                                See all <FiArrowUpRight className="size-3" />
                            </Link>
                        </div>
                        {isLoading ? (
                            <div className="flex flex-col gap-2">
                                {[1, 2].map(i => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}
                            </div>
                        ) : payouts.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {payouts.slice(0, 4).map((p, i) => {
                                    const isRejected = p.status === 'REJECTED';
                                    return (
                                        <motion.div key={p._id}
                                            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.06 + 0.3, ...spring }}
                                            className="flex items-center justify-between px-4 py-2.5 bg-white/5 bride bride-white/5 rounded-xl hover:bg-white/8 hover:bride-white/10 transition-all group cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`size-8 rounded-xl bg-white/5 bride bride-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors shrink-0 ${
                                                    isRejected ? 'text-red-400' : 'text-primary-500'
                                                }`}>
                                                    {isRejected ? <FiX className="size-3.5" /> : <FiCloudRain className="size-3.5" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[15px] font-medium text-white leading-tight">{p.reason}</p>
                                                        {isRejected && (
                                                            <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full font-medium">
                                                                Rejected
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[13px] text-slate-500 mt-0.5">{p.date} · {p.disruptedHours}hrs</p>
                                                </div>
                                            </div>
                                            <span className={`font-semibold text-[15px] ${isRejected ? 'text-slate-500' : 'text-primary-400'}`}>
                                                {isRejected ? "₹0.00" : `+₹${p.amount.toFixed(2)}`}
                                            </span>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-24 flex items-center justify-center text-slate-600 text-sm">
                                No payout history found
                            </div>
                        )}
                    </motion.div>

                    {/* Card 5 — Quick Nav (tall narrow) */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ...spring }}
                        className="md:col-span-2 xl:col-span-1 bg-white/5 bride bride-white/10 rounded-2xl p-5 flex flex-col gap-2 hover:bg-white/8 transition-colors">
                        <p className="text-[15px] font-semibold text-white mb-2">Quick Access</p>
                        {[
                            { to: "/policy", label: "My Policy", sub: "Coverage details", icon: <FiShield /> },
                            { to: "/claims", label: "Claims History", sub: "All payouts", icon: <FiCloudRain /> },
                            { to: "/profile", label: "Profile", sub: "Account & settings", icon: <FiCheckCircle /> },
                        ].map((item, i) => (
                            <Link key={i} to={item.to}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/8 bride bride-transparent hover:bride-white/10 transition-all group">
                                <div className="size-8 rounded-xl bg-white/5 bride bride-white/10 flex items-center justify-center text-primary-500 group-hover:bg-primary-600/20 group-hover:bride-primary-500/20 transition-colors shrink-0">
                                    <span className="size-3.5">{item.icon}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors">{item.label}</p>
                                    <p className="text-[10px] text-slate-500">{item.sub}</p>
                                </div>
                                <FiArrowUpRight className="size-3.5 text-slate-600 group-hover:text-primary-400 transition-colors ml-auto" />
                            </Link>
                        ))}
                    </motion.div>

                </div>
            </div>
        </AppShell>
    );
}
