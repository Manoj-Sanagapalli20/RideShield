'use client'
import { ChevronRightIcon, ArrowUpRightIcon } from "lucide-react";
import TiltedImage from "../components/TiltImage";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";

export default function HeroSection() {
    const navigate = useNavigate();

    return (
        <div className="relative flex flex-col items-center justify-center px-4 md:px-16 lg:px-24 xl:px-32 pb-20">
            <div className="absolute top-30 -z-10 left-1/4 size-72 bg-primary-600 blur-[300px]"></div>
            <motion.a href="#" className="group flex items-center gap-2 rounded-full p-1 pr-3 mt-32 md:mt-44 text-primary-100 bg-primary-200/15"
                initial={{ y: -20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
            >
                <span className="bg-primary-800 text-white text-xs px-1 py-1 rounded-full">
                    
                </span>
                <p className="flex items-center gap-1">
                    <span>Built for Rapido captains</span>
                    <ChevronRightIcon size={16} className="group-hover:translate-x-0.5 transition duration-300" />
                </p>
            </motion.a>
            <motion.h1 className="text-4xl/tight md:text-6xl/tight lg:text-7xl/tight  max-w-4xl text-center tracking-tight"
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 240, damping: 70, mass: 1 }}
            >
                Take control of your{" "}
                <span className="whitespace-nowrap">
                    income <span>with certainty</span>
                </span>
            </motion.h1>
            <motion.p className="text-base md:text-lg text-center text-slate-300 max-w-lg mt-6 px-4"
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
            >
                Parametric insurance designed specifically for food captains. The money arrives before you wake up.</motion.p>
            <motion.div className="flex items-center gap-4 mt-8"
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 320, damping: 70, mass: 1 }}
            >
                <motion.button 
                    onClick={() => navigate('/login')}
                    initial="initial"
                    whileHover="hover"
                    whileTap={{ scale: 0.95 }}
                    className="group flex items-center justify-center gap-2 bg-primary-600 text-white font-medium rounded-full px-7 h-11 transition-colors cursor-pointer"
                >
                    Get started
                    <div className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
                        <motion.div
                            variants={{
                                initial: { x: 0, y: 0 },
                                hover: { x: 24, y: -24 }
                            }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="absolute"
                        >
                            <ArrowUpRightIcon size={20} className="text-white" />
                        </motion.div>
                        <motion.div
                            variants={{
                                initial: { x: -24, y: 24 },
                                hover: { x: 0, y: 0 }
                            }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="absolute"
                        >
                            <ArrowUpRightIcon size={20} className="text-white" />
                        </motion.div>
                    </div>
                </motion.button>
            </motion.div>

            <TiltedImage />
        </div>
    );
}
