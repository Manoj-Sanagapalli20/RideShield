import SectionTitle from "../components/SectionTitle";
import { motion } from "motion/react";

export default function HowItWorksSection() {
    const steps = [
        {
            number: "01",
            icon: "",
            title: "Connect your Rapido ID",
            description: "Log in with your existing Rapido Captain ID. No new account, no KYC hassle.",
            why: "Why Rapido ID? We verify you're an active partner and track ride data to confirm real income loss — not fake claims."
        },
        {
            number: "02",
            icon: "",
            title: "Pick a weekly plan",
            description: "Choose Basic, Standard, or Pro. Pay weekly — just like your earnings cycle. No long-term lock-in.",
            why: "Why weekly? Rapido pays weekly. Your insurance should work the same way."
        },
        {
            number: "03",
            icon: "",
            title: "Wake up to your payout",
            description: "If rain, pollution, or a bandh disrupted your work yesterday, the payout is already in your UPI by 6 AM.",
            why: "We process the full previous day every morning — so even late-night disruptions are never missed."
        }
    ];

    return (
        <div id="how-it-works" className="px-4 md:px-16 lg:px-24 xl:px-32 py-32 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary-500/10 blur-[120px] rounded-full -z-10 pointer-events-none"></div>

            <SectionTitle 
                text1="How it works" 
                text2="Covered in three simple steps" 
                text3="No complicated forms. No agents. No branch visits. Just connect, pay, and we handle everything else." 
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mt-20 max-w-7xl mx-auto relative">
                {/* Connecting wire for desktop */}
                <div className="hidden md:block absolute top-[44px] left-[15%] w-[70%] h-[2px] bg-gradient-to-r from-transparent via-primary-500/20 to-transparent -z-10"></div>

                {steps.map((step, index) => (
                    <motion.div key={index} 
                        className="flex flex-col items-center text-center h-full relative"
                        initial={{ y: 50, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.15, type: "spring", stiffness: 320, damping: 70 }}
                    >
                        <div className="w-24 h-24 bg-black bride bride-primary-500/20 rounded-2xl mb-8 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(var(--color-primary-500),0.1)] relative z-10">
                            <span className="text-xl leading-none font-bold text-primary-500 mb-1">{step.number}</span>
                            <span className="text-3xl leading-none">{step.icon}</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">{step.title}</h3>
                        <p className="text-slate-300 text-base mb-8 leading-relaxed max-w-sm">
                            {step.description}
                        </p>
                        <div className="mt-auto bg-primary-950/30 bride bride-primary-900/30 rounded-xl p-5 text-sm text-primary-100/70 text-left w-full relative">
                            {step.why}
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary-600 rounded-l-xl"></div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
