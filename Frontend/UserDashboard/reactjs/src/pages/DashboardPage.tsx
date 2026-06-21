import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
    FiShield, FiCloudRain, FiCheckCircle, FiArrowUpRight,
    FiMapPin, FiX, FiAlertTriangle, FiUser, FiCalendar, FiTrendingUp, FiActivity, FiHelpCircle, FiSun, FiWind
} from "react-icons/fi";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";

const PAYMENT_SERVICE = "http://localhost:5003";
const POLICY_SERVICE = "http://localhost:5002";
const ML_SERVICE = "http://localhost:8000";

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

interface PolicyData {
    planName: string;
    dailyWage: number;
    status: string;
    premiumAmount?: number;
}

const spring = { type: "spring" as const, stiffness: 280, damping: 60 };

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

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

const isRealDisruption = (reason: string) => {
    if (!reason) return false;
    const lower = reason.toLowerCase();
    if (lower.includes("below the rideshield threshold") || lower.includes("clear weather")) {
        return false;
    }
    if (lower.includes("disruption")) {
        if (lower.includes("no strike disruptions")) {
            return false;
        }
        return true;
    }
    return false;
};

const formatRejectionReason = (reason: string) => {
    if (!reason) return { mainReason: "", details: [] };
    let clean = reason.startsWith("Rejected: ") ? reason.substring(10) : reason;
    
    let mainReason = clean;
    let details: string[] = [];
    
    const rejectionsIndex = clean.indexOf("Rejections: ");
    if (rejectionsIndex !== -1) {
        mainReason = clean.substring(0, rejectionsIndex).trim();
        if (mainReason.endsWith('.')) {
            mainReason = mainReason.slice(0, -1);
        }
        const detailsStr = clean.substring(rejectionsIndex + 12).trim();
        details = detailsStr.split(',').map(s => s.trim()).filter(Boolean);
    } else {
        const shiftIndex = clean.indexOf("(Shift: ");
        if (shiftIndex !== -1) {
            mainReason = clean.substring(0, shiftIndex).trim();
            if (mainReason.endsWith('.')) {
                mainReason = mainReason.slice(0, -1);
            }
            const shiftStr = clean.substring(shiftIndex).trim();
            details = [shiftStr];
        }
    }
    return { mainReason, details };
};


