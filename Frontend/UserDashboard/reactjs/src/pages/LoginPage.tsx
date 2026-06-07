import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

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
            const response = await fetch("http://localhost:5001/auth/login", {
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="24" viewBox="0 0 71 36" fill="none">
                        <path d="M 37.787 1.454 C 38.71 0.594 39.989 0.106 41.327 0.102 L 58.466 0.102 C 69.611 0.102 75.192 12.54 67.31 19.814 L 50.146 35.66 C 49.358 36.387 48.011 35.872 48.011 34.842 L 48.011 20.887 L 49.994 19.056 C 51.571 17.6 50.455 15.114 48.225 15.114 L 22.991 15.114 L 37.787 1.454 Z" fill="currentColor" className="text-white" />
                        <path d="M 33.213 34.545 C 32.29 35.405 31.011 35.894 29.673 35.898 L 12.534 35.898 C 1.389 35.898 -4.192 23.46 3.69 16.186 L 20.854 0.34 C 21.642 -0.387 22.99 0.129 22.99 1.157 L 22.99 15.113 L 21.006 16.944 C 19.429 18.4 20.545 20.886 22.775 20.886 L 48.009 20.886 L 33.211 34.545 Z" fill="currentColor" className="text-white" />
                    </svg>
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
                <div className="bg-white/[0.03] bride bride-white/10 py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 backdrop-blur-xl">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 bride bride-red-500/50 text-red-400 text-sm text-center">
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
                                    className="block w-full appearance-none rounded-xl bride bride-white/10 bg-white/5 pl-11 px-3 py-3 text-white placeholder-slate-600 focus:bride-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm transition-colors"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`group flex w-full justify-center items-center gap-2 rounded-xl bride bride-transparent bg-primary-600 py-3.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-black transition-all ${isLoading ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                            >
                                {isLoading ? "Verifying..." : "Verify & Connect"}
                                {!isLoading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 bride-t bride-white/10 pt-6">
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
