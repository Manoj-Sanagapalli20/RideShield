import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { FiGrid, FiFileText, FiClock, FiLogOut, FiUser, FiMenu } from "react-icons/fi";
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem("partnerId");
        localStorage.removeItem("rideShieldUser");
        navigate("/");
    };

    return (
        <div className="flex h-[100dvh] bg-black overflow-hidden font-poppins">
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-xl"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.aside
                        initial={{ x: -280 }}
                        animate={{ x: 0 }}
                        exit={{ x: -280 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-y-0 left-0 z-50 w-64 bg-black/95 backdrop-blur-xl border-r border-white/5 flex flex-col justify-between lg:hidden"
                    >
                        <SidebarInner navLinks={navLinks} location={location} onClose={() => setIsSidebarOpen(false)} onLogout={handleLogout} />
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-56 bg-black border-r border-white/5 flex-col justify-between shrink-0">
                <SidebarInner navLinks={navLinks} location={location} onClose={() => {}} onLogout={handleLogout} />
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden w-full">
                {/* Header */}
                <header className="h-16 bg-black/90 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 md:px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <button className="lg:hidden text-white/50 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-colors border border-white/5" onClick={() => setIsSidebarOpen(true)}>
                            <FiMenu className="size-5" />
                        </button>
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

                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </main>
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