export default function DashboardPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
    const cityParam = searchParams.get("city");
    const dateParam = searchParams.get("date");
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
    const [advisory, setAdvisory] = useState<{ severity: string; title: string; advisories: string[]; shiftSuggestion?: string | null; metrics?: Record<string, number> } | null>(null);
    const [isAdvisoryLoading, setIsAdvisoryLoading] = useState(false);
    const navigate = useNavigate();

    const userId = localStorage.getItem("partnerId") || "";
    const user = localStorage.getItem("rideShieldUser")
        ? JSON.parse(localStorage.getItem("rideShieldUser")!)
        : null;
    const firstName = user?.name?.split(" ")[0] || "Driver";
    const fullName = user?.name || "RideShield Partner";

    const loadData = async () => {
        setIsLoading(true);
        let fetchedPayouts = [];
        try {
            const [payoutRes, policyRes] = await Promise.allSettled([
                fetch(`${PAYMENT_SERVICE}/api/disruption-payouts/${userId}`),
                fetch(`${POLICY_SERVICE}/api/policy/user/${userId}`),
            ]);
            if (payoutRes.status === "fulfilled" && payoutRes.value.ok) {
                const d = await payoutRes.value.json();
                fetchedPayouts = d.payouts || [];
                setPayouts(fetchedPayouts);
                setTotalPayout(d.totalAmount || 0);
            }
            if (policyRes.status === "fulfilled" && policyRes.value.ok) {
                setPolicy(await policyRes.value.json());
            }
        } catch (e) { console.error(e); }
        setIsLoading(false);
        return fetchedPayouts;
    };

    const loadAdvisory = async (lat: number, lng: number, pincode?: string) => {
        setIsAdvisoryLoading(true);
        try {
            const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
            if (pincode) params.append("pincode", pincode);
            const res = await fetch(`${ML_SERVICE}/api/ml/smart-advisory?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setAdvisory(data);
            }
        } catch (e) { console.error("Advisory fetch failed:", e); }
        setIsAdvisoryLoading(false);
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

            // 1. If parameters are not in URL, do NOT trigger automatically
            if (!city || !date) {
                loadData();
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
                    const res = await fetch(`http://localhost:8000/api/ml/geocode?city=${encodeURIComponent(city)}`);
                    const d = await res.json();
                    if (d && d.success) {
                        lat = d.lat;
                        lon = d.lng;
                        if (!pc) {
                            pc = d.pincode || "";
                        }
                        setSearchParams({ city, date, lat: String(lat), lng: String(lon), pincode: pc }, { replace: true });
                    } else {
                        lat = 16.0145;
                        lon = 80.7828;
                        pc = "522256";
                        setSearchParams({ city, date, lat: String(lat), lng: String(lon), pincode: pc }, { replace: true });
                    }
                }

                // Fetch tomorrow's advisory for the resolved location
                loadAdvisory(lat!, lon!, pc);

                setAnalysisStage("Contacting weather station via GPS coordinates...");
                pushLocation(lat!, lon!, date, pc);

                setTimeout(() => {
                    setAnalysisStage("Retrieving partner shift activity logs...");
                }, 900);

                setTimeout(() => {
                    setAnalysisStage("Verifying hourly rain and social alerts...");
                }, 1800);

                setTimeout(async () => {
                    const firstFetch = await loadData();
                    setIsAnalyzing(false);

                    // Polling for the new payout to be written to DB asynchronously
                    const targetDate = date;
                    const hasNewPayout = firstFetch.some(p => p.date === targetDate);
                    if (!hasNewPayout) {
                        let attempts = 0;
                        const interval = setInterval(async () => {
                            attempts++;
                            const currentFetch = await loadData();
                            const found = currentFetch.some(p => p.date === targetDate);
                            if (found || attempts >= 5) {
                                clearInterval(interval);
                            }
                        }, 2000);
                    }
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
        setIsFetchingLocation(true);
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
                    const geoRes = await fetch(`http://localhost:8000/api/ml/reverse?lat=${lat}&lng=${lon}`);
                    const geoData = await geoRes.json();
                    if (geoData && geoData.success) {
                        const cityVal = geoData.city;
                        const pc = geoData.pincode || "";
                        loadAdvisory(lat, lon, pc);
                        setSearchParams({ city: cityVal, date: todayStr, lat: String(lat), lng: String(lon), pincode: pc });
                    } else {
                        throw new Error("Reverse geocoding failed");
                    }
                } catch {
                    loadAdvisory(lat, lon);
                    setSearchParams({ city: "Live GPS Location", date: todayStr, lat: String(lat), lng: String(lon) });
                } finally {
                    setIsFetchingLocation(false);
                }
            },
            (_err) => {
                alert("GPS access denied or timed out.");
                setIsFetchingLocation(false);
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
    const activePremium = policy ? (policy.premiumAmount || premiumMap[policy.planName] || 35) : 0;

    // Weekly cap calculation for UI remaining budget display
    const planNameClean = policy?.planName?.toLowerCase().trim() || "";
    const weeklyLimitMap: Record<string, number> = {
        basic: 400,
        standard: 600,
        medium: 600,
        pro: 800,
        "pro shield": 800
    };
    const weeklyLimit = weeklyLimitMap[planNameClean] || 600;

    const isPayoutPaid = (p) => {
        const dateStr = p.createdAt || p.timestamp || p.date;
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

    const getWeeklySpent = () => {
        if (!payouts || payouts.length === 0) return 0;
        
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = now.getDay();
        startOfWeek.setDate(now.getDate() - day);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const processedPayoutsThisWeek = payouts.filter(p => {
            if (p.status !== 'PROCESSED') return false;
            if (!isPayoutPaid(p)) return false;
            let pDate;
            if (p.date) {
                const parts = p.date.split('-');
                pDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
            } else {
                pDate = new Date(p.createdAt || p.timestamp || '');
            }
            return pDate >= startOfWeek && pDate <= endOfWeek;
        });

        return processedPayoutsThisWeek.reduce((sum, p) => sum + (p.amount || 0), 0);
    };

    const getWeeklyApprovedAwaiting = () => {
        if (!payouts || payouts.length === 0) return 0;
        
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = now.getDay();
        startOfWeek.setDate(now.getDate() - day);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const awaitingPayoutsThisWeek = payouts.filter(p => {
            if (p.status !== 'PROCESSED') return false;
            if (isPayoutPaid(p)) return false;
            let pDate;
            if (p.date) {
                const parts = p.date.split('-');
                pDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
            } else {
                pDate = new Date(p.createdAt || p.timestamp || '');
            }
            return pDate >= startOfWeek && pDate <= endOfWeek;
        });

        return awaitingPayoutsThisWeek.reduce((sum, p) => sum + (p.amount || 0), 0);
    };

    const getWeeklyPending = () => {
        if (!payouts || payouts.length === 0) return 0;
        
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = now.getDay();
        startOfWeek.setDate(now.getDate() - day);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const pendingPayoutsThisWeek = payouts.filter(p => {
            if (p.status !== 'REVIEW') return false;
            let pDate;
            if (p.date) {
                const parts = p.date.split('-');
                pDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
            } else {
                pDate = new Date(p.createdAt || p.timestamp || '');
            }
            return pDate >= startOfWeek && pDate <= endOfWeek;
        });

        return pendingPayoutsThisWeek.reduce((sum, p) => sum + (p.amount || 0), 0);
    };

    const weeklySpent = getWeeklySpent();
    const weeklyAwaiting = getWeeklyApprovedAwaiting();
    const weeklyPending = getWeeklyPending();
    const remainingWeeklyBudget = Math.max(0, weeklyLimit - weeklySpent - weeklyAwaiting);

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
                                {policy && (
                                    <>
                                        <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-white/5">
                                            <div>
                                                <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Weekly Credited</span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-sm font-semibold text-white">₹{weeklySpent.toFixed(2)}</span>
                                                    {weeklySpent > 0 && (
                                                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">Credited to UPI</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Remaining Weekly Limit</span>
                                                <span className="text-sm font-bold text-emerald-400">₹{remainingWeeklyBudget.toFixed(2)} / ₹{weeklyLimit}</span>
                                            </div>
                                        </div>
                                        {weeklyPending > 0 && (
                                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 border-dashed">
                                                <div>
                                                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Weekly Pending Review</span>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-sm font-semibold text-white">₹{weeklyPending.toFixed(2)}</span>
                                                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse">Awaiting Admin Approval</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {weeklyAwaiting > 0 && (
                                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 border-dashed">
                                                <div>
                                                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Weekly Approved (Awaiting Payout)</span>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-sm font-semibold text-white">₹{weeklyAwaiting.toFixed(2)}</span>
                                                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">Approved (Payout at 6:00 AM)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                {(policy?.planName?.toLowerCase().trim() === 'pro' || policy?.planName?.toLowerCase().trim() === 'premium') && (
                                    <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg w-fit">
                                        <span>⚡ Priority Instant Settlement Active</span>
                                    </div>
                                )}
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

                            {!cityParam || !dateParam ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-baseline">
                                        <h2 className="text-xl font-bold text-slate-400 tracking-tight">No Active Simulation</h2>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 font-medium flex items-center gap-2">
                                        <FiHelpCircle className="size-4 shrink-0 text-slate-500" />
                                        Please select a location using the 'Simulate disruption' button to test weather checks.
                                    </div>
                                </div>
                            ) : activePayout ? (
                                activePayout.status === 'PROCESSED' ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-baseline">
                                            <h2 className="text-2xl font-bold text-white tracking-tight">
                                                {activePayout.reason.includes("Rain") ? "Rain Active" : activePayout.reason.includes("Strike") ? "Strike Active" : "Disruption Active"}
                                            </h2>
                                            <span className="text-xs font-semibold text-emerald-400">
                                                {activePayout.disruptedHours}h Disrupted
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full w-[85%]" />
                                        </div>
                                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium flex items-center gap-2">
                                            <FiAlertTriangle className="size-3.5 shrink-0" />
                                            Payout Triggered: +₹{activePayout.amount.toFixed(2)} dispatched!
                                        </div>
                                    </div>
                                ) : activePayout.status === 'REVIEW' ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-baseline">
                                            <h2 className="text-2xl font-bold text-white tracking-tight">
                                                Verification Pending
                                            </h2>
                                            <span className="text-xs font-semibold text-amber-400 animate-pulse">
                                                Awaiting Review
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-500 rounded-full w-[50%] animate-pulse" />
                                        </div>
                                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-medium flex items-center gap-2">
                                            <FiAlertTriangle className="size-3.5 shrink-0" />
                                            Awaiting review by the Zone Manager. Disruption detected, but ML Risk Engine requires manual validation.
                                        </div>
                                    </div>
                                ) : (() => {
                                    const isFraud = activePayout.reason.toLowerCase().includes("fraud") || activePayout.reason.toLowerCase().includes("anomaly");
                                    return (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-baseline">
                                                <h2 className="text-2xl font-bold tracking-tight text-white">
                                                    {isFraud ? "Fraud/Anomaly Alert" : !isRealDisruption(activePayout.reason) ? "Clear Weather" : "Disruption Detected"}
                                                </h2>
                                                <span className={`text-xs font-semibold ${isFraud ? "text-red-400 font-bold" : "text-slate-500"}`}>
                                                    {isFraud ? "Blocked by Risk Engine" : !isRealDisruption(activePayout.reason) ? "0% Intensity" : "Claim Rejected"}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div className={`h-full ${isFraud ? "bg-red-500 w-[100%]" : "bg-slate-700 w-0"}`} />
                                            </div>
                                            {isFraud ? (
                                                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium flex items-center gap-2">
                                                    <FiAlertTriangle className="size-3.5 shrink-0" />
                                                    Blocked: {activePayout.reason.replace("Rejected: ", "")}
                                                </div>
                                            ) : !isRealDisruption(activePayout.reason) ? (
                                                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium flex items-center gap-2">
                                                    <FiCheckCircle className="size-3.5 shrink-0" />
                                                    Parametric Monitoring Active. Safe Hours.
                                                </div>
                                            ) : (() => {
                                                const { mainReason, details } = formatRejectionReason(activePayout.reason);
                                                return (
                                                    <div className="w-full p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400 font-medium flex flex-col gap-2.5">
                                                        <div className="flex items-start gap-2.5">
                                                            <FiAlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
                                                            <div>
                                                                <span className="font-bold text-amber-300 block mb-0.5">Unpaid Disruption</span>
                                                                <span className="text-amber-400/90 leading-relaxed">{mainReason}</span>
                                                            </div>
                                                        </div>
                                                        {details.length > 0 && (
                                                            <div className="pt-2.5 border-t border-amber-500/10">
                                                                <span className="text-[10px] text-amber-500/50 uppercase tracking-wider font-bold block mb-2">Hourly Details</span>
                                                                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                                                                    {details.map((d, idx) => (
                                                                        <div key={idx} className="flex items-start gap-2 text-[11px] text-amber-500/80 bg-amber-500/5 p-2 rounded border border-amber-500/10 leading-normal">
                                                                            <span className="inline-block size-1 rounded-full bg-amber-500/50 mt-1.5 shrink-0" />
                                                                            <span>{d}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })()
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
                        className="bg-[#121214] border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[220px]">
                        <div>
                            <div className="flex justify-between items-start">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Premium Plan</h3>
                                <Link to="/policy" className="text-[10px] font-bold text-primary-400 hover:text-primary-300 transition-colors uppercase tracking-wider flex items-center gap-0.5">
                                    + Upgrade
                                </Link>
                            </div>
                            <div className="mt-4 space-y-3">
                                <div>
                                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Weekly Auto-Debit</span>
                                    <h2 className="text-3xl font-extrabold text-white tracking-tight">₹{activePremium}.00</h2>
                                </div>

                                {policy && (
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center">
                                            {activePremium - (premiumMap[policy.planName] || 35) > 0 ? (
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                                    +₹{activePremium - (premiumMap[policy.planName] || 35)} Weather Surcharge
                                                </span>
                                            ) : activePremium - (premiumMap[policy.planName] || 35) < 0 ? (
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                                    -₹{Math.abs(activePremium - (premiumMap[policy.planName] || 35))} Weather Discount
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                                                    Standard Base Rate
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-normal font-medium">
                                            {policy.explanation || "Standard weekly base rate is active for your policy."}
                                        </p>
                                    </div>
                                )}

                                <div className="text-[10px] text-slate-500 flex flex-col gap-1 pt-1 border-t border-white/5 font-medium leading-relaxed">
                                    <div className="flex items-center gap-1">
                                        <FiCalendar className="size-3 text-slate-600" />
                                        <span>Next Billing: Next Monday</span>
                                    </div>
                                    <p className="text-slate-600 text-[9px] italic">
                                        Note: XGBoost weather pricing engine runs every Monday at 5:00 AM.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-white/5 flex items-center gap-2 mt-4">
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
                        onClick={() => latestPayout && setSelectedPayout(latestPayout)}
                        className="bg-[#121214] border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[200px] cursor-pointer hover:border-white/20 transition-all group"
                    >
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                Latest Payout <span className="text-[9px] text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">(View Receipt)</span>
                            </h3>
                            {latestPayout && (
                                <span className={`text-[9px] px-2 py-0.5 border rounded font-semibold uppercase tracking-wider ${
                                    latestPayout.status === 'REJECTED'
                                        ? 'text-red-400 bg-red-500/10 border-red-500/25'
                                        : latestPayout.status === 'REVIEW'
                                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                                            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                                }`}>
                                    {latestPayout.status === 'REJECTED' ? 'Rejected' : latestPayout.status === 'REVIEW' ? 'Reviewing' : 'Approved'}
                                </span>
                            )}
                        </div>
                        {isLoading ? (
                            <div className="h-28 bg-white/5 rounded-xl animate-pulse" />
                        ) : latestPayout ? (
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                                        latestPayout.status === 'REJECTED'
                                            ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                                            : latestPayout.status === 'REVIEW'
                                                ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                                : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                    }`}>
                                        {latestPayout.status === 'REJECTED' ? <FiX className="size-4" /> : latestPayout.status === 'REVIEW' ? <FiAlertTriangle className="size-4" /> : <FiCloudRain className="size-4" />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white line-clamp-2">{getApprovedReasonOnly(latestPayout.reason)}</p>
                                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{latestPayout.date}</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 flex items-center justify-between">
                                    <div>
                                        <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Credit amount</span>
                                        <span className={`text-base font-bold ${latestPayout.status === 'REJECTED' ? 'text-slate-500' : latestPayout.status === 'REVIEW' ? 'text-amber-400' : 'text-emerald-400'}`}>
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

                    {/* Card 7 — Smart Work Advisory (full width) */}
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33, ...spring }}
                        className="md:col-span-2 xl:col-span-3 bg-gradient-to-br from-[#0d1117] to-[#121214] border border-white/10 rounded-2xl p-6 relative overflow-hidden"
                    >
                        {/* Background glow */}
                        <div className="absolute -top-16 -right-16 size-48 rounded-full pointer-events-none"
                            style={{ background: advisory?.severity === 'critical' ? 'rgba(239,68,68,0.06)' : advisory?.severity === 'warning' ? 'rgba(234,179,8,0.06)' : advisory?.severity === 'caution' ? 'rgba(251,146,60,0.06)' : 'rgba(16,185,129,0.06)', filter: 'blur(60px)' }}
                        />
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`size-9 rounded-xl flex items-center justify-center border ${
                                        advisory?.severity === 'critical' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                        advisory?.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                        advisory?.severity === 'caution' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    }`}>
                                        {advisory?.severity === 'safe' ? <FiSun className="size-4" /> : advisory?.severity === 'critical' ? <FiAlertTriangle className="size-4" /> : <FiWind className="size-4" />}
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">Smart Work Advisory</span>
                                        <h3 className="text-sm font-bold text-white">{advisory ? advisory.title : isAdvisoryLoading ? 'Loading tomorrow\'s forecast...' : 'Set location to see advisory'}</h3>
                                    </div>
                                </div>
                                {advisory?.metrics && (
                                    <div className="hidden md:flex items-center gap-4">
                                        {[
                                            { label: 'Peak Rain', value: `${advisory.metrics.peakPrecipitation} mm/hr` },
                                            { label: 'Max Temp', value: `${advisory.metrics.peakTemperature}°C` },
                                            { label: 'Peak AQI', value: String(advisory.metrics.peakAqi) },
                                        ].map(m => (
                                            <div key={m.label} className="text-right">
                                                <span className="text-[9px] text-slate-600 uppercase tracking-wider block">{m.label}</span>
                                                <span className="text-xs font-bold text-slate-300">{m.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {isAdvisoryLoading ? (
                                <div className="flex flex-col gap-2">
                                    {[1,2].map(i => <div key={i} className="h-9 bg-white/5 rounded-xl animate-pulse" />)}
                                </div>
                            ) : advisory ? (
                                <div className="space-y-2">
                                    {advisory.advisories.map((msg, idx) => (
                                        <div key={idx} className={`flex items-start gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium ${
                                            advisory.severity === 'critical' ? 'bg-red-500/5 border-red-500/15 text-red-300' :
                                            advisory.severity === 'warning' ? 'bg-yellow-500/5 border-yellow-500/15 text-yellow-300' :
                                            advisory.severity === 'caution' ? 'bg-orange-500/5 border-orange-500/15 text-orange-300' :
                                            'bg-emerald-500/5 border-emerald-500/15 text-emerald-300'
                                        }`}>
                                            <span className="leading-relaxed">{msg}</span>
                                        </div>
                                    ))}
                                    {advisory.shiftSuggestion && (
                                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500/5 border border-primary-500/20 text-primary-300 text-xs font-semibold">
                                            <FiCalendar className="size-3.5 shrink-0" />
                                            {advisory.shiftSuggestion}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-16 flex items-center justify-center text-slate-600 text-xs font-semibold border border-white/5 rounded-xl bg-white/[0.01]">
                                    Simulate a location to receive tomorrow's smart advisory
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Card 8 — Payout History (wide, bottom row) */}
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
                                                onClick={() => setSelectedPayout(p)}
                                                className="flex items-center justify-between px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-white/10 transition-all group cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                                        isRejected ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                    }`}>
                                                        {isRejected ? <FiX className="size-3.5" /> : <FiCloudRain className="size-3.5" />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-xs font-bold text-white leading-tight">{getApprovedReasonOnly(p.reason)}</p>
                                                            {isRejected && (
                                                                <span className="text-[8px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                                    Rejected
                                                                </span>
                                                            )}
                                                            {!isRejected && p.status === 'PROCESSED' && (
                                                                isPayoutPaid(p) ? (
                                                                    <span className="text-[8px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                                        Credited to UPI
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[8px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                                                                        Awaiting Payout
                                                                    </span>
                                                                )
                                                            )}
                                                            {p.priority === 'high' && !isRejected && (
                                                                <span className="text-[8px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                                    ⚡ Priority Dispatched
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                                            {p.date} · {p.disruptedHours} hrs covered
                                                            <span className="text-primary-400 opacity-0 group-hover:opacity-100 transition-all ml-2 font-medium">
                                                                · View Receipt →
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`font-bold text-sm shrink-0 ml-4 ${isRejected ? 'text-slate-500' : 'text-emerald-400'}`}>
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
