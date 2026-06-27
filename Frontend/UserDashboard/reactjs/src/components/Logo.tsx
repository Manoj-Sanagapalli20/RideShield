interface LogoProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    fillBg?: boolean;
}

export const Logo = ({ className = "text-primary-500", width, height, fillBg = false }: LogoProps) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 100 100" 
        fill="none" 
        className={className}
        width={width}
        height={height}
    >
        {/* Shield Background */}
        <path 
            d="M 50,12 Q 33,14 22,21 C 22,51 30,76 50,93 C 70,76 78,51 78,21 Q 67,14 50,12 Z" 
            fill={fillBg ? "#121214" : "none"} 
            stroke="#eab308" 
            strokeWidth="5" 
            strokeLinejoin="round"
        />
        {/* Lightning Bolt inside shield */}
        <path 
            d="M 52,28 L 36,47 L 46,47 L 40,70 L 60,41 L 48,41 Z" 
            fill="#eab308"
        />
        {/* Rain Cloud overlapping top right */}
        <path 
            d="M 62,35 C 60,35 59,33.5 59,32 C 59,28 62,25 66,25 C 67,21 71,18 76,18 C 81.5,18 86,22 86,27.5 C 86,28 85.9,28.5 85.8,29 C 88.2,29.5 90,31.5 90,34 C 90,37 87.5,39.5 84.5,39.5 L 62,39.5" 
            fill="#eab308"
        />
        {/* Rain drops falling from cloud */}
        <path 
            d="M 66,45 L 64,49 M 73,46 L 71,50 M 80,45 L 78,49" 
            stroke="#eab308" 
            strokeWidth="2.5" 
            strokeLinecap="round"
        />
    </svg>
);
