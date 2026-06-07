'use client'
import SectionTitle from "../components/SectionTitle";
import { motion } from "motion/react";
import { featuresData } from "../data/features";
import type { IFeature } from "../types";

export default function FeaturesSection() {
    return (
        <div id="features" className="px-4 md:px-16 lg:px-24 xl:px-32 py-24">
            <SectionTitle 
                text1="Features" 
                text2="Designed for gig workers. Built for real life." 
                text3="Every feature exists because a captain needed it — not because it looked good on a spec sheet." 
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16 mt-24 max-w-7xl mx-auto">
                {featuresData.map((feature: IFeature, index: number) => (
                    <motion.div key={index} 
                        className="flex items-start gap-5 group"
                        initial={{ y: 40, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
                    >
                        <div className="flex-shrink-0 mt-1">
                            <div className="size-14 rounded-xl bg-white/5 bride bride-white/10 flex items-center justify-center text-primary-500 group-hover:bg-primary-500/10 group-hover:bride-primary-500/20 transition-colors duration-300 shadow-sm">
                                {feature.icon}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xl font-medium text-white mb-2 tracking-tight group-hover:text-primary-400 transition-colors duration-300">
                                {feature.title}
                            </h3>
                            <p className="text-slate-400 text-[15px] leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
