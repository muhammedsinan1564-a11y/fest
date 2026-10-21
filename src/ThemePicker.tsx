import { AnimatePresence, motion } from "framer-motion";
import { Check, Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SITE_THEMES, useSiteTheme, waveThemeChange } from "./lib/theme";

/** Opens left-to-right from its button and switches the whole website's palette. */
export default function ThemePicker({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useSiteTheme();
  const [open, setOpen] = useState(false);
  const holderRef = useRef<HTMLDivElement>(null);
  const active = SITE_THEMES.find(item => item.id === theme) || SITE_THEMES[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!holderRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return <div className="theme-picker" ref={holderRef}>
    <button type="button" className={`theme-trigger ${compact ? "compact" : ""}`} aria-haspopup="listbox" aria-expanded={open} aria-label={`Colour theme: ${active.name}. Change theme`} title="Change colour theme" onClick={() => setOpen(!open)}>
      <span className="theme-trigger-swatch" aria-hidden="true">{active.swatch.map(color => <i key={color} style={{ background: color }} />)}</span>
      {!compact && <Palette size={14} />}
    </button>
    <AnimatePresence>
      {open && <motion.div className="theme-menu" role="listbox" aria-label="Colour themes" initial={{ opacity: 0, y: -6, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: .97 }} transition={{ duration: .16 }}>
        <span className="theme-menu-title">PREMIUM THEMES</span>
        {SITE_THEMES.map(item => <button type="button" role="option" aria-selected={item.id === theme} key={item.id} className={item.id === theme ? "active" : ""} onClick={event => { const button = event.currentTarget; setOpen(false); waveThemeChange(button, () => setTheme(item.id), item.swatch[0]); }}>
          <span className="theme-option-swatch" aria-hidden="true" style={{ background: `linear-gradient(135deg, ${item.swatch[0]} 0 45%, ${item.swatch[1]} 45% 70%, ${item.swatch[2]} 70%)` }} />
          <span className="theme-option-copy"><strong>{item.name}</strong><small>{item.tagline}</small></span>
          {item.id === theme && <Check size={15} className="theme-option-check" />}
        </button>)}
      </motion.div>}
    </AnimatePresence>
  </div>;
}
