/**
 * The FESTIZE mark — a golden lowercase "f" bursting out of an irregular star,
 * built as an SVG so it stays crisp at every size and travels inside the single-file build.
 */
export function Logo({ size = 96, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} aria-label="Festize logo" role="img">
      <defs>
        <linearGradient id="fzGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6d888" />
          <stop offset="45%" stopColor="#c69128" />
          <stop offset="100%" stopColor="#7c5410" />
        </linearGradient>
        <linearGradient id="fzGoldEdge" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#8a5f18" />
          <stop offset="100%" stopColor="#e9c672" />
        </linearGradient>
        <filter id="fzShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="1.5" dy="2.5" stdDeviation="2.4" floodColor="#000" floodOpacity="0.42" />
        </filter>
      </defs>
      <g filter="url(#fzShadow)">
        {/* irregular star burst — hollow outline, each spike a different length */}
        <path
          fill="none" stroke="url(#fzGold)" strokeWidth="4.4" strokeLinejoin="miter" strokeMiterlimit="6"
          d="M100 6 L108 62 L166 22 L128 76 L192 74 L134 96 L184 128 L124 108 L146 176 L108 118 L100 194 L92 118 L64 174 L88 108 L18 130 L74 98 L10 74 L74 76 L36 22 L92 62 Z"
        />
        {/* stroked halo behind the letter for depth */}
        <path
          fill="none" stroke="url(#fzGoldEdge)" strokeWidth="1.5" opacity="0.55"
          d="M100 14 L106 62 L162 26 L128 74 L188 76 L134 94 L180 128 L124 106 L142 172 L108 116 L100 190 L92 116 L66 172 L88 106 L20 128 L74 96 L14 76 L74 74 L38 26 L94 62 Z"
        />
        {/* the letter f — bold, tall, with a metallic gold fill */}
        <path
          fill="url(#fzGold)" stroke="url(#fzGoldEdge)" strokeWidth="2"
          d="M118 54 C118 46 111 40 102 40 L96 40 C87 40 80 47 80 56 L80 82 L64 82 L64 100 L80 100 L80 168 L100 168 L100 100 L118 100 L118 82 L100 82 L100 62 C100 58 103 56 106 56 L118 56 Z"
        />
      </g>
    </svg>
  );
}
