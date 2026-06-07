import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { pricingData } from "../data/pricing";
import { ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";

export default function PlanSelectionPage() {
    const navigate = useNavigate();
    const [selectedPlan, setSelectedPlan] = useState<number | null>(1); // Default to Standard
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);

    // Prevent showing plan selection if the user already has an active plan
    useEffect(() => {
        const hasAActivePlan = localStorage.getItem('hasActivePlan');
        if (hasAActivePlan === 'true') {
            navigate('/dashboard');
        }
    }, [navigate]);

    const handleConfirm = () => {
        if (termsAccepted && selectedPlan !== null) {
            const planDetails = pricingData[selectedPlan];
            navigate('/payment', { state: { plan: planDetails } });
        }
    };

    return (
        <div className="min-h-screen bg-black pt-16 md:pt-24 pb-12 px-4 relative flex flex-col items-center">
            {/* Minimalist background blur */}
            <div className="absolute top-0 right-1/3 -z-10 w-96 h-96 rounded-full bg-primary-600/10 blur-[100px] pointer-events-none"></div>

            <div className="w-full max-w-5xl relative z-10">
                <Link to="/login" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-12 w-fit">
                    <ArrowLeft size={16} />
                    <span>Back to login</span>
                </Link>

                <div className="mb-12">
                    <motion.h1 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3"
                    >
                        Secure your earnings
                    </motion.h1>
                    <motion.p 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-400 text-lg"
                    >
                        Select your preferred parametric plan below.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {pricingData.map((plan, index) => {
                        const isSelected = selectedPlan === index;

                        return (
                            <motion.div 
                                key={index} 
                                onClick={() => setSelectedPlan(index)}
                                className={`flex flex-col relative p-8 rounded-3xl bride-2 transition-all duration-300 cursor-pointer overflow-hidden ${
                                    isSelected 
                                        ? 'bride-primary-500 bg-primary-950/20 scale-[1.02] shadow-[0_0_40px_rgba(var(--color-primary-500),0.15)]' 
                                        : 'bride-white/10 bg-white/[0.02] hover:bride-white/30'
                                }`}
                                initial={{ y: 30, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: index * 0.1, type: "spring", stiffness: 320, damping: 70 }}
                            >
                                {/* Radio Indicator */}
                                <div className="absolute top-6 right-6">
                                    {isSelected ? (
                                        <CheckCircle2 className="size-6 text-primary-500" />
                                    ) : (
                                        <div className="size-6 rounded-full bride-2 bride-slate-600"></div>
                                    )}
                                </div>

                                <div className="mb-8 pr-8">
                                    <h3 className={`text-2xl font-bold mb-2 ${isSelected ? 'text-primary-400' : 'text-white'}`}>{plan.name}</h3>
                                    <p className="text-slate-400 text-sm">Best for {plan.name.toLowerCase()} coverage requirements.</p>
                                </div>
                                
                                <div className="mb-8 bride-b bride-white/10 pb-8">
                                    <span className="text-4xl font-bold text-white">₹{plan.price}</span>
                                    <span className="text-slate-500 font-medium tracking-wide"> / {plan.period}</span>
                                </div>

                                <ul className="space-y-4 mb-10 flex-grow">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex gap-3 text-slate-300 text-sm">
                                            <div className="mt-1 size-1.5 rounded-full bg-primary-500 shrink-0"></div>
                                            <span className="leading-snug">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setSelectedPlan(index); 
                                        setIsModalOpen(true); 
                                    }}
                                    className={`w-full py-3.5 rounded-xl font-medium tracking-wide transition-all ${
                                        isSelected 
                                            ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-xl shadow-primary-500/20' 
                                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                    }`}
                                >
                                    Continue with {plan.name}
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Terms and Conditions Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 bride bride-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
                        >
                            <div className="p-8 bride-b bride-white/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <ShieldAlert className="text-primary-500" size={24} />
                                    <h2 className="text-2xl font-bold text-white">Terms & Conditions</h2>
                                </div>
                                <p className="text-slate-400 text-sm">Please review the parametric insurance terms to ensure you understand how your weekly payouts are triggered.</p>
                            </div>

                            <div className="p-8 bg-black/20 h-48 overflow-y-auto text-sm text-slate-300 leading-relaxed space-y-4 font-mono">
                                <p>1. <strong className="text-white">Parametric Logic:</strong> Payouts are exclusively triggered by official environmental data and Rapido delivery halts. No manual claims are honored.</p>
                                <p>2. <strong className="text-white">Deduction Authorization:</strong> By proceeding, you authorize the weekly premium of ₹{selectedPlan !== null ? pricingData[selectedPlan].price : ''} to be automatically factored into your RideShield ledger.</p>
                                <p>3. <strong className="text-white">Active Status Requirement:</strong> Coverage is only valid when your Rapido Delivery ID is actively tracking shifts. Inactive driving weeks will automatically pause coverage and billing.</p>
                            </div>

                            <div className="p-8 bride-t bride-white/10 bg-slate-900">
                                <label className="flex items-start gap-4 mb-6 cursor-pointer group">
                                    <div className="relative flex items-center shrink-0 mt-0.5">
                                        <input 
                                            type="checkbox" 
                                            checked={termsAccepted}
                                            onChange={(e) => setTermsAccepted(e.target.checked)}
                                            className="peer appearance-none w-5 h-5 bride-2 bride-slate-600 rounded checked:bg-primary-500 checked:bride-primary-500 transition-colors" 
                                        />
                                        <CheckCircle2 className="absolute top-0 left-0 w-5 h-5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none p-0.5" />
                                    </div>
                                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                        I confirm that I have read, understood, and agree to the fully automated terms of RideShield's gig shield coverage.
                                    </span>
                                </label>

                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleConfirm}
                                        disabled={!termsAccepted}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                                            termsAccepted 
                                                ? 'bg-primary-500 text-white shadow-xl shadow-primary-500/20 hover:bg-primary-600 active:scale-95' 
                                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        }`}
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
