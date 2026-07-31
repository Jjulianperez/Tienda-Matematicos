'use client'

export default function GeometricDecor({ variant = 'default', className = '' }) {
  if (variant === 'formulas') {
    return (
      <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g opacity="0.08" stroke="#6E8B3D" strokeWidth="1">
            {/* Fórmulas */}
            <text x="60" y="90" fontSize="22" fill="#6E8B3D" stroke="none" fontFamily="serif">E = mc²</text>
            <text x="520" y="160" fontSize="26" fill="#6E8B3D" stroke="none" fontFamily="serif">π r²</text>
            <text x="150" y="320" fontSize="20" fill="#6E8B3D" stroke="none" fontFamily="serif">a² + b² = c²</text>
            <text x="620" y="400" fontSize="24" fill="#6E8B3D" stroke="none" fontFamily="serif">√x + y</text>
            <text x="300" y="520" fontSize="18" fill="#6E8B3D" stroke="none" fontFamily="serif">f(x) = x³ − 2x + 1</text>

            {/* Geometría */}
            <circle cx="700" cy="80" r="40" strokeDasharray="4 6" />
            <polygon points="80,420 140,380 200,420 170,480 110,480" strokeDasharray="3 5" />
            <rect x="600" y="470" width="90" height="70" rx="4" transform="rotate(-12 600 470)" strokeDasharray="5 4" />
            <path d="M60 200 C 120 140, 200 260, 260 200 S 380 140, 440 200" />
            <path d="M440 240 C 500 180, 580 300, 640 240 S 760 180, 800 240" />
            {/* Compás */}
            <path d="M120 560 L 160 500 L 200 560" />
            <circle cx="160" cy="500" r="3" fill="#6E8B3D" stroke="none" />
            <line x1="160" y1="500" x2="230" y2="560" strokeDasharray="2 3" />
            {/* Regla */}
            <line x1="480" y1="560" x2="760" y2="560" strokeWidth="2" />
            {[500, 530, 560, 590, 620, 650, 680, 710, 740].map((x, i) => (
              <line key={i} x1={x} y1="560" x2={x} y2={i % 4 === 0 ? 552 : 556} />
            ))}
          </g>
        </svg>
      </div>
    )
  }

  if (variant === 'grid') {
    return (
      <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
        <svg width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="geo-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0 H0 V40" fill="none" stroke="#D7B98E" strokeWidth="0.6" strokeDasharray="1 4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#geo-grid)" opacity="0.35" />
          <g opacity="0.12" stroke="#6E8B3D" strokeWidth="1">
            <circle cx="60" cy="60" r="50" strokeDasharray="3 5" />
            <polygon points="320,80 380,40 440,80 400,140 340,140" />
            <line x1="700" y1="20" x2="560" y2="140" strokeDasharray="4 3" />
            <circle cx="720" cy="120" r="3" fill="#6E8B3D" stroke="none" />
          </g>
        </svg>
      </div>
    )
  }

  if (variant === 'fractal') {
    return (
      <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 800 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g opacity="0.06" stroke="#6E8B3D" strokeWidth="1.2">
            <path d="M400 40 L 480 120 L 560 40 L 640 120 L 720 40" />
            <path d="M400 120 L 440 160 L 480 120 L 520 160 L 560 120 L 600 160 L 640 120 L 680 160 L 720 120" />
            <path d="M400 200 L 420 220 L 440 200 L 460 220 L 480 200 L 500 220 L 520 200 L 540 220 L 560 200 L 580 220 L 600 200 L 620 220 L 640 200 L 660 220 L 680 200 L 700 220 L 720 200" strokeWidth="1" strokeDasharray="4 3" />
            <path d="M80 300 a 30 30 0 0 1 60 0 a 45 45 0 0 1 -90 0 a 60 60 0 0 1 120 0 a 75 75 0 0 1 -150 0" />
          </g>
        </svg>
      </div>
    )
  }

  if (variant === 'compas') {
    return (
      <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 800 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g opacity="0.08" stroke="#D7B98E" strokeWidth="1.2">
            <circle cx="400" cy="300" r="200" strokeDasharray="5 5" />
            <circle cx="400" cy="300" r="150" strokeDasharray="2 6" />
            <path d="M400 100 L 400 300" />
            <path d="M400 300 L 545 178" />
            <circle cx="400" cy="300" r="6" fill="#D7B98E" stroke="none" />
            <path d="M400 60 l8 16 l-16 0 Z" fill="#D7B98E" stroke="none" />
            <path d="M250 400 L 340 280" strokeDasharray="4 4" />
            <text x="120" y="120" fontSize="20" fill="#D7B98E" stroke="none" fontFamily="serif" fontStyle="italic">2πr</text>
            <text x="600" y="120" fontSize="20" fill="#D7B98E" stroke="none" fontFamily="serif" fontStyle="italic">d = 2r</text>
          </g>
        </svg>
      </div>
    )
  }

  if (variant === 'blueprint') {
    return (
      <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g opacity="0.07" stroke="#D7B98E" strokeWidth="1">
            {/* Círculos concéntricos */}
            <circle cx="400" cy="300" r="280" strokeDasharray="2 6" />
            <circle cx="400" cy="300" r="220" strokeDasharray="6 4" />
            <circle cx="400" cy="300" r="160" strokeDasharray="2 4" />
            <circle cx="400" cy="300" r="100" strokeDasharray="4 3" />
            <circle cx="400" cy="300" r="40" strokeDasharray="1 3" />
            {/* Líneas de medición */}
            <line x1="400" y1="300" x2="400" y2="20" strokeDasharray="4 4" />
            <line x1="400" y1="300" x2="780" y2="300" strokeDasharray="4 4" />
            <path d="M400 20 l6 10 M400 20 l-6 10 M780 300 l-10 6 M780 300 l-10 -6" />
            {/* Espiral */}
            <path d="M120 300 a 40 40 0 0 1 80 0 a 60 60 0 0 1 -120 0 a 80 80 0 0 1 160 0 a 100 100 0 0 1 -200 0" strokeWidth="1.5" />
            {/* Fractal */}
            <path d="M50 500 L 100 440 L 150 500 L 200 440 L 250 500 L 300 440 L 350 500 L 400 440 L 450 500 L 500 440 L 550 500 L 600 440 L 650 500 L 700 440 L 750 500" strokeWidth="1.5" strokeDasharray="5 3" />
          </g>
        </svg>
      </div>
    )
  }

  // default - logo geométrico
  return (
    <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 4 L58 18 L58 46 L32 60 L6 46 L6 18 Z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M32 18 L32 46 M18 32 L46 32" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      </svg>
    </div>
  )
}
