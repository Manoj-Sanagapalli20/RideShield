import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
    FiShield, FiCloudRain, FiCheckCircle, FiArrowUpRight,
    FiMapPin, FiX, FiZap, FiAlertTriangle, FiUser, FiCalendar, FiTrendingUp, FiActivity, FiHelpCircle
} from "react-icons/fi";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
    const [searchParams, setSearchParams] = useSearchParams();
    const cityParam = searchParams.get("city");
    const dateParam = searchParams.get("date");
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const pincodeParam = searchParams.get("pincode");

    const [showLocationModal, setShowLocationModal] = useState(() => !cityParam || !dateParam);
    const [manualCity, setManualCity] = useState(cityParam || "Vijayawada");
    const [manualPincode, setManualPincode] = useState(pincodeParam || "522503");
    const [manualDate, setManualDate] = useState(() => {
        if (dateParam) return dateParam;
        const d = new Date();
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split("T")[0];
    });

    const [currentZone, setCurrentZone] = useState(() => {
        return cityParam ? `${cityParam} Zone` : "Bhattiprolu Zone";
    });
    const [currentDate, setCurrentDate] = useState(() => {
        if (dateParam) return dateParam;
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
    const [lastTriggered, setLastTriggered] = useState("");
    const navigate = useNavigate();

    const userId = localStorage.getItem("partnerId") || "";
    const user = localStorage.getItem("rideShieldUser")
        ? JSON.parse(localStorage.getItem("rideShieldUser")!)
        : null;
    const firstName = user?.name?.split(" ")[0] || "Driver";
    const fullName = user?.name || "RideShield Partner";

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

    useEffect(() => {
        if (!userId) { navigate("/login"); return; }

        const checkSimulation = async () => {
            const city = searchParams.get("city");
            const date = searchParams.get("date");
            const latStr = searchParams.get("lat");
            const lngStr = searchParams.get("lng");
            const pincode = searchParams.get("pincode") || "";

            // 1. If parameters are not in URL, run GPS detection or fallback
            if (!city || !date) {
                navigator.geolocation?.getCurrentPosition(
                    async (p) => {
                        const lat = p.coords.latitude;
                        const lon = p.coords.longitude;
                        const d = new Date();
                        const offset = d.getTimezoneOffset();
                        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
                        const todayStr = localDate.toISOString().split("T")[0];
                        try {
                            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                            const geoData = await geoRes.json();
                            const addr = geoData.address || {};
                            const cityVal = addr.city || addr.town || addr.municipality || addr.village || addr.county || "Live GPS Location";
                            const pc = addr.postcode || "";
                            setSearchParams({ city: cityVal, date: todayStr, lat: String(lat), lng: String(lon), pincode: pc });
                            setShowLocationModal(false);
                        } catch (e) {
                            setSearchParams({ city: "Live GPS Location", date: todayStr, lat: String(lat), lng: String(lon) });
                            setShowLocationModal(false);
                        }
                    },
                    (err) => {
                        // Fallback to Bhattiprolu
                        const d = new Date();
                        const offset = d.getTimezoneOffset();
                        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
                        const todayStr = localDate.toISOString().split("T")[0];
                        setSearchParams({ city: "Bhattiprolu", date: todayStr, lat: "16.0145", lng: "80.7828", pincode: "522256" });
                    },
                    { timeout: 5000 }
                );
                return;
            }

            // 2. Prevent infinite simulation loop
            const triggerKey = `${city}_${date}`;
            if (triggerKey === lastTriggered) {
                loadData();
                return;
            }

            setLastTriggered(triggerKey);
            setCurrentZone(`${city} Zone`);
            setCurrentDate(date);
            setManualCity(city);
            setManualDate(date);
            setManualPincode(pincode);

            setIsAnalyzing(true);
            setAnalysisStage("Contacting regional weather stations...");

            try {
                let lat = latStr ? parseFloat(latStr) : null;
                let lon = lngStr ? parseFloat(lngStr) : null;
                let pc = pincode;

                if (lat === null || lon === null) {
                    setAnalysisStage(`Searching coordinates for ${city}...`);
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&addressdetails=1`);
                    const d = await res.json();
                    if (d && d.length > 0) {
                        lat = parseFloat(d[0].lat);
                        lon = parseFloat(d[0].lon);
                        if (!pc) {
                            pc = d[0].address?.postcode || "";
                        }
                        setSearchParams({ city, date, lat: String(lat), lng: String(lon), pincode: pc }, { replace: true });
                    } else {
                        lat = 16.0145;
                        lon = 80.7828;
                        pc = "522256";
                    }
                }

                setAnalysisStage("Contacting weather station via GPS coordinates...");
                pushLocation(lat, lon, date, pc);

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

            } catch (err) {
                console.error("Simulation failed:", err);
                setIsAnalyzing(false);
                loadData();
            }
        };

        checkSimulation();
    }, [userId, searchParams, lastTriggered]);

    const handleCurrentLocation = () => {
        navigator.geolocation?.getCurrentPosition(
            async (p) => {
                const lat = p.coords.latitude;
                const lon = p.coords.longitude;
                const d = new Date();
                const offset = d.getTimezoneOffset();
                const localDate = new Date(d.getTime() - (offset * 60 * 1000));
                const todayStr = localDate.toISOString().split("T")[0];

                setLastTriggered("");
                setShowLocationModal(false);
                setIsAnalyzing(true);
                setAnalysisStage("Resolving live GPS location coordinates...");

                try {
                    const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                    const geoData = await geoRes.json();
                    const addr = geoData.address || {};
                    const cityVal = addr.city || addr.town || addr.municipality || addr.village || addr.county || "Live GPS Location";
                    const pc = addr.postcode || "";
                    setSearchParams({ city: cityVal, date: todayStr, lat: String(lat), lng: String(lon), pincode: pc });
                } catch (err) {
                    setSearchParams({ city: "Live GPS Location", date: todayStr, lat: String(lat), lng: String(lon) });
                }
            },
            (err) => {
                alert("GPS access denied or timed out.");
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    };

    const handleManualLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        setLastTriggered("");
        setSearchParams({ city: manualCity, date: manualDate, pincode: manualPincode });
        setShowLocationModal(false);
    };

    const latestPayout = payouts[0];
    const activePayout = payouts.find(p => p.date === currentDate);
    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

    // Premium logic dynamically based on selected plan
    const premiumMap: Record<string, number> = {
        "Basic": 20,
        "Standard": 35,
        "Pro": 49,
        "Pro Shield": 49
    };
    const activePremium = policy ? (premiumMap[policy.planName] || 35) : 0;

    // SVG Circular progress gauge stats
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const recoveryRate = totalPayout > 0 ? 78 : 0;
    const strokeDashoffset = circumference - (recoveryRate / 100) * circumference;

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
                            className="bg-[#121214] border border-white/10 p-7 rounded-2xl shadow-2xl max-w-sm w-full text-white relative"
                        >
                            <button onClick={() => setShowLocationModal(false)} className="absolute top-4 right-4 text-white/30 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                                <FiX size={15} />
                            </button>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="size-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-500">
                                    <FiMapPin className="size-4" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold">Set Work Location</h2>
                                    <p className="text-[11px] text-slate-500">For disruption simulation</p>
                                </div>
                            </div>
                            <motion.button whileTap={{ scale: 0.97 }} onClick={handleCurrentLocation}
                                className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium text-sm mb-4 flex justify-center items-center gap-2 transition-colors shadow-lg shadow-primary-600/20">
                                <FiMapPin size={13} /> Use Live GPS
                            </motion.button>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-px bg-white/5 flex-1" />
                                <span className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">or manual</span>
                                <div className="h-px bg-white/5 flex-1" />
                            </div>
                            <form onSubmit={handleManualLocation} className="space-y-3">
                                {[
                                    { label: "City", val: manualCity, set: setManualCity, ph: "e.g. Vijayawada...", type: "text", req: true },
                                    { label: "Pincode", val: manualPincode, set: setManualPincode, ph: "e.g. 522503", type: "text", req: false },
                                    { label: "Simulate Date", val: manualDate, set: setManualDate, ph: "", type: "date", req: true },
                                ].map(f => (
                                    <div key={f.label}>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1.5 block">{f.label}</label>
                                        <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required={f.req}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500/50 text-white placeholder:text-slate-700 transition-colors" />
                                    </div>
                                ))}
                                <button type="submit" disabled={isFetchingLocation}
                                    className="w-full py-2.5 bg-white/5 hover:bg-white/8 rounded-xl text-sm border border-white/10 transition-colors disabled:opacity-40 font-medium text-slate-200">
                                    {isFetchingLocation ? "Locating..." : "Fetch Smart Report"}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dashboard Content */}
            <div className="p-4 md:p-6 relative max-w-7xl mx-auto space-y-6">

                {/* ── HERO WELCOME ROW ───────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, ...spring }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-[11px] text-primary-400 uppercase tracking-widest font-bold mb-1">{today}</p>
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            {getGreeting()}, <span className="text-primary-400">{firstName}</span> 👋
                        </h1>
                        <p className="text-sm text-slate-400 mt-0.5">Your parametric income protection is active.</p>
                    </div>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setShowLocationModal(true)}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-primary-600/20 shrink-0">
                        <FiMapPin className="size-4 animate-bounce" /> Simulate disruption
                    </motion.button>
                </motion.div>

                {/* ── BENTO GRID ───────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                    {/* Card 1 — Shield / Policy Card (premium visual style) */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, ...spring }}
                        className="bg-gradient-to-br from-[#1c1c1e] to-[#121214] border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute -top-12 -right-12 size-36 bg-primary-500/10 blur-[50px] rounded-full pointer-events-none" />
                        <div className="relative z-10 flex flex-col h-full justify-between min-h-[200px]">
                            <div className="flex justify-between items-start">
                                <div className="size-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-400">
                                    <FiShield className="size-5" />
                                </div>
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                    isLoading ? "bg-white/5 text-slate-500 animate-pulse" : policy ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                                }`}>
                                    {isLoading ? "Checking" : policy ? "● Coverage Active" : "● No Plan"}
                                </span>
                            </div>
                            <div className="my-4">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Policy holder</span>
                                <h3 className="text-lg font-bold text-white tracking-tight">{fullName}</h3>
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                                    <div>
                                        <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Protected Daily Wage</span>
                                        <span className="text-sm font-semibold text-white">₹{policy?.dailyWage || "0"}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Plan Type</span>
                                        <span className="text-sm font-semibold text-primary-400">{policy?.planName || "—"}</span>
                                    </div>
                                </div>
                            </div>
                            <Link to="/policy" className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium">
                                View Policy Details <FiArrowUpRight className="size-3.5" />
                            </Link>
                        </div>
                    </motion.div>

                    {/* Card 2 — Quick Action Grid (NichePay style) */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, ...spring }}
                        className="bg-[#121214] border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[200px]">
                        <div>
                            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest text-slate-400">Quick Actions</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: "My Policy", to: "/policy", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: <FiShield className="size-4" /> },
                                    { label: "Claims", to: "/claims", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: <FiCloudRain className="size-4" /> },
                                    { label: "Profile", to: "/profile", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <FiUser className="size-4" /> },
                                    { label: "Support", to: "/profile", color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: <FiHelpCircle className="size-4" /> }
                                ].map((act, idx) => (
                                    <Link key={idx} to={act.to}
                                        className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-center group">
                                        <div className={`size-8 rounded-lg flex items-center justify-center border ${act.color} mb-2`}>
                                            {act.icon}
                                        </div>
                                        <span className="text-xs font-semibold text-slate-200 group-hover:text-white">{act.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Card 3 — Live Disruption Monitor (NichePay style) */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ...spring }}
                        className="bg-[#121214] border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[200px] group">
                        <div className="absolute top-4 right-4 flex items-center gap-1.5">
                            <span className="relative flex size-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full size-2 bg-red-500"></span>
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Live</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Disruption Monitor</span>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-1.5">
                                    <FiMapPin className="size-3.5 text-primary-400" />
                                    <span className="text-xs font-semibold text-slate-300">{currentZone}</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{currentDate}</span>
                            </div>

                            {activePayout ? (
                                activePayout.status === 'PROCESSED' ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-baseline">
                                            <h2 className="text-2xl font-bold text-white tracking-tight">
                                                {activePayout.reason.includes("Rain") ? "Rain Active" : activePayout.reason.includes("Strike") ? "Strike Active" : "Disruption Active"}
                                            </h2>
                                            <span className="text-xs font-semibold text-primary-400">
                                                {activePayout.disruptedHours}h Disrupted
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary-500 rounded-full w-[85%]" />
                                        </div>
                                        <div className="p-2.5 rounded-lg bg-primary-500/10 border border-primary-500/20 text-xs text-primary-400 font-medium flex items-center gap-2">
                                            <FiAlertTriangle className="size-3.5 shrink-0" />
                                            Payout Triggered: +₹{activePayout.amount.toFixed(2)} dispatched!
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-baseline">
                                            <h2 className="text-2xl font-bold text-slate-300 tracking-tight">
                                                {activePayout.reason.includes("Clear weather") ? "Clear Weather" : "Disruption Detected"}
                                            </h2>
                                            <span className="text-xs font-semibold text-slate-500">
                                                {activePayout.reason.includes("Clear weather") ? "0% Intensity" : "Claim Rejected"}
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-slate-700 rounded-full w-0" />
                                        </div>
                                        {activePayout.reason.includes("Clear weather") ? (
                                            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium flex items-center gap-2">
                                                <FiCheckCircle className="size-3.5 shrink-0" />
                                                Parametric Monitoring Active. Safe Hours.
                                            </div>
                                        ) : (
                                            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-medium flex items-center gap-2">
                                                <FiAlertTriangle className="size-3.5 shrink-0" />
                                                Unpaid: {activePayout.reason.replace("Rejected: ", "")}
                                            </div>
                                        )}
                                    </div>
                                )
                            ) : (
                                <div className="space-y-3 animate-pulse">
                                    <div className="flex justify-between items-baseline">
                                        <h2 className="text-2xl font-bold text-slate-500 tracking-tight">Loading Reports...</h2>
                                        <span className="text-xs font-semibold text-slate-600">Syncing</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-700 rounded-full w-1/3 animate-bounce" />
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-500 font-medium flex items-center gap-2">
                                        <FiCheckCircle className="size-3.5 shrink-0" />
                                        Retrieving weather indicators for zone...
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Card 4 — Premium Plan & Upgrade */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ...spring }}
                        className="bg-[#121214] border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[200px]">
                        <div>
                            <div className="flex justify-between items-start">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Premium Plan</h3>
                                <Link to="/policy" className="text-[10px] font-bold text-primary-400 hover:text-primary-300 transition-colors uppercase tracking-wider flex items-center gap-0.5">
                                    + Upgrade
                                </Link>
                            </div>
                            <div className="mt-4">
                                <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Weekly Auto-Debit</span>
                                <h2 className="text-3xl font-extrabold text-white tracking-tight">₹{activePremium}.00</h2>
                                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                                    <FiCalendar className="size-3.5" /> Next billing: Next Monday
                                </p>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-white/5 flex items-center gap-2">
                            <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Payments Configured</span>
                        </div>
                    </motion.div>

                    {/* Card 5 — Circular Gauge Statistics */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ...spring }}
                        className="bg-[#121214] border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[200px]">
                        <div className="flex justify-between items-start">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Protection Stats</h3>
                            <span className="text-[10px] font-bold text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded uppercase tracking-wider">This Month</span>
                        </div>
                        <div className="flex items-center gap-6 my-auto">
                            {/* Circular Gauge */}
                            <div className="relative size-18 flex items-center justify-center shrink-0">
                                <svg className="size-full -rotate-90">
                                    <circle cx="36" cy="36" r={radius} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                                    <circle cx="36" cy="36" r={radius} fill="transparent" stroke="var(--color-primary-500)" strokeWidth="6"
                                        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                                </svg>
                                <div className="absolute text-center">
                                    <span className="text-sm font-bold text-white block">{recoveryRate}%</span>
                                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Recov.</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Estimated Income Lost</span>
                                    <span className="text-sm font-bold text-slate-300">₹{(totalPayout * 1.25).toFixed(0)}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Paid by RideShield</span>
                                    <span className="text-sm font-bold text-primary-400">₹{totalPayout.toLocaleString("en-IN")}</span>
                                </div>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 uppercase tracking-wider">Loss recovery performance</span>
                            <span className="text-primary-400 font-semibold flex items-center gap-0.5"><FiTrendingUp size={11} /> Healthy</span>
                        </div>
                    </motion.div>

                    {/* Card 6 — Latest Payout Summary */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ...spring }}
                        className="bg-[#121214] border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[200px]">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Latest Payout</h3>
                            {latestPayout && (
                                <span className={`text-[9px] px-2 py-0.5 border rounded font-semibold uppercase tracking-wider ${
                                    latestPayout.status === 'REJECTED'
                                        ? 'text-red-400 bg-red-500/10 border-red-500/25'
                                        : 'text-primary-400 bg-primary-500/10 border-primary-500/25'
                                }`}>
                                    {latestPayout.status === 'REJECTED' ? 'Rejected' : 'Approved'}
                                </span>
                            )}
                        </div>
                        {isLoading ? (
                            <div className="h-28 bg-white/5 rounded-xl animate-pulse" />
                        ) : latestPayout ? (
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                                        latestPayout.status === 'REJECTED' ? 'text-red-400 bg-red-500/10 border border-red-500/20' : 'text-primary-400 bg-primary-500/10 border border-primary-500/20'
                                    }`}>
                                        {latestPayout.status === 'REJECTED' ? <FiX className="size-4" /> : <FiCloudRain className="size-4" />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white line-clamp-2">{latestPayout.reason}</p>
                                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{latestPayout.date}</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 flex items-center justify-between">
                                    <div>
                                        <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Credit amount</span>
                                        <span className={`text-base font-bold ${latestPayout.status === 'REJECTED' ? 'text-slate-500' : 'text-primary-400'}`}>
                                            {latestPayout.status === 'REJECTED' ? '₹0.00' : `+₹${latestPayout.amount.toFixed(2)}`}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Hours</span>
                                        <span className="text-base font-bold text-white">{latestPayout.disruptedHours}h</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-28 flex flex-col items-center justify-center text-center">
                                <FiAlertTriangle className="size-5 text-slate-600 mb-2" />
                                <p className="text-slate-500 text-xs font-semibold">No parametric claims processed</p>
                                <p className="text-slate-600 text-[10px] mt-0.5">Trigger a location update to test</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Card 7 — Payout History (wide, bottom row) */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, ...spring }}
                        className="md:col-span-2 bg-[#121214] border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Payout History</h3>
                                <Link to="/claims" className="text-[10px] font-bold text-primary-400 hover:text-primary-300 transition-colors uppercase tracking-wider flex items-center gap-0.5">
                                    See All <FiArrowUpRight className="size-3.5" />
                                </Link>
                            </div>
                            {isLoading ? (
                                <div className="flex flex-col gap-2">
                                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}
                                </div>
                            ) : payouts.length > 0 ? (
                                <div className="flex flex-col gap-2.5">
                                    {payouts.slice(0, 4).map((p, i) => {
                                        const isRejected = p.status === 'REJECTED';
                                        return (
                                            <motion.div key={p._id}
                                                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 + 0.4, ...spring }}
                                                className="flex items-center justify-between px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-white/10 transition-all group cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                                        isRejected ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-primary-400 bg-primary-500/10 border-primary-500/20'
                                                    }`}>
                                                        {isRejected ? <FiX className="size-3.5" /> : <FiCloudRain className="size-3.5" />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-xs font-bold text-white leading-tight">{p.reason}</p>
                                                            {isRejected && (
                                                                <span className="text-[8px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                                    Rejected
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{p.date} · {p.disruptedHours} hrs covered</p>
                                                    </div>
                                                </div>
                                                <span className={`font-bold text-sm shrink-0 ml-4 ${isRejected ? 'text-slate-500' : 'text-primary-400'}`}>
                                                    {isRejected ? "₹0.00" : `+₹${p.amount.toFixed(2)}`}
                                                </span>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="h-24 flex items-center justify-center text-slate-600 text-xs font-semibold">
                                    No payouts processed on this account yet
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Card 8 — Performance / Platform Integrity (NichePay style) */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ...spring }}
                        className="bg-[#121214] border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[200px]">
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">System Health</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <FiActivity className="size-3.5 text-primary-400" />
                                        <span className="text-xs font-semibold text-slate-200">ML Risk Engine</span>
                                    </div>
                                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Active</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <FiShield className="size-3.5 text-blue-400" />
                                        <span className="text-xs font-semibold text-slate-200">Fraud Protection</span>
                                    </div>
                                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Secure</span>
                                </div>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                            <span>Last Sync: Real-time</span>
                            <span className="text-primary-400 font-semibold">100% Uptime</span>
                        </div>
                    </motion.div>

                </div>
            </div>
        </AppShell>
    );
}
