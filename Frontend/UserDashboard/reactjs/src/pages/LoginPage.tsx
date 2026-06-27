import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";


export default function LoginPage() {
    const navigate = useNavigate();
    const [rapidoId, setRapidoId] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        // If the user already has a partnerId stored, skip the login page entirely
        if (localStorage.getItem("partnerId")) {
            if (localStorage.getItem("hasActivePlan") === "true") {
                navigate("/dashboard");
            } else {
                navigate("/select-plan");
            }
        }
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const BACKEND_IP = import.meta.env.VITE_BACKEND_IP || "localhost";
            const response = await fetch(`http://${BACKEND_IP}:5001/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ partnerId: rapidoId }),
            });

            const data = await response.json();

            if (response.ok) {
                const partnerId = data.partner?.partnerId || rapidoId;
                
                // Save truthy info from backend
                localStorage.setItem("partnerId", partnerId);
                localStorage.setItem("rideShieldUser", JSON.stringify(data.partner || {}));

                if (data.hasPlan) {
                    localStorage.setItem("hasActivePlan", "true");
                    navigate("/dashboard");
                } else {
                    localStorage.removeItem("hasActivePlan");
                    navigate("/select-plan");
                }
            } else {
                setError(data.message || "Failed to login");
            }
        } catch (err) {
            setError("Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background glowing effects */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-primary-600/20 blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-primary-600/10 blur-[100px] pointer-events-none"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <Link to="/" className="flex items-center justify-center gap-2 mb-8">
                    <Logo className="size-8" />
                    <span className="text-2xl font-bold tracking-tight text-white">RideShield</span>
                </Link>
                
                <motion.h2 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-center text-3xl font-semibold tracking-tight text-white"
                >
                    Connect your Rapido ID
                </motion.h2>
                <motion.p 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="mt-2 text-center text-sm text-slate-400"
                >
                    No new accounts. Just pure automation.
                </motion.p>
            </div>

            <motion.div 
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
            >
                <div className="bg-white/[0.03] border border-white/10 py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 backdrop-blur-xl">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}
                        <div>
                            <label htmlFor="rapidoId" className="block text-sm font-medium text-slate-300">
                                Rapido Partner ID
                            </label>
                            <div className="mt-2 relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-medium">ZM-</span>
                                <input
                                    id="rapidoId"
                                    name="rapidoId"
                                    type="text"
                                    value={rapidoId}
                                    onChange={(e) => setRapidoId(e.target.value)}
                                    autoComplete="off"
                                    required
                                    placeholder="847291"
                                    className="block w-full appearance-none rounded-xl border border-white/10 bg-white/5 pl-11 px-3 py-3 text-white placeholder-slate-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm transition-colors"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`group flex w-full justify-center items-center gap-2 rounded-xl border border-transparent bg-primary-600 py-3.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-black transition-all ${isLoading ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                            >
                                {isLoading ? "Verifying..." : "Verify & Connect"}
                                {!isLoading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 border-t border-white/10 pt-6">
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                            <ShieldCheck size={16} className="text-primary-500" />
                            <span>Your data is securely encrypted at rest.</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
