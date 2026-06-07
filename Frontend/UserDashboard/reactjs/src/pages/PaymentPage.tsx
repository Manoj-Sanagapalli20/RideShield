import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Lock, Smartphone, CheckCircle } from "lucide-react";
import { motion } from "motion/react";
import toast from "react-hot-toast";

export default function PaymentPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [method, setMethod] = useState<"card" | "upi">("card");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Get plan details pushed from PlanSelectionPage
    const plan = location.state?.plan || { name: 'Standard RideShield', price: 149 };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Mock a partner ID from localStorage, or use a default test ID
            const partnerData = localStorage.getItem('rideShieldUser');
            let partnerId = localStorage.getItem('partnerId') || 'drv_test_123';
            let emailAddress = 'driver@rideshield.com';
            
            if (partnerData) {
                const parsed = JSON.parse(partnerData);
                // Strictly use the verified localStorage token, skipping faulty payload schemas
                emailAddress = parsed.email || emailAddress;
            }

            const response = await fetch('http://localhost:5002/api/policy/select-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partnerId: partnerId,
                    email: emailAddress,
                    planName: plan.name,
                    amount: plan.price
                })
            });

            if (response.ok) {
                setSuccess(true);
                // Mark user as having an active policy so they don't see Plan pages
                localStorage.setItem('hasActivePlan', 'true');
                toast.success("Payment successful! Receipt sent via Email.", { icon: '💳' });
                setTimeout(() => {
                    navigate('/dashboard');
                }, 2000);
            } else {
                toast.error("Payment failed. Please try again.");
                setLoading(false);
            }
        } catch (error) {
            toast.error("Stripe/Network error encountered.");
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="size-24 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-6"
                >
                    <CheckCircle size={48} />
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">Payment Successful</h2>
                <p className="text-slate-400">Redirecting to your dashboard...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
            {/* Minimal Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <Link to="/select-plan" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 w-fit mx-auto sm:mx-0">
                    <ArrowLeft size={16} />
                    <span>Back to Plans</span>
                </Link>

                <div className="bg-[#1C1C1E] bride bride-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
                    {/* Header simulating Stripe Checkout */}
                    <div className="p-6 bride-b bride-white/5 flex gap-4 items-center">
                        <div className="size-12 rounded-full bride bride-white/10 bg-white/5 flex justify-center items-center font-bold text-white shadow-inner">
                            NP
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-300 opacity-80">RideShield Coverage</span>
                            <span className="text-xl font-bold text-white tracking-tight">₹{plan.price}.00 <span className="text-xs text-slate-500 font-normal uppercase tracking-wider ml-1">Weekly</span></span>
                        </div>
                    </div>

                    <div className="p-6 pb-4">
                        <p className="text-slate-400 text-sm font-medium mb-4">Select Payment Method</p>
                        <div className="flex rounded-lg bg-black/40 p-1 mb-6 bride bride-white/5">
                            <button
                                type="button"
                                onClick={() => setMethod("card")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all ${method === "card" ? "bg-[#2C2C2E] text-white shadow" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
                            >
                                <CreditCard size={16} /> Card
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod("upi")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all ${method === "upi" ? "bg-[#2C2C2E] text-white shadow" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
                            >
                                <Smartphone size={16} /> UPI
                            </button>
                        </div>

                        <form onSubmit={handlePayment} className="space-y-4">
                            {method === "card" && (
                                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                    <div className="space-y-1">
                                        <div className="relative flex items-center bg-[#2C2C2E] bride bride-transparent focus-within:bride-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 rounded-lg overflow-hidden transition-all">
                                            <div className="pl-3 pr-2 text-slate-400">💳</div>
                                            <input type="text" placeholder="Card number" className="w-full bg-transparent text-white py-3 pr-3 text-sm outline-none placeholder:text-slate-500" required />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="relative flex items-center bg-[#2C2C2E] bride bride-transparent focus-within:bride-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 rounded-lg overflow-hidden transition-all">
                                            <input type="text" placeholder="MM / YY" className="w-full bg-transparent text-white py-3 px-3 text-sm outline-none placeholder:text-slate-500" required />
                                        </div>
                                        <div className="relative flex items-center bg-[#2C2C2E] bride bride-transparent focus-within:bride-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 rounded-lg overflow-hidden transition-all">
                                            <input type="text" placeholder="CVC" className="w-full bg-transparent text-white py-3 px-3 text-sm outline-none placeholder:text-slate-500" required />
                                        </div>
                                    </div>
                                    <div className="relative flex items-center bg-[#2C2C2E] bride bride-transparent focus-within:bride-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 rounded-lg overflow-hidden transition-all">
                                        <input type="text" placeholder="Name on card" className="w-full bg-transparent text-white py-3 px-3 text-sm outline-none placeholder:text-slate-500" />
                                    </div>
                                </motion.div>
                            )}

                            {method === "upi" && (
                                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                    <div className="relative flex items-center bg-[#2C2C2E] bride bride-transparent focus-within:bride-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 rounded-lg overflow-hidden transition-all mt-2">
                                        <div className="pl-3 pr-2 text-slate-400">
                                            <Smartphone size={16} />
                                        </div>
                                        <input type="text" placeholder="Enter UPI ID (e.g. name@bank)" className="w-full bg-transparent text-white py-3 pr-3 text-sm outline-none placeholder:text-slate-500" required />
                                    </div>
                                    <p className="text-xs text-slate-500 px-1">Ensure you have your banking app ready to approve the mandate.</p>
                                </motion.div>
                            )}

                            <button 
                                type="submit" 
                                disabled={loading}
                                className={`w-full mt-6 py-3.5 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading && (
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                )}
                                {loading ? 'Processing...' : `Pay ₹${plan.price}.00`}
                            </button>
                        </form>
                    </div>

                    <div className="bg-[#141415] p-4 flex items-center justify-center gap-2 bride-t bride-white/5">
                        <Lock size={12} className="text-slate-500" />
                        <span className="text-[11px] text-slate-500 font-medium tracking-wide">Payments are secured and encrypted by Stripe Setup</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
