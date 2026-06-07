import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { FiUser, FiMail, FiPhone, FiMapPin, FiShield, FiCheckCircle, FiEdit3, FiSmartphone, FiLock, FiBriefcase } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

const spring = { type: "spring" as const, stiffness: 300, damping: 70, mass: 1 };

export default function ProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const partnerId = localStorage.getItem("partnerId");
    const user = localStorage.getItem("rideShieldUser") ? JSON.parse(localStorage.getItem("rideShieldUser")!) : null;

    useEffect(() => {
        if (!partnerId) { navigate("/"); return; }
        fetch(`http://localhost:5002/api/policy/profile/${partnerId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => setProfile(data?.partner || null))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [partnerId, navigate]);

    const displayName = profile?.name || user?.name || "Driver";
    const displayEmail = profile?.email || user?.email || "—";
    const displayPhone = profile?.phone || profile?.mobile || "—";
    const displayCity = profile?.city || "India";

    const infoFields = [
        { label: "Full Name", value: displayName, icon: <FiUser /> },
        { label: "Email Address", value: displayEmail, icon: <FiMail /> },
        { label: "Phone Number", value: displayPhone, icon: <FiPhone /> },
        { label: "City", value: displayCity, icon: <FiMapPin /> },
        { label: "Partner ID", value: partnerId || "—", icon: <FiBriefcase /> },
    ];

    const accountLinks = [
        { label: "Change Password", icon: <FiLock />, desc: "Update your account password" },
        { label: "Linked Devices", icon: <FiSmartphone />, desc: "Manage your trusted devices" },
        { label: "Insurance Documents", icon: <FiShield />, desc: "Download policy certificates" },
    ];

    return (
        <AppShell title="Profile" subtitle="Your account information">
            <div className="p-4 md:p-6 lg:p-8 relative">
                <div className="absolute top-0 right-1/3 size-64 bg-primary-600 blur-[200px] opacity-10 pointer-events-none" />

                {/* Profile Hero */}
                <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}
                    className="bg-white/5 bride bride-white/10 rounded-2xl p-6 md:p-8 mb-5 flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
                    {/* Avatar icon */}
                    <div className="relative shrink-0">
                        <div className="size-20 rounded-2xl bg-white/5 bride bride-white/10 flex items-center justify-center">
                            <FiUser className="size-9 text-primary-500" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-primary-600 bride-2 bride-black flex items-center justify-center">
                            <FiCheckCircle className="size-2.5 text-white" />
                        </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                        {isLoading ? (
                            <>
                                <div className="h-6 w-36 bg-white/10 rounded-xl animate-pulse mb-2 mx-auto sm:mx-0" />
                                <div className="h-3.5 w-48 bg-white/5 rounded-xl animate-pulse mx-auto sm:mx-0" />
                            </>
                        ) : (
                            <>
                                <h2 className="text-xl font-semibold text-white tracking-tight">{displayName}</h2>
                                <p className="text-slate-500 text-sm mt-0.5">{displayEmail}</p>
                            </>
                        )}
                        <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start flex-wrap">
                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-primary-400 bg-primary-200/15 px-2.5 py-1 rounded-full">
                                <FiShield className="size-2.5" /> RideShield Member
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-primary-400 bg-primary-200/15 px-2.5 py-1 rounded-full">
                                <FiCheckCircle className="size-2.5" /> Verified
                            </span>
                        </div>
                    </div>

                    <button className="shrink-0 flex items-center gap-2 text-[11px] font-medium text-slate-400 hover:text-white bg-white/5 bride bride-white/10 px-4 py-2.5 rounded-xl transition-all hover:bg-white/8">
                        <FiEdit3 className="size-3.5" /> Edit Profile
                    </button>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 relative z-10">
                    {/* Info Fields */}
                    <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, ...spring }}
                        className="lg:col-span-3 bg-white/5 bride bride-white/10 rounded-2xl p-6">
                        <h3 className="font-semibold text-white text-base tracking-tight mb-4">Personal Information</h3>
                        <div className="flex flex-col gap-2">
                            {infoFields.map((field, i) => (
                                <motion.div key={i}
                                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.06 + 0.2, ...spring }}
                                    className="flex items-center gap-4 bg-white/5 bride bride-white/5 rounded-xl px-4 py-3.5 hover:bg-white/8 hover:bride-white/10 transition-all group"
                                >
                                    <div className="size-8 rounded-xl bg-white/5 bride bride-white/10 flex items-center justify-center text-primary-500 shrink-0 group-hover:bg-primary-600/20 group-hover:bride-primary-500/20 transition-colors">
                                        <span className="size-3.5">{field.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-slate-600 uppercase tracking-widest font-medium mb-0.5">{field.label}</p>
                                        {isLoading ? (
                                            <div className="h-3.5 w-32 bg-white/10 rounded-lg animate-pulse" />
                                        ) : (
                                            <p className="text-[15px] font-medium text-white truncate">{field.value}</p>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Right column */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        {/* Account Settings */}
                        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.18, ...spring }}
                            className="bg-white/5 bride bride-white/10 rounded-2xl p-5">
                            <h3 className="font-semibold text-white text-base tracking-tight mb-4">Account Settings</h3>
                            <div className="flex flex-col gap-2">
                                {accountLinks.map((link, i) => (
                                    <button key={i}
                                        className="flex items-center gap-3 bg-white/5 bride bride-white/5 rounded-xl px-4 py-3 hover:bg-white/8 hover:bride-white/10 transition-all group text-left"
                                    >
                                        <div className="size-8 rounded-xl bg-white/5 bride bride-white/10 flex items-center justify-center text-primary-500 shrink-0 group-hover:bg-primary-600/20 group-hover:bride-primary-500/20 transition-colors">
                                            <span className="size-3.5">{link.icon}</span>
                                        </div>
                                        <div>
                                            <p className="text-[15px] font-medium text-white group-hover:text-primary-400 transition-colors">{link.label}</p>
                                            <p className="text-[13px] text-slate-500">{link.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>

                        {/* Shield Status */}
                        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25, ...spring }}
                            className="bg-white/5 bride bride-white/10 rounded-2xl p-5 relative overflow-hidden">
                            <div className="absolute -bottom-8 -right-8 size-24 bg-primary-600 blur-[50px] opacity-20 pointer-events-none" />
                            <div className="relative z-10 flex items-center gap-3 mb-3">
                                <div className="size-9 rounded-xl bg-white/5 bride bride-white/10 flex items-center justify-center text-primary-500">
                                    <FiShield className="size-4" />
                                </div>
                                <p className="text-sm font-medium text-white">Insurance Status</p>
                            </div>
                            <div className="relative z-10 flex items-center gap-2 mb-1">
                                <div className="size-1.5 bg-primary-400 rounded-full animate-pulse" />
                                <span className="text-sm font-medium text-primary-400">Active & Protected</span>
                            </div>
                            <p className="relative z-10 text-[13px] text-slate-500 leading-relaxed">
                                Parametric shield is active. Payouts trigger automatically during disruption events.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
