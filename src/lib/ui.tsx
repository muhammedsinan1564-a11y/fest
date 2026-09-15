import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

/* ============================= icons ============================= */
const P: Record<string, React.ReactNode> = {
  menu: <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="15" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>,
  back: <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="11 18 5 12 11 6" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  eye: <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.6" /></>,
  eyeoff: <><path d="M4 4l16 16" /><path d="M9.9 5.9A10.7 10.7 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17.5 17.5 0 0 1-3 3.9M6.1 8.2A16.8 16.8 0 0 0 2 12s3.5 6.5 10 6.5a10 10 0 0 0 3.9-.8" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  check: <polyline points="4 12.5 9.5 18 20 6.5" />,
  x: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
  edit: <><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17Z" /><line x1="13.5" y1="6.5" x2="17.5" y2="10.5" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6.5 7l1 13h9l1-13" /><line x1="10" y1="11" x2="10" y2="16.5" /><line x1="14" y1="11" x2="14" y2="16.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><line x1="16" y1="16" x2="21" y2="21" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></>,
  moon: <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" />,
  logout: <><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><polyline points="15 16 20 12 15 8" /><line x1="20" y1="12" x2="9" y2="12" /></>,
  play: <polygon points="7 4.5 19 12 7 19.5" />,
  dots: <><circle cx="12" cy="5" r="1.7" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.7" fill="currentColor" stroke="none" /></>,
  download: <><path d="M12 3v12" /><polyline points="6.5 10 12 15.5 17.5 10" /><path d="M4 20h16" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M4.5 19l5.5-5.5 3.5 3.5 3-3 3.5 3.5" /></>,
  star: <polygon points="12 2.8 14.9 8.7 21.4 9.6 16.7 14.2 17.8 20.7 12 17.6 6.2 20.7 7.3 14.2 2.6 9.6 9.1 8.7" />,
  pin: <><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4c4-2.5 8 2.5 14 0v9c-6 2.5-10-2.5-14 0" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v12H4Z" /><circle cx="12" cy="13" r="3.5" /></>,
  bolt: <polygon points="13 2 4.5 13.5 11 13.5 10 22 19.5 10 13 10" />,
  heart: <path d="M12 20.5S3.5 15.5 3.5 9.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.4c0 6.1-8.5 11.1-8.5 11.1Z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  diamond: <rect x="6" y="6" width="12" height="12" rx="1" transform="rotate(45 12 12)" />,
  square: <rect x="5" y="5" width="14" height="14" rx="1.5" />,
  circle: <circle cx="12" cy="12" r="8" />,
  triangle: <polygon points="12 4.5 21 19.5 3 19.5" />,
  chevL: <polyline points="14.5 6 8.5 12 14.5 18" />,
  chevR: <polyline points="9.5 6 15.5 12 9.5 18" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.6" /><path d="M15.7 14.9c2.8.2 5 1.9 5.8 4.9" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  key: <><circle cx="8" cy="15.5" r="4.5" /><path d="M11.5 12.5L20 4M17 7l2.5 2.5M14 10l2 2" /></>,
  tag: <><path d="M3.5 12.5v-8a1 1 0 0 1 1-1h8L21 12l-8.5 8.5Z" /><circle cx="8" cy="8" r="1.4" /></>,
  list: <><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="5" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="5" cy="18" r="1.2" fill="currentColor" stroke="none" /></>,
  sliders: <><line x1="6" y1="4" x2="6" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="18" y1="4" x2="18" y2="20" /><circle cx="6" cy="14" r="2.2" fill="var(--panel)" /><circle cx="12" cy="8" r="2.2" fill="var(--panel)" /><circle cx="18" cy="16" r="2.2" fill="var(--panel)" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="16" x2="12" y2="20" /></>,
  bar: <><line x1="5" y1="20" x2="5" y2="12" /><line x1="12" y1="20" x2="12" y2="5" /><line x1="19" y1="20" x2="19" y2="9" /></>,
  award: <><circle cx="12" cy="9" r="5.5" /><path d="M8.5 13.5L7 21l5-2.6L17 21l-1.5-7.5" /></>,
  idcard: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><circle cx="8.5" cy="11" r="2" /><path d="M5.5 16.5c.5-1.6 1.6-2.4 3-2.4s2.5.8 3 2.4" /><line x1="14.5" y1="9.5" x2="19" y2="9.5" /><line x1="14.5" y1="13" x2="19" y2="13" /></>,
  printer: <><path d="M7 8V3.5h10V8" /><rect x="3.5" y="8" width="17" height="8" rx="1.5" /><rect x="7" y="13.5" width="10" height="7" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3.5 7 12 13.5 20.5 7" /></>,
  scale: <><line x1="12" y1="4" x2="12" y2="20" /><path d="M7 6h10" /><path d="M7 6l-3 6a3.2 3.2 0 0 0 6 0Z" /><path d="M17 6l-3 6a3.2 3.2 0 0 0 6 0Z" /><path d="M8 20h8" /></>,
  file: <><path d="M6 2.5h8l4 4V21.5H6Z" /><polyline points="14 2.5 14 7 18 7" /></>,
  trophy: <><path d="M8 4h8v6a4 4 0 0 1-8 0Z" /><path d="M8 5H4.5v2A3.5 3.5 0 0 0 8 10.5M16 5h3.5v2A3.5 3.5 0 0 1 16 10.5" /><line x1="12" y1="14" x2="12" y2="17.5" /><path d="M8 21h8M9 17.5h6V21" /></>,
  shuffle: <><path d="M3 6.5h3.5c5 0 6 10 11 10H21" /><path d="M3 16.5h3.5c1.8 0 3-1.3 4-2.9M21 6.5h-3.5c-1.8 0-3 1.3-4 2.9" /><polyline points="18 3.5 21 6.5 18 9.5" /><polyline points="18 13.5 21 16.5 18 19.5" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.7-1.4.2-2.5 1.7-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5Z" /><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none" /><circle cx="10.5" cy="7" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="7.5" r="1.1" fill="currentColor" stroke="none" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.2 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.2-3.8-8.5s1.3-6.2 3.8-8.5Z" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><polyline points="12 7 12 12.5 15.5 14.5" /></>,
  undo: <><path d="M4 10h11a5 5 0 0 1 0 10h-4" /><polyline points="8.5 5.5 4 10 8.5 14.5" /></>,
  sparkle: <><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4Z" /><path d="M18.5 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9Z" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  hash: <><line x1="9" y1="3.5" x2="7" y2="20.5" /><line x1="17" y1="3.5" x2="15" y2="20.5" /><line x1="4.5" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="19.5" y2="15" /></>,
  phone: <path d="M5 3.5h4l1.5 5-2.5 2a13 13 0 0 0 5.5 5.5l2-2.5 5 1.5v4a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 3 5.7 2 2 0 0 1 5 3.5Z" />,
  mappin: <><path d="M12 21.5s-6.5-5.7-6.5-10.3a6.5 6.5 0 0 1 13 0c0 4.6-6.5 10.3-6.5 10.3Z" /><circle cx="12" cy="11" r="2.2" /></>,
  grip: <><circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" /></>,
  arrowR: <><line x1="4" y1="12" x2="19" y2="12" /><polyline points="13.5 6.5 19 12 13.5 17.5" /></>,
  layers: <><polygon points="12 3 21 8 12 13 3 8" /><polyline points="3 12.5 12 17.5 21 12.5" /><polyline points="3 17 12 22 21 17" /></>,
  music: <><path d="M9 18.5V6l11-2v12.5" /><circle cx="6.5" cy="18.5" r="2.5" /><circle cx="17.5" cy="16.5" r="2.5" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><line x1="12" y1="17.5" x2="12" y2="21" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><line x1="3.5" y1="10" x2="20.5" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><line x1="12" y1="11" x2="12" y2="16" /><circle cx="12" cy="8" r="0.6" fill="currentColor" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  text: <><path d="M5 6.5V4.5h14v2" /><line x1="12" y1="4.5" x2="12" y2="19.5" /><line x1="9" y1="19.5" x2="15" y2="19.5" /></>,
  shapes: <><rect x="3.5" y="13" width="7.5" height="7.5" rx="1" /><circle cx="16.5" cy="16.5" r="4" /><path d="M12 3l5 7H7Z" /></>,
};
export function Icon({ n, s = 18, className = "", sw = 1.8 }: { n: string; s?: number; className?: string; sw?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {P[n] || P.circle}
    </svg>
  );
}

