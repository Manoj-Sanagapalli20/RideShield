'use client'
import SectionTitle from "../components/SectionTitle"
import { pricingData } from "../data/pricing";
import type { IPricing } from "../types";
import { CheckIcon } from "lucide-react";
import { motion } from "motion/react";

export default function PricingSection() {
    return (
        <div id="pricing" className="px-4 md:px-16 lg:px-24 xl:px-32 py-24">
            <SectionTitle 
                text1="Pricing" 
                text2="Simple, weekly plans" 
                text3="Protect your income exactly how Rapido pays you — weekly. No hidden fees or lock-ins." 
            />

            <div className="flex flex-wrap items-stretch justify-center gap-8 mt-20 max-w-6xl mx-auto px-4">
                {pricingData.map((plan: IPricing, index: number) => (
                    <motion.div key={index} className={`w-full max-w-sm md:w-80 flex flex-col text-left bride p-6 md:p-8 rounded-2xl transition duration-300 ${plan.mostPopular ? 'bg-primary-950/20 bride-primary-500/50 relative shadow-xl shadow-primary-500/10' : 'bg-white/[0.02] bride-white/10'}`}
                        initial={{ y: 50, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.15, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
                    >
                        {plan.mostPopular && (
                            <p className="absolute px-4 text-[11px] font-bold uppercase tracking-wider -top-3 left-1/2 -translate-x-1/2 py-1.5 bg-primary-500 text-white rounded-full">Most Popular</p>
                        )}
                        <p className="font-medium text-lg text-primary-400 mb-2">{plan.name}</p>
                        <h1 className="text-5xl font-bold text-white mb-8 bride-b bride-white/10 pb-8 tracking-tight">
                            ₹{plan.price}<span className="text-slate-500 font-medium text-lg ml-1">/{plan.period}</span>
                        </h1>
                        <ul className="list-none text-slate-300 space-y-5 mb-10 flex-grow">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-4">
                                    <div className="size-5 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckIcon className="size-3.5 text-primary-500" strokeWidth={3} />
                                    </div>
                                    <p className="text-[15px] leading-snug">{feature}</p>
                                </li>
                            ))}
                        </ul>
                        <button type="button" className={`w-full py-3.5 rounded-xl font-medium tracking-wide transition-all ${plan.mostPopular ? 'bg-primary-500 text-white hover:bg-primary-600' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                            Select {plan.name}
                        </button>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
