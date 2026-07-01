import { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useScroll, useTransform } from 'motion/react';

const springValues = {
    damping: 30,
    stiffness: 100,
    mass: 2
};

export default function TiltedImage({ rotateAmplitude = 3 }) {
    const ref = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
    // Using global scroll is much more reliable for hero section components
    const { scrollY } = useScroll();
    
    // Smooth responsive scroll-based 3D rotations
    const rotateXScroll = useTransform(scrollY, [0, 400], [25, 0]);
    const rotateXScrollMobile = useTransform(scrollY, [0, 400], [12, 0]);

    // Mouse/Touch tilt logic
    const rotateXMouse = useSpring(useMotionValue(0), springValues);
    const rotateYMouse = useSpring(useMotionValue(0), springValues);

    function handleMouse(e: React.MouseEvent<HTMLElement>) {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        const offsetX = e.clientX - rect.left - rect.width / 2;
        const offsetY = e.clientY - rect.top - rect.height / 2;

        const rotationX = (offsetY / (rect.height / 2)) * -rotateAmplitude;
        const rotationY = (offsetX / (rect.width / 2)) * rotateAmplitude;

        rotateXMouse.set(rotationX);
        rotateYMouse.set(rotationY);
    }

    function handleTouch(e: React.TouchEvent<HTMLElement>) {
        if (!ref.current || e.touches.length === 0) return;

        const touch = e.touches[0];
        const rect = ref.current.getBoundingClientRect();
        const offsetX = touch.clientX - rect.left - rect.width / 2;
        const offsetY = touch.clientY - rect.top - rect.height / 2;

        // Boost touch rotation slightly for tactile feel on mobile screens
        const rotationX = (offsetY / (rect.height / 2)) * -rotateAmplitude * 1.5;
        const rotationY = (offsetX / (rect.width / 2)) * rotateAmplitude * 1.5;

        rotateXMouse.set(rotationX);
        rotateYMouse.set(rotationY);
    }

    function handleMouseLeave() {
        rotateXMouse.set(0);
        rotateYMouse.set(0);
    }

    return (
        <div style={{ perspective: isMobile ? "800px" : "1500px" }} className="w-full mt-6 md:-mt-10 pointer-events-none">
            <motion.figure 
                ref={ref} 
                className="relative w-[calc(100%+2rem)] -mx-4 md:w-full md:mx-auto flex flex-col items-center justify-center pointer-events-auto cursor-pointer md:px-0" 
                onMouseMove={handleMouse} 
                onMouseLeave={handleMouseLeave}
                onTouchMove={handleTouch}
                onTouchEnd={handleMouseLeave}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                    rotateX: isMobile ? rotateXScrollMobile : rotateXScroll,
                    transformOrigin: "bottom center"
                }}
            >
                <motion.div 
                    className="relative transform-3d w-full max-w-5xl rounded-[15px] xl:rounded-[24px] border border-white/10 shadow-[0_-40px_80px_-40px_var(--color-primary-500)] overflow-hidden" 
                    style={{ 
                        rotateX: rotateXMouse, 
                        rotateY: rotateYMouse 
                    }} 
                >
                    <img 
                        src="/assets/rideshield_dashboard.png"
                        className="w-full object-cover will-change-transform transform-[translateZ(0)]"
                        alt="RideShield Dashboard"
                    />
                    
                    {/* Very light primary color tint at the top */}
                    <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-primary-500/5 blur-[100px] to-transparent pointer-events-none"></div>

                    {/* Black shadow fade at the bottom to blend beautifully */}
                    <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none"></div>
                </motion.div>
            </motion.figure>
        </div>
    );
}
