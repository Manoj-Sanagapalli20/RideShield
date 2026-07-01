'use client'
import { useState, useEffect, useRef } from 'react';
import { ChevronRightIcon, ArrowUpRightIcon } from "lucide-react";
import TiltedImage from "../components/TiltImage";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";

// High-performance canvas parametric animations
function RainCanvas({ weatherType }: { weatherType: 'clear' | 'rain' | 'heat' | 'aqi' | 'curfew' }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        const maxParticles = 75;
        const particles: Array<{ x: number; y: number; l: number; ys: number; angle?: number; size?: number }> = [];

        const initParticles = () => {
            particles.length = 0;
            for (let i = 0; i < maxParticles; i++) {
                if (weatherType === 'rain') {
                    particles.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        l: Math.random() * 12 + 6,
                        ys: Math.random() * 8 + 8
                    });
                } else if (weatherType === 'heat') {
                    particles.push({
                        x: Math.random() * width,
                        y: Math.random() * height + height,
                        l: Math.random() * 30 + 20,
                        ys: -(Math.random() * 1.2 + 0.8),
                        angle: Math.random() * Math.PI * 2
                    });
                } else if (weatherType === 'aqi') {
                    particles.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        size: Math.random() * 3.5 + 1.5,
                        ys: Math.random() * 0.3 + 0.1,
                        l: Math.random() * 0.2 + 0.1
                    });
                } else if (weatherType === 'clear') {
                    particles.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        size: Math.random() * 2 + 1,
                        ys: -(Math.random() * 0.4 + 0.2),
                        l: -(Math.random() * 0.3 + 0.1)
                    });
                }
            }
        };

        initParticles();

        let curfewTime = 0;

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            if (weatherType === 'clear') {
                // 1. Soft golden sun glow top right
                const sunGlow = ctx.createRadialGradient(width * 0.85, height * 0.15, 10, width * 0.85, height * 0.15, width * 0.4);
                sunGlow.addColorStop(0, 'rgba(234, 179, 8, 0.08)');
                sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = sunGlow;
                ctx.fillRect(0, 0, width, height);

                // 2. Slow drifting sun dust motes
                ctx.fillStyle = 'rgba(234, 179, 8, 0.25)';
                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size!, 0, Math.PI * 2);
                    ctx.fill();

                    p.y += p.ys;
                    p.x += p.l;

                    if (p.y < -p.size! || p.x < -p.size!) {
                        p.y = height + p.size!;
                        p.x = Math.random() * width;
                    }
                }
            }
            else if (weatherType === 'rain') {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
                ctx.lineWidth = 1;
                ctx.lineCap = 'round';

                for (let i = 0; i < particles.length; i++) {
                    const d = particles[i];
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(d.x + d.ys * 0.08, d.y + d.l);
                    ctx.stroke();

                    d.y += d.ys;
                    d.x += d.ys * 0.08;

                    if (d.y > height) {
                        d.y = -d.l;
                        d.x = Math.random() * width;
                    }
                }
            } 
            else if (weatherType === 'heat') {
                const gradient = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width / 1.1);
                gradient.addColorStop(0, 'rgba(249, 115, 22, 0.12)');
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);

                ctx.strokeStyle = 'rgba(249, 115, 22, 0.09)';
                ctx.lineWidth = 2.5;

                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    p.y += p.ys;
                    p.angle! += 0.03;

                    const curX = p.x + Math.sin(p.angle!) * 15;
                    ctx.beginPath();
                    ctx.moveTo(curX, p.y);
                    ctx.lineTo(curX, p.y + p.l);
                    ctx.stroke();

                    if (p.y + p.l < 0) {
                        p.y = height + Math.random() * 50;
                        p.x = Math.random() * width;
                    }
                }
            } 
            else if (weatherType === 'aqi') {
                ctx.fillStyle = 'rgba(120, 113, 108, 0.14)';
                ctx.fillRect(0, 0, width, height);

                ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size!, 0, Math.PI * 2);
                    ctx.fill();

                    p.y += p.ys;
                    p.x += Math.sin(p.y * 0.01) * p.l;

                    if (p.y > height) {
                        p.y = -p.size!;
                        p.x = Math.random() * width;
                    }
                }
            } 
            else if (weatherType === 'curfew') {
                curfewTime += 0.02;
                const pulse = Math.sin(curfewTime) * 0.35 + 0.65;

                // 1. Pulsing border around the screen
                ctx.strokeStyle = `rgba(239, 68, 68, ${pulse * 0.25})`;
                ctx.lineWidth = 12;
                ctx.strokeRect(6, 6, width - 12, height - 12);

                // 2. Breathing red radial warning glow
                const alertGlow = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, width / 1.2);
                alertGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
                alertGlow.addColorStop(1, `rgba(239, 68, 68, ${pulse * 0.16})`);
                ctx.fillStyle = alertGlow;
                ctx.fillRect(0, 0, width, height);
            }

            animationFrameId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
        };
    }, [weatherType]);

    return (
        <canvas 
            ref={canvasRef} 
            className="absolute inset-0 w-full h-full pointer-events-none -z-10"
        />
    );
}

