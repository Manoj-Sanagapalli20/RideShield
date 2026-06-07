'use client'
import { motion } from "motion/react";

export default function CTASection() {
    return (
        <motion.div className="max-w-5xl py-12 md:py-16 mt-20 md:mt-40 md:pl-20 md:w-full mx-4 md:mx-auto flex flex-col md:flex-row gap-8 md:gap-6 items-center justify-between text-center md:text-left bg-gradient-to-b from-primary-900 to-primary-950 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-primary-500/10"
            initial={{ y: 150, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 320, damping: 70, mass: 1 }}
        >
            <div>
                <motion.h1 className="text-3xl md:text-[46px] md:leading-tight font-bold bg-gradient-to-r from-white to-primary-400 text-transparent bg-clip-text"
                    initial={{ y: 80, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 280, damping: 70, mass: 1 }}
                >
                    Ready to try-out this app?
                </motion.h1>
                <motion.p className="bg-gradient-to-r from-white/90 to-primary-400/90 text-transparent bg-clip-text text-base md:text-lg mt-2"
                    initial={{ y: 80, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 200, damping: 70, mass: 1 }}
                >
                    Your next favourite tool is just one click away.
                </motion.p>
            </div>
            <motion.button className="px-12 py-3 text-slate-800 bg-white hover:bg-slate-200 rounded-full text-base md:text-sm mt-4"
                initial={{ y: 80, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 280, damping: 70, mass: 1 }}
            >
                Get Started
            </motion.button>
        </motion.div>
    );
}