/* ============================= buttons / inputs ============================= */
export function Btn({ children, onClick, kind = "primary", size, disabled, type = "button", className = "", title, autoFocus, style }: {
  children: React.ReactNode; onClick?: (e: React.MouseEvent) => void; kind?: "primary" | "ghost" | "danger" | "soft" | "line" | "gold";
  size?: "sm" | "big"; disabled?: boolean; type?: "button" | "submit"; className?: string; title?: string; autoFocus?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} autoFocus={autoFocus} style={style}
      className={`btn ${kind} ${size ? size : ""} ${className}`}>
      {children}
    </button>
  );
}
export function IconBtn({ n, onClick, title, danger, className = "", s = 17 }: { n: string; onClick?: (e: React.MouseEvent) => void; title?: string; danger?: boolean; className?: string; s?: number }) {
  return (
    <button type="button" className={`icobtn ${danger ? "danger" : ""} ${className}`} onClick={onClick} title={title} aria-label={title}>
      <Icon n={n} s={s} />
    </button>
  );
}

/* ---------- themes: dark, light + three premium color codes (no custom colors) ---------- */
export const THEMES: { id: string; label: string; code: string; sw: [string, string, string] }[] = [
  { id: "dark", label: "Midnight", code: "#0E1411", sw: ["#0e1411", "#2fbf9f", "#ffc53d"] },
  { id: "light", label: "Parchment", code: "#EEF0E7", sw: ["#eef0e7", "#0e7c6b", "#dd9406"] },
  { id: "emerald", label: "Emerald Luxe", code: "#07231B", sw: ["#07231b", "#34d399", "#e8b64c"] },
  { id: "royal", label: "Royal Amethyst", code: "#12102A", sw: ["#12102a", "#a78bfa", "#f0b429"] },
  { id: "crimson", label: "Crimson Noir", code: "#14090B", sw: ["#14090b", "#fb7185", "#e9c46a"] },
];

