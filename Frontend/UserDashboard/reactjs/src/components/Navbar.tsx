import { MenuIcon, XIcon, ArrowUpRightIcon } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { navlinks } from "../data/navlinks";
import type { INavLink } from "../types";
import { NavLink, useNavigate } from "react-router-dom";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    return (
        <>
            <motion.nav className="fixed top-0 z-50 flex items-center justify-between w-full py-4 px-6 md:px-16 lg:px-24 xl:px-32 backdrop-blur-md bg-black/10 bride-b bride-white/5"
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 250, damping: 70, mass: 1 }}
            >
                <a href="/" className="flex items-center gap-2 group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="24" viewBox="0 0 71 36" fill="none" className="text-primary-500 group-hover:scale-110 transition-transform">
                        <g>
                            <path d="M 37.787 1.454 C 38.71 0.594 39.989 0.106 41.327 0.102 L 58.466 0.102 C 69.611 0.102 75.192 12.54 67.31 19.814 L 50.146 35.66 C 49.358 36.387 48.011 35.872 48.011 34.842 L 48.011 20.887 L 49.994 19.056 C 51.571 17.6 50.455 15.114 48.225 15.114 L 22.991 15.114 L 37.787 1.454 Z" fill="currentColor"></path>
                            <path d="M 33.213 34.545 C 32.29 35.405 31.011 35.894 29.673 35.898 L 12.534 35.898 C 1.389 35.898 -4.192 23.46 3.69 16.186 L 20.854 0.34 C 21.642 -0.387 22.99 0.129 22.99 1.157 L 22.99 15.113 L 21.006 16.944 C 19.429 18.4 20.545 20.886 22.775 20.886 L 48.009 20.886 L 33.211 34.545 Z" fill="currentColor"></path>
                        </g>
                    </svg>
                    <span className="text-2xl tracking-tight text-white group-hover:text-primary-400 transition-colors">RideShield</span>
                </a>

                <div className="hidden md:flex items-center gap-8 transition duration-500">
                    {navlinks.map((link: INavLink) => (
                        <NavLink key={link.name} to={link.href} className="hover:text-primary-500 text-md transition">
                            {link.name}
                        </NavLink>
                    ))}
                </div> 

                <motion.button 
                    onClick={() => navigate('/login')}
                    initial="initial"
                    whileHover="hover"
                    whileTap={{ scale: 0.95 }}
                    className="hidden md:flex items-center justify-center gap-1.5 bg-primary-600 text-white font-medium rounded-full px-5 py-2 h-[38px] transition-colors cursor-pointer"
                >
                    Get started
                    <div className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
                        <motion.div
                            variants={{
                                initial: { x: 0, y: 0 },
                                hover: { x: 24, y: -24 }
                            }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="absolute"
                        >
                            <ArrowUpRightIcon size={16} className="text-white" />
                        </motion.div>
                        <motion.div
                            variants={{
                                initial: { x: -24, y: 24 },
                                hover: { x: 0, y: 0 }
                            }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="absolute"
                        >
                            <ArrowUpRightIcon size={16} className="text-white" />
                        </motion.div>
                    </div>
                </motion.button>
                <button onClick={() => setIsOpen(true)} className="md:hidden text-white p-2 bride bride-white/10 rounded-xl bg-white/5 active:scale-90 transition">
                    <MenuIcon size={24} />
                </button>
            </motion.nav>

            <div className={`fixed inset-0 z-100 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center text-xl gap-8 md:hidden transition-all duration-500 ease-in-out ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none translate-y-10"}`}>
                <div className="flex flex-col items-center gap-6">
                    {navlinks.map((link: INavLink, i) => (
                        <motion.div
                            key={link.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={isOpen ? { opacity: 1, y: 0 } : {}}
                            transition={{ delay: i * 0.1 }}
                        >
                            <NavLink 
                                to={link.href} 
                                onClick={() => setIsOpen(false)}
                                className={({ isActive }) => `text-2xl font-semibold tracking-tight transition ${isActive ? 'text-primary-500' : 'text-white/80 hover:text-white'}`}
                            >
                                {link.name}
                            </NavLink>
                        </motion.div>
                    ))}
                    <motion.button 
                        onClick={() => { navigate('/login'); setIsOpen(false); }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={isOpen ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: 0.3 }}
                        className="mt-4 px-10 py-4 bg-primary-600 text-white font-bold rounded-full shadow-lg shadow-primary-500/20 active:scale-95 transition-transform"
                    >
                        Get Started
                    </motion.button>
                </div>
                
                <button 
                    onClick={() => setIsOpen(false)} 
                    className="absolute bottom-12 size-14 flex items-center justify-center bg-white/10 bride bride-white/10 text-white rounded-full active:scale-90 transition group hover:bg-white/20"
                >
                    <XIcon size={28} className="rotate-0 group-hover:rotate-90 transition-transform duration-300" />
                </button>
            </div>
        </>
    );
}
