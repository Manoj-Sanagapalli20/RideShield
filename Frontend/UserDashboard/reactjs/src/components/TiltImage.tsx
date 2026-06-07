import { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useScroll, useTransform } from 'motion/react';

const springValues = {
    damping: 30,
    stiffness: 100,
    mass: 2
};

export default function TiltedImage({ rotateAmplitude = 3 }) {
    const ref = useRef<HTMLDivElement>(null);
    
    // Using global scroll is much more reliable for hero section components
    const { scrollY } = useScroll();
    
    // When scroll is at top (0), rotateX is 25deg (bent back). By 300px down, it flattens to 0deg.
    const rotateXScroll = useTransform(scrollY, [0, 400], [25, 0]);

    // Mouse tilt logic
    const rotateXMouse = useSpring(useMotionValue(0), springValues);
    const rotateYMouse = useSpring(useMotionValue(0), springValues);

    const [lastY, setLastY] = useState(0);

    function handleMouse(e: React.MouseEvent<HTMLElement>) {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        const offsetX = e.clientX - rect.left - rect.width / 2;
        const offsetY = e.clientY - rect.top - rect.height / 2;

        const rotationX = (offsetY / (rect.height / 2)) * -rotateAmplitude;
        const rotationY = (offsetX / (rect.width / 2)) * rotateAmplitude;

        rotateXMouse.set(rotationX);
        rotateYMouse.set(rotationY);
        setLastY(offsetY);
    }

    function handleMouseLeave() {
        rotateXMouse.set(0);
        rotateYMouse.set(0);
    }

    return (
        <div style={{ perspective: "1500px" }} className="w-full -mt-2 md:-mt-10 pointer-events-none">
            <motion.figure 
                ref={ref} 
                className="relative w-full h-full max-w-5xl mx-auto flex flex-col items-center justify-center pointer-events-auto cursor-pointer" 
                onMouseMove={handleMouse} 
                onMouseLeave={handleMouseLeave}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                    rotateX: rotateXScroll,
                    transformOrigin: "bottom center"
                }}
            >
                <motion.div 
                    className="relative transform-3d w-full max-w-5xl rounded-[15px] xl:rounded-[24px] bride bride-white/10 shadow-[0_-40px_80px_-40px_var(--color-primary-500)] overflow-hidden" 
                    style={{ rotateX: rotateXMouse, rotateY: rotateYMouse }} 
                >
                    <img 
                        src="/assets/dashboard.png"
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