export function ThemePicker({ theme, setTheme }: { theme: string; setTheme: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<"left" | "right">("left");
  const wrapRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // default: open left → right; flip only if it would run off the viewport edge
    const rect = wrapRef.current?.getBoundingClientRect();
    setAlign(rect && rect.left + 244 > window.innerWidth - 8 ? "right" : "left");
    const close = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open ]);
  const current = THEMES.find((t) => t.id === theme) || THEMES[0];
  return (
    <div ref={wrapRef} className="relative">
      <button type="button" className="icobtn" title={`Theme: ${current.label} (${current.code}) — click to change`} aria-label="Change theme"
        onClick={() => setOpen((o) => !o)}>
        <span className="flex -space-x-1">
          {current.sw.map((c, i) => (
            <span key={i} className="w-3.5 h-3.5 rounded-full border" style={{ background: c, borderColor: "var(--line2)", zIndex: 3 - i }} />
          ))}
        </span>
      </button>
      {open && (
        <div className={`absolute ${align === "left" ? "left-0" : "right-0"} top-11 z-[90] card p-2 pop`} style={{ minWidth: 232, transformOrigin: align === "left" ? "top left" : "top right" }}>
          <div className="lbl px-2 pt-1">Theme color code</div>
          <div className="grid gap-1">
            {THEMES.map((t) => {
              const on = t.id === theme;
              return (
                <button key={t.id} type="button" onClick={() => { setTheme(t.id); setOpen(false); }}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all hoverable"
                  style={{ background: on ? "var(--acc-soft)" : "transparent", border: `1.5px solid ${on ? "var(--acc)" : "transparent"}` }}>
                  <span className="flex -space-x-1.5 shrink-0">
                    {t.sw.map((c, i) => (
                      <span key={i} className="w-5 h-5 rounded-full border-2" style={{ background: c, borderColor: "var(--panel)", zIndex: 3 - i }} />
                    ))}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-extrabold leading-tight">{t.label}</span>
                    <span className="block mono text-[11px] font-bold" style={{ color: "var(--mut)" }}>{t.code}</span>
                  </span>
                  {on && <Icon n="check" s={15} sw={2.6} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3.5">
      <span className="lbl">{label}</span>
      {children}
      {hint && <div className="text-[11.5px] mt-1.5 font-semibold" style={{ color: "var(--mut)" }}>{hint}</div>}
    </div>
  );
}
export function EyeInput({ value, onChange, placeholder = "Password", autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className="input pr-11" type={show ? "text" : "password"} value={value} autoFocus={autoFocus}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="icobtn absolute right-1.5 top-1/2 -translate-y-1/2" onClick={() => setShow((s) => !s)} title={show ? "Hide" : "Show"}>
        <Icon n={show ? "eyeoff" : "eye"} />
      </button>
    </div>
  );
}
export function Select({ value, onChange, options, placeholder = "Select…" }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; placeholder?: string }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>{placeholder}</option>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}
export function SearchInput({ value, onChange, placeholder = "Search…", inputRef }: { value: string; onChange: (v: string) => void; placeholder?: string; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  return (
    <div className="relative flex-1 min-w-[160px] max-w-[340px]">
      <Icon n="search" s={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
      <input ref={inputRef as React.RefObject<HTMLInputElement>} className="input pl-9.5" style={{ paddingLeft: 36 }} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
export function Chips({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: { v: string; l: string; n?: number }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <button key={it.v} type="button" className={`chip ${value === it.v ? "on" : ""}`} onClick={() => onChange(it.v)}>
          {it.l}{it.n !== undefined && <span className="opacity-60 text-[11px]">{it.n}</span>}
        </button>
      ))}
    </div>
  );
}
/** Zoom control shared by the ID card and poster editors. */
export function ZoomBar({ zoom, setZoom, min = 0.5, max = 3 }: { zoom: number; setZoom: (z: number) => void; min?: number; max?: number }) {
  const step = (d: number) => setZoom(Math.round(Math.min(max, Math.max(min, zoom + d)) * 100) / 100);
  return (
    <div className="card2 px-2.5 py-1.5 mb-2.5 flex items-center gap-2 self-center">
      <IconBtn n="minus" s={15} title="Zoom out" onClick={() => step(-0.25)} />
      <input type="range" min={min} max={max} step={0.05} value={zoom} aria-label="Zoom"
        style={{ width: 130 }} onChange={(e) => setZoom(parseFloat(e.target.value))} />
      <span className="mono text-[12px] font-extrabold" style={{ minWidth: 44, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
      <IconBtn n="plus" s={15} title="Zoom in" onClick={() => step(0.25)} />
      <button type="button" className="btn line sm" onClick={() => setZoom(1)} title="Reset zoom">Fit</button>
    </div>
  );
}

/** Searchable font picker over the full catalogue — loads each family as it is previewed. */
export function FontPicker({ value, onChange, fonts, request }: {
  value: string; onChange: (f: string) => void; fonts: string[]; request?: (f: string) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? fonts.filter((f) => f.toLowerCase().includes(s)) : fonts).slice(0, 300);
  }, [q, fonts]);
  useEffect(() => { list.slice(0, 40).forEach((f) => request?.(f)); }, [list, request]);
  return (
    <div>
      <input className="input mb-1.5" value={q} placeholder={`Search ${fonts.length} fonts…`} onChange={(e) => setQ(e.target.value)} />
      <div className="grid gap-0.5 overflow-y-auto" style={{ maxHeight: 190 }}>
        {list.map((f) => (
          <button key={f} type="button" onMouseEnter={() => request?.(f)}
            onClick={() => { request?.(f); onChange(f); }}
            className="text-left px-2.5 py-1.5 rounded-lg text-[13px] truncate"
            style={{
              background: value === f ? "var(--acc-soft)" : "transparent",
              color: value === f ? "var(--acc)" : "var(--ink)",
              fontFamily: `"${f}"`, fontWeight: 600,
            }}>
            {f}
          </button>
        ))}
        {list.length === 0 && <div className="text-[12px] font-bold py-3 text-center" style={{ color: "var(--mut)" }}>no font matches</div>}
      </div>
    </div>
  );
}

export function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return <span className="tag" style={color ? { background: color + "26", color } : { background: "var(--panel3)", color: "var(--mut)" }}>{children}</span>;
}
export function Dots({ secret, label }: { secret: string; label?: string }) {
  const [show, setShow] = useState(false);
  const toast = useToast();
  const copy = () => {
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = secret; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("Password copied", "ok"); } catch { toast("Copy failed", "err"); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(secret).then(() => toast("Password copied", "ok")).catch(fallback);
    else fallback();
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      {label && <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--mut)" }}>{label}</span>}
      <span className="mono text-[13px] font-bold min-w-[74px] inline-block" style={{ color: "var(--ink)" }}>{show ? secret : "•".repeat(Math.min(secret.length, 10))}</span>
      <IconBtn n={show ? "eyeoff" : "eye"} s={14} title="Toggle visibility" onClick={() => setShow((s) => !s)} className="shrink-0" />
      <IconBtn n="copy" s={14} title="Copy password" onClick={copy} className="shrink-0" />
    </span>
  );
}
export function Empty({ icon = "sparkle", title, body }: { icon?: string; title: string; body?: string }) {
  return (
    <div className="card2 flex flex-col items-center justify-center text-center py-14 px-6 anim-in">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--marigold-soft)", color: "var(--marigold)" }}>
        <Icon n={icon} s={26} />
      </div>
      <div className="font-d text-[15px] font-bold mb-1.5">{title}</div>
      {body && <div className="text-[13px] font-semibold max-w-[340px]" style={{ color: "var(--mut)" }}>{body}</div>}
    </div>
  );
}
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
      <div>
        <h1 className="font-d text-[22px] md:text-[26px] font-extrabold leading-tight">{title}</h1>
        {sub && <p className="text-[13px] font-semibold mt-1" style={{ color: "var(--mut)" }}>{sub}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
export function Stat({ label, value, icon, tone = "var(--acc)" }: { label: string; value: React.ReactNode; icon: string; tone?: string }) {
  return (
    <div className="card hoverable p-4 flex items-center gap-3.5 min-w-[150px] flex-1">
      <div className="w-10.5 h-10.5 rounded-xl flex items-center justify-center shrink-0" style={{ width: 42, height: 42, background: tone + "22", color: tone }}>
        <Icon n={icon} s={20} />
      </div>
      <div>
        <div className="font-d text-[19px] font-extrabold leading-none">{value}</div>
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] mt-1.5" style={{ color: "var(--mut)" }}>{label}</div>
      </div>
    </div>
  );
}

/* ============================= modal ============================= */
export function Modal({ open, onClose, title, children, w = 460, footer }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; w?: number; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal pop" style={{ maxWidth: w }} role="dialog" aria-modal>
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="font-d text-[15px] font-bold">{title}</div>
          <IconBtn n="x" title="Close" onClick={onClose} />
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--line)" }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ============================= confirm (ask) ============================= */
interface AskOpts { title: string; body?: React.ReactNode; yes?: string; danger?: boolean; }
const AskCtx = createContext<((o: AskOpts) => Promise<boolean>) | null>(null);
export function useAsk() {
  const c = useContext(AskCtx);
  if (!c) throw new Error("ask missing");
  return c;
}
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<(AskOpts & { resolve: (b: boolean) => void }) | null>(null);
  const ask = useCallback((o: AskOpts) => new Promise<boolean>((resolve) => setReq({ ...o, resolve })), []);
  const done = (b: boolean) => { req?.resolve(b); setReq(null); };
  return (
    <AskCtx.Provider value={ask}>
      {children}
      {req && (
        <div className="modal-back fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) done(false); }}>
          <div className="modal pop" style={{ maxWidth: 400 }}>
            <div className="p-5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: req.danger ? "var(--coral-soft)" : "var(--marigold-soft)", color: req.danger ? "var(--coral)" : "var(--marigold)" }}>
                  <Icon n={req.danger ? "trash" : "info"} s={19} />
                </div>
                <div className="flex-1">
                  <div className="font-d text-[15px] font-bold">{req.title}</div>
                  {req.body && <div className="text-[13.5px] font-semibold mt-1.5 leading-relaxed" style={{ color: "var(--mut)" }}>{req.body}</div>}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <Btn kind="soft" onClick={() => done(false)}>Cancel</Btn>
                <Btn kind={req.danger ? "danger" : "primary"} autoFocus onClick={() => done(true)}>{req.yes || "Confirm"}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </AskCtx.Provider>
  );
}

/* ============================= toasts ============================= */
interface Toast { id: number; msg: string; kind: "ok" | "err" | "info"; }
const ToastCtx = createContext<((msg: string, kind?: "ok" | "err" | "info") => void) | null>(null);
export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("toast missing");
  return c;
}
let toastSeq = 1;
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: "ok" | "err" | "info" = "info") => {
    const id = toastSeq++;
    setItems((p) => [...p.slice(-3), { id, msg, kind }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-2 pointer-events-none">
        {items.map((t) => (
          <div key={t.id} className="toast-in flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-bold shadow-lg"
            style={{ background: "var(--ink)", color: "var(--bg)", border: "1px solid var(--line2)" }}>
            <span style={{ color: t.kind === "ok" ? "var(--acc)" : t.kind === "err" ? "var(--coral)" : "var(--marigold)" }}>
              <Icon n={t.kind === "ok" ? "check" : t.kind === "err" ? "x" : "sparkle"} s={15} sw={2.4} />
            </span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ============================= misc hooks ============================= */
export function useKeyNav(onSlash?: () => void) {
  useEffect(() => {
    if (!onSlash) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) { e.preventDefault(); onSlash(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onSlash]);
}