export default function HeroSection() {
    const navigate = useNavigate();
    const [simWeather, setSimWeather] = useState<'clear' | 'rain' | 'heat' | 'aqi' | 'curfew'>('rain');

    return (
        <div className="relative flex flex-col items-center justify-center px-4 md:px-16 lg:px-24 xl:px-32 pb-12 md:pb-20 overflow-hidden w-full isolate">
            {/* Rain/Weather Falling Canvas */}
            <RainCanvas weatherType={simWeather} />

            {/* Ambient Background Image */}
            <div className="absolute inset-0 -z-20 pointer-events-none overflow-hidden opacity-[0.25]">
                <img 
                    src="/assets/hero_bg.png" 
                    className="w-full h-full object-cover select-none" 
                    alt="City Background" 
                />
                {/* Dark Vignette to blur edges and maintain high text contrast */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black"></div>
            </div>

            {/* Top decorative glow */}
            <div className="absolute top-20 -z-10 left-1/4 size-72 bg-primary-600 blur-[280px] opacity-75 pointer-events-none"></div>
            
            {/* Built for Rapido Badge */}
            <motion.a href="#" className="group flex items-center gap-2 rounded-full p-1 pr-3 mt-24 md:mt-36 text-primary-100 bg-primary-200/15"
                initial={{ y: -20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
            >
                <span className="bg-primary-800 text-white text-xs px-1 py-1 rounded-full">
                    
                </span>
                <p className="flex items-center gap-1 text-xs md:text-sm">
                    <span>Built for Rapido captains</span>
                    <ChevronRightIcon size={14} className="group-hover:translate-x-0.5 transition duration-300" />
                </p>
            </motion.a>
            
            {/* Responsive Heading */}
            <motion.h1 className="text-3xl/tight sm:text-4xl/tight md:text-6xl/tight lg:text-7xl/tight max-w-4xl text-center tracking-tight mt-6"
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
            
            {/* Description Text */}
            <motion.p className="text-sm md:text-base lg:text-lg text-center text-slate-300 max-w-lg mt-4 px-4"
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, type: "spring", stiffness: 320, damping: 70, mass: 1 }}
            >
                Parametric insurance designed specifically for Rapido captains. The money arrives before you wake up.
            </motion.p>
            
            {/* Interactive Grid & Button container */}
            <motion.div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 lg:gap-12 mt-6 mb-10 md:mb-24 w-full max-w-4xl px-4"
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 320, damping: 70, mass: 1 }}
            >
                {/* Left: Dummy Rapido Card */}
                <a 
                    href="http://localhost:3001" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex flex-col items-center md:items-end text-center md:text-right gap-1.5 max-w-[240px] w-full group order-2 md:order-1 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-primary-500/30 hover:shadow-[0_0_20px_-5px_rgba(234,179,8,0.12)] transition-all duration-500 cursor-pointer block"
                >
                    <span className="flex items-center gap-1 text-primary-400 group-hover:text-primary-300 font-bold transition-colors text-xs md:text-sm">
                        🚕 Dummy Rapido
                        <ArrowUpRightIcon size={14} className="text-slate-400 group-hover:text-primary-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 duration-300" />
                    </span>
                    <p className="text-[10px] md:text-[11px] text-slate-400 leading-normal font-medium">
                        Simulate driver shifts & register here for using RideShield
                    </p>
                </a>

                {/* Center: Get Started button & Weather Simulator */}
                <div className="order-1 md:order-2 flex flex-col items-center gap-4 shrink-0 my-2 md:my-0">
                    <motion.button 
                        onClick={() => navigate('/login')}
                        initial="initial"
                        whileHover="hover"
                        whileTap={{ scale: 0.95 }}
                        className="group flex items-center justify-center gap-2 bg-primary-600 text-white font-medium rounded-full px-7 h-11 transition-colors cursor-pointer shadow-lg shadow-primary-600/10 hover:shadow-primary-600/20"
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

                    {/* Interactive Weather Simulator */}
                    <div className="flex flex-col items-center gap-2 p-2.5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md max-w-[280px]">
                        <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">
                            ⚡ Parametric Trigger Simulator
                        </span>
                        
                        <div className="flex flex-wrap justify-center items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 max-w-[270px]">
                            <button 
                                onClick={() => setSimWeather('clear')}
                                className={`px-2 py-0.5 text-[9px] md:text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer font-bold ${simWeather === 'clear' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                ☀️ Clear
                            </button>
                            <button 
                                onClick={() => setSimWeather('rain')}
                                className={`px-2 py-0.5 text-[9px] md:text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer font-bold ${simWeather === 'rain' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                🌧️ Rain
                            </button>
                            <button 
                                onClick={() => setSimWeather('heat')}
                                className={`px-2 py-0.5 text-[9px] md:text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer font-bold ${simWeather === 'heat' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                🌡️ Heat
                            </button>
                            <button 
                                onClick={() => setSimWeather('aqi')}
                                className={`px-2 py-0.5 text-[9px] md:text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer font-bold ${simWeather === 'aqi' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                🏭 AQI
                            </button>
                            <button 
                                onClick={() => setSimWeather('curfew')}
                                className={`px-2 py-0.5 text-[9px] md:text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer font-bold ${simWeather === 'curfew' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                🚨 Curfew
                            </button>
                        </div>

                        {/* Status Message */}
                        <div className="text-[10px] text-center text-slate-300 px-1 font-semibold min-h-[36px] flex items-center justify-center leading-tight">
                            {simWeather === 'clear' && (
                                <span>☀️ Clear skies. Risk index normal. Premium standard (₹49/wk).</span>
                            )}
                            {simWeather === 'rain' && (
                                <span className="text-primary-400">🌧️ Rain (0.8mm/hr) detected. Parametric trigger active! Auto-payout initiated.</span>
                            )}
                            {simWeather === 'heat' && (
                                <span className="text-orange-400">🌡️ Heatwave (41.5°C) detected. Extreme climate trigger active! Premium adjustment enabled.</span>
                            )}
                            {simWeather === 'aqi' && (
                                <span className="text-slate-400">🏭 Severe AQI (PM2.5: 320) detected. High-pollution trigger active! Payout processed.</span>
                            )}
                            {simWeather === 'curfew' && (
                                <span className="text-yellow-500">🚨 Curfew / Strike detected. Flagged for automatic claims audit.</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Admin Dashboard Card */}
                <a 
                    href="http://localhost:3002" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex flex-col items-center md:items-start text-center md:text-left gap-1.5 max-w-[240px] w-full group order-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-primary-500/30 hover:shadow-[0_0_20px_-5px_rgba(234,179,8,0.12)] transition-all duration-500 cursor-pointer block"
                >
                    <span className="flex items-center gap-1 text-primary-400 group-hover:text-primary-300 font-bold transition-colors text-xs md:text-sm">
                        👑 Admin Dashboard
                        <ArrowUpRightIcon size={14} className="text-slate-400 group-hover:text-primary-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 duration-300" />
                    </span>
                    <p className="text-[10px] md:text-[11px] text-slate-400 leading-normal font-medium">
                        Audit active claims & manage platform states
                    </p>
                </a>
            </motion.div>

            <TiltedImage />
        </div>
    );
}
