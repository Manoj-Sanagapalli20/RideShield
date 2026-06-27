import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { FiGrid, FiFileText, FiClock, FiLogOut, FiUser, FiMenu, FiX } from "react-icons/fi";
import { Logo } from "./Logo";


const navLinks = [
    { to: "/dashboard", icon: <FiGrid />, label: "Dashboard" },
    { to: "/policy", icon: <FiFileText />, label: "My Policy" },
    { to: "/claims", icon: <FiClock />, label: "Claims History" },
    { to: "/profile", icon: <FiUser />, label: "Profile" },
];

interface AppShellProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
}

export default function AppShell({ children, title, subtitle }: AppShellProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem("partnerId");
        localStorage.removeItem("rideShieldUser");
        navigate("/");
    };

    return (
        <div className="flex h-[100dvh] bg-black overflow-hidden font-poppins relative">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-56 bg-black border-r border-white/5 flex-col justify-between shrink-0">
                <SidebarInner navLinks={navLinks} location={location} onClose={() => {}} onLogout={handleLogout} />
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden w-full">
                {/* Header */}
                <header className="h-16 bg-black/90 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 md:px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-base font-semibold text-white tracking-tight">{title}</h1>
                            {subtitle && <p className="text-[13px] text-slate-500">{subtitle}</p>}
                        </div>
                    </div>
                    {/* Logo pill like landing page */}
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                        <Logo className="size-5" />
                        <span className="text-sm font-medium text-white/70 tracking-tight">RideShield</span>
                    </div>
                </header>

                {/* Main Scroll Content */}
                <div className="flex-1 overflow-y-auto pb-10 lg:pb-0">
                    {children}
                </div>
            </main>

            {/* Floating Shield Action Button (FAB) for Mobile/Tablet */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`fixed bottom-6 right-6 z-50 size-14 rounded-full flex items-center justify-center shadow-2xl transition-colors border lg:hidden ${
                    isMenuOpen 
                        ? "bg-[#1c1c1e] border-white/10 text-white" 
                        : "bg-[#0d0d0f] border-primary-500/40 text-primary-400 shadow-primary-500/10"
                }`}
            >
                {isMenuOpen ? (
                    <FiX className="size-5" />
                ) : (
                    <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                    >
                        <Logo className="size-9" />
                    </motion.div>
                )}
            </motion.button>

            {/* Floating Radial Menu Overlay */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/85 backdrop-blur-2xl z-40 lg:hidden flex flex-col justify-center items-center"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        <motion.div
                            initial={{ y: 40, scale: 0.95, opacity: 0 }}
                            animate={{ y: 0, scale: 1, opacity: 1 }}
                            exit={{ y: 40, scale: 0.95, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="w-[90%] max-w-sm flex flex-col gap-6 text-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <span className="text-[10px] text-primary-500 uppercase tracking-widest font-black">Menu Navigation</span>
                            <div className="grid grid-cols-2 gap-3.5">
                                {navLinks.map((link: any, idx: number) => {
                                    const isActive = location.pathname === link.to;
                                    return (
                                        <Link
                                            key={idx}
                                            to={link.to}
                                            onClick={() => setIsMenuOpen(false)}
                                            className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all text-center group ${
                                                isActive
                                                    ? "bg-primary-600/20 border-primary-500/30 text-primary-400"
                                                    : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10 hover:text-white"
                                            }`}
                                        >
                                            <div className={`size-9 rounded-xl flex items-center justify-center border mb-3 transition-colors ${
                                                isActive ? "bg-primary-500/10 border-primary-500/30 text-primary-400" : "bg-white/5 border-white/5 text-slate-400 group-hover:text-white group-hover:border-white/10"
                                            }`}>
                                                {link.icon}
                                            </div>
                                            <span className="text-sm font-bold tracking-tight">{link.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    handleLogout();
                                }}
                                className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all font-bold text-sm flex items-center justify-center gap-2"
                            >
                                <FiLogOut /> Log Out of Portal
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function SidebarInner({ navLinks, location, onClose, onLogout }: any) {
    return (
        <div className="flex flex-col justify-between h-full py-4">
            {/* Logo */}
            <div>
                <div className="px-5 pb-5 border-b border-white/5 mb-3">
                    <Link to="/" onClick={onClose} className="flex items-center gap-2 group">
                        <Logo className="size-7 group-hover:scale-110 transition-transform" />
                        <span className="text-lg font-semibold text-white tracking-tight group-hover:text-primary-400 transition-colors">RideShield</span>
                    </Link>
                </div>

                <nav className="px-3 space-y-0.5">
                    {navLinks.map((link: any, idx: number) => {
                        const isActive = location.pathname === link.to;
                        return (
                            <Link
                                key={idx}
                                to={link.to}
                                onClick={onClose}
                                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[15px] transition-all font-medium ${
                                    isActive
                                        ? "bg-primary-600/20 text-primary-400 border border-primary-500/20"
                                        : "text-slate-500 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                <span className="size-5">{link.icon}</span>
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Logout */}
            <div className="px-3 border-t border-white/5 pt-4">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 text-slate-500 hover:text-white hover:bg-white/5 px-3.5 py-2.5 rounded-xl text-[15px] font-medium transition-all"
                >
                    <FiLogOut className="size-4" /> Log Out
                </button>
            </div>
        </div>
    );
}
