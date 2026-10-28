import React from "react";
import type { ShapeType } from "../types";

export interface ShapeDefinition {
  type: ShapeType;
  name: string;
  category: "Geometric & Math" | "Arrows & Flow" | "Badges & Ribbons" | "Geographical & Icons";
  viewBox?: string;
  render: (color: string, strokeColor?: string, strokeWidth?: number) => React.ReactNode;
}

export const SHAPES_LIBRARY: ShapeDefinition[] = [
  // --- Geometric & Mathematical ---
  {
    type: "circle",
    name: "Circle",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <circle cx="50" cy="50" r="46" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "ellipse",
    name: "Ellipse",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <ellipse cx="50" cy="50" rx="46" ry="30" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "square",
    name: "Square",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <rect x="6" y="6" width="88" height="88" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "rect",
    name: "Rectangle",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <rect x="4" y="16" width="92" height="68" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "roundedRect",
    name: "Rounded Rectangle",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <rect x="4" y="14" width="92" height="72" rx="16" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "triangle",
    name: "Equilateral Triangle",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <polygon points="50,6 94,92 6,92" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "rightTriangle",
    name: "Right Triangle",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <polygon points="8,8 8,92 92,92" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "star5",
    name: "5-Point Star",
    category: "Geometric & Math",
    render: (c, s, w = 0) => (
      <polygon
        points="50,4 64,36 98,38 72,60 80,94 50,75 20,94 28,60 2,38 36,36"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "star8",
    name: "8-Point Star",
    category: "Geometric & Math",
    render: (c, s, w = 0) => (
      <polygon
        points="50,2 62,32 92,20 80,50 92,80 62,68 50,98 38,68 8,80 20,50 8,20 38,32"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "starburst",
    name: "Starburst Seal",
    category: "Geometric & Math",
    render: (c, s, w = 0) => (
      <polygon
        points="50,3 58,22 78,12 76,33 97,33 87,50 97,67 76,67 78,88 58,78 50,97 42,78 22,88 24,67 3,67 13,50 3,33 24,33 22,12 42,22"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "pentagon",
    name: "Regular Pentagon",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <polygon points="50,6 94,38 77,90 23,90 6,38" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "hexagon",
    name: "Regular Hexagon",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <polygon points="50,4 92,27 92,73 50,96 8,73 8,27" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "octagon",
    name: "Regular Octagon",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <polygon points="32,6 68,6 94,32 94,68 68,94 32,94 6,68 6,32" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "diamond",
    name: "Diamond / Rhombus",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <polygon points="50,4 94,50 50,96 6,50" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "trapezoid",
    name: "Trapezoid",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <polygon points="24,14 76,14 94,86 6,86" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "parallelogram",
    name: "Parallelogram",
    category: "Geometric & Math",
    render: (c, s, w = 0) => <polygon points="26,14 94,14 74,86 6,86" fill={c} stroke={s || "none"} strokeWidth={w} />,
  },
  {
    type: "cross",
    name: "Cross / Plus",
    category: "Geometric & Math",
    render: (c, s, w = 0) => (
      <polygon
        points="36,4 64,4 64,36 96,36 96,64 64,64 64,96 36,96 36,64 4,64 4,36 36,36"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "crescent",
    name: "Crescent Moon",
    category: "Geometric & Math",
    render: (c, s, w = 0) => (
      <path
        d="M60,6 A44,44 0 1,0 88,78 A34,34 0 0,1 60,6 Z"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },

  // --- Arrows & Flow ---
  {
    type: "arrowRight",
    name: "Arrow Right",
    category: "Arrows & Flow",
    render: (c, s, w = 0) => (
      <path
        d="M6,38 L60,38 L60,18 L94,50 L60,82 L60,62 L6,62 Z"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "arrowLeft",
    name: "Arrow Left",
    category: "Arrows & Flow",
    render: (c, s, w = 0) => (
      <path
        d="M94,38 L40,38 L40,18 L6,50 L40,82 L40,62 L94,62 Z"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "arrowUp",
    name: "Arrow Up",
    category: "Arrows & Flow",
    render: (c, s, w = 0) => (
      <path
        d="M38,94 L38,40 L18,40 L50,6 L82,40 L62,40 L62,94 Z"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "arrowDown",
    name: "Arrow Down",
    category: "Arrows & Flow",
    render: (c, s, w = 0) => (
      <path
        d="M38,6 L38,60 L18,60 L50,94 L82,60 L62,60 L62,6 Z"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "doubleArrow",
    name: "Double Ended Arrow",
    category: "Arrows & Flow",
    render: (c, s, w = 0) => (
      <path
        d="M6,50 L32,24 L32,40 L68,40 L68,24 L94,50 L68,76 L68,60 L32,60 L32,76 Z"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "curvedArrow",
    name: "Curved Accent Arrow",
    category: "Arrows & Flow",
    render: (c, s, w = 0) => (
      <path
        d="M12,80 Q50,80 70,48 L62,40 L92,36 L88,66 L80,58 Q60,94 12,94 Z"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "chevronRight",
    name: "Chevron Pointer",
    category: "Arrows & Flow",
    render: (c, s, w = 0) => (
      <path
        d="M20,12 L60,50 L20,88 L38,88 L78,50 L38,12 Z"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "dividerLine",
    name: "Horizontal Solid Divider",
    category: "Arrows & Flow",
    render: (c, s, w = 0) => (
      <rect x="2" y="46" width="96" height="8" rx="4" fill={c} stroke={s || "none"} strokeWidth={w} />
    ),
  },
  {
    type: "doubleLine",
    name: "Double Accent Line",
    category: "Arrows & Flow",
    render: (c) => (
      <g fill={c}>
        <rect x="2" y="38" width="96" height="6" rx="3" />
        <rect x="2" y="56" width="96" height="6" rx="3" />
      </g>
    ),
  },
  {
    type: "dottedLine",
    name: "Dotted Divider",
    category: "Arrows & Flow",
    render: (c) => (
      <g fill={c}>
        {[10, 26, 42, 58, 74, 90].map((cx) => (
          <circle key={cx} cx={cx} cy="50" r="5" />
        ))}
      </g>
    ),
  },

  // --- Badges & Ribbons ---
  {
    type: "badge",
    name: "Award Rosette Badge",
    category: "Badges & Ribbons",
    render: (c, s, w = 0) => (
      <g>
        <path d="M28,68 L16,96 L40,84 L50,96 L50,68 Z" fill={s || c} opacity="0.8" />
        <path d="M72,68 L84,96 L60,84 L50,96 L50,68 Z" fill={s || c} opacity="0.8" />
        <circle cx="50" cy="44" r="38" fill={c} stroke={s || "none"} strokeWidth={w} />
      </g>
    ),
  },
  {
    type: "ribbon",
    name: "Banner Ribbon",
    category: "Badges & Ribbons",
    render: (c, s, w = 0) => (
      <g>
        <polygon points="6,36 18,50 6,64 26,64 26,36" fill={s || c} opacity="0.75" />
        <polygon points="94,36 82,50 94,64 74,64 74,36" fill={s || c} opacity="0.75" />
        <rect x="20" y="28" width="60" height="44" rx="4" fill={c} stroke={s || "none"} strokeWidth={w} />
      </g>
    ),
  },
  {
    type: "shield",
    name: "Heraldic Shield",
    category: "Badges & Ribbons",
    render: (c, s, w = 0) => (
      <path
        d="M12,12 L88,12 C88,48 76,82 50,94 C24,82 12,48 12,12 Z"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "wreath",
    name: "Laurel Champion Wreath",
    category: "Badges & Ribbons",
    render: (c) => (
      <g fill={c}>
        <path d="M50,88 Q20,80 18,46 Q16,22 36,12 Q30,28 32,46 Q34,68 50,88 Z" />
        <path d="M50,88 Q80,80 82,46 Q84,22 64,12 Q70,28 68,46 Q66,68 50,88 Z" />
        <circle cx="50" cy="88" r="4" />
      </g>
    ),
  },
  {
    type: "heart",
    name: "Heart",
    category: "Badges & Ribbons",
    render: (c, s, w = 0) => (
      <path
        d="M50,88 C12,56 4,32 18,16 C32,2 46,14 50,24 C54,14 68,2 82,16 C96,32 88,56 50,88 Z"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "quote",
    name: "Quote Marks",
    category: "Badges & Ribbons",
    render: (c) => (
      <g fill={c}>
        <path d="M18,36 C18,24 26,16 38,16 L38,28 C30,28 28,32 28,36 L38,36 L38,64 L18,64 Z" />
        <path d="M54,36 C54,24 62,16 74,16 L74,28 C66,28 64,32 64,36 L74,36 L74,64 L54,64 Z" />
      </g>
    ),
  },

  // --- Geographical & Icons ---
  {
    type: "mapPin",
    name: "Map Location Pin",
    category: "Geographical & Icons",
    render: (c, s, w = 0) => (
      <g>
        <path
          d="M50,6 C30,6 16,20 16,40 C16,62 44,90 50,94 C56,90 84,62 84,40 C84,20 70,6 50,6 Z"
          fill={c}
          stroke={s || "none"}
          strokeWidth={w}
        />
        <circle cx="50" cy="38" r="12" fill="#fff" opacity="0.9" />
      </g>
    ),
  },
  {
    type: "compass",
    name: "Compass Star",
    category: "Geographical & Icons",
    render: (c, s) => (
      <g>
        <circle cx="50" cy="50" r="44" fill="none" stroke={c} strokeWidth="4" />
        <polygon points="50,10 58,44 50,50 42,44" fill={c} />
        <polygon points="50,90 58,56 50,50 42,56" fill={s || c} opacity="0.75" />
        <polygon points="90,50 56,58 50,50 56,42" fill={c} />
        <polygon points="10,50 44,58 50,50 44,42" fill={s || c} opacity="0.75" />
      </g>
    ),
  },
  {
    type: "sun",
    name: "Sun / Radiance",
    category: "Geographical & Icons",
    render: (c) => (
      <g fill={c}>
        <circle cx="50" cy="50" r="22" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="47"
            y="6"
            width="6"
            height="14"
            rx="3"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
      </g>
    ),
  },
  {
    type: "cloud",
    name: "Cloud",
    category: "Geographical & Icons",
    render: (c, s, w = 0) => (
      <path
        d="M26,72 L76,72 A18,18 0 0,0 76,36 A26,26 0 0,0 30,36 A18,18 0 0,0 26,72 Z"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "lightning",
    name: "Lightning Bolt",
    category: "Geographical & Icons",
    render: (c, s, w = 0) => (
      <polygon
        points="56,4 16,52 46,52 38,96 84,44 54,44"
        fill={c}
        stroke={s || "none"}
        strokeWidth={w}
      />
    ),
  },
  {
    type: "wave",
    name: "Wave / Water",
    category: "Geographical & Icons",
    render: (c) => (
      <g fill={c}>
        <path d="M6,36 Q28,16 50,36 T94,36 L94,48 Q72,28 50,48 T6,48 Z" />
        <path d="M6,58 Q28,38 50,58 T94,58 L94,70 Q72,50 50,70 T6,70 Z" />
      </g>
    ),
  },
  {
    type: "flag",
    name: "Festival Pennant Flag",
    category: "Geographical & Icons",
    render: (c, s, w = 0) => (
      <g>
        <line x1="16" y1="6" x2="16" y2="94" stroke={s || c} strokeWidth="6" strokeLinecap="round" />
        <path d="M16,14 L88,38 L16,62 Z" fill={c} stroke={s || "none"} strokeWidth={w} />
      </g>
    ),
  },
];

export function renderSvgShape(
  type: ShapeType,
  color: string,
  strokeColor?: string,
  strokeWidth = 0
) {
  const shape = SHAPES_LIBRARY.find((s) => s.type === type) || SHAPES_LIBRARY[0];
  return (
    <svg
      viewBox={shape.viewBox || "0 0 100 100"}
      className="shape-svg"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      {shape.render(color, strokeColor, strokeWidth)}
    </svg>
  );
}
