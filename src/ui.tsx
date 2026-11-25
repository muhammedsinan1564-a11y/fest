import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Download, Eye, EyeOff, LayoutGrid, List, Plus, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import type * as React from "react";
import { FestizeLogo } from "./FestizeLogo";
import { printLogoSrc } from "./lib/brand";
import { cn } from "./utils/cn";

/** Step 1 of every download: ask first, exactly like the printouts. */
export function askToDownload(what: string) {
  if (typeof window === "undefined") return false;
  return window.confirm(`Do you want to download ${what}?\n\nA preview will open first so you can check it.`);
}

/**
 * Steps 2 + 3 of every download: show the preview, then save on "Confirm download".
 * Guards against double clicks, reports progress for long exports, and stays open
 * with a readable message if anything fails.
 */
export function DownloadPreview({ title, subtitle, format, onClose, onConfirm, children, confirmLabel = "Confirm download" }: {
  title: string;
  subtitle?: string;
  format: string;
  onClose: () => void;
  onConfirm: (report: (message: string) => void) => Promise<void>;
  children: ReactNode;
  confirmLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const close = () => { if (!busyRef.current) onClose(); };
  const run = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("Preparing your file…");
    try {
      await onConfirm(setStatus);
      busyRef.current = false;
      setBusy(false);
      onClose();
    } catch (reason) {
      busyRef.current = false;
      setBusy(false);
      setStatus("");
      setError(reason instanceof Error && reason.message ? reason.message : "The file could not be prepared. Please try again.");
    }
  };
  return <Modal onClose={close} subtitle={subtitle} title={title} wide>
    <div className="download-preview">
      <div className="download-preview-meta"><span className="download-format">{format}</span><span>Preview · this is exactly what will be saved</span></div>
      <div className="download-preview-body">{children}</div>
      {error && <p className="warn-text" role="alert">{error}</p>}
      <div className="form-actions download-actions">
        {busy && <span className="download-status" aria-live="polite">{status}</span>}
        <Button disabled={busy} onClick={close} variant="secondary">Back</Button>
        <Button onClick={() => void run()} disabled={busy} icon={<Download size={16} />}>{busy ? "Preparing…" : confirmLabel}</Button>
      </div>
    </div>
  </Modal>;
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
};

export function Button({ children, variant = "primary", size = "md", icon, className = "", type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} className={cn("btn", `btn-${variant}`, BUTTON_SIZE_CLASSES[size], className)}>{icon}{children}</button>;
}

export function IconButton({ children, label, className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type={type} aria-label={label} title={label} className={cn("icon-btn", className)} {...props}>{children}</button>;
}

export function Card({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("fz-card rounded-2xl", className)}>{children}</div>;
}

export function SubCard({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("fz-subcard rounded-xl", className)}>{children}</div>;
}

export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("fz-input px-3 py-2 rounded-xl text-sm", className)} />;
}

export function Textarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("fz-input px-3 py-2 rounded-xl text-sm resize-none", className)} />;
}

export function Select({ children, className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("fz-input px-3 py-2 rounded-xl text-sm cursor-pointer", className)}>{children}</select>;
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={cn("field", className)}><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

/** Password entry with an accessible inline show/hide toggle. */
export function PasswordInput({ value, onChange, placeholder = "Enter password", autoFocus = false }: { value: string; onChange: (value: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="password-wrap"><input required autoFocus={autoFocus} value={value} type={visible ? "text" : "password"} placeholder={placeholder} onChange={event => onChange(event.target.value)} /><button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>;
}

export function PageHead({ eyebrow, title, description, action, back }: { eyebrow?: string; title: string; description?: string; action?: ReactNode; back?: () => void }) {
  return <div className="page-head">
    <div className="page-head-copy">{back && <button type="button" className="back-inline" onClick={back}><ArrowLeft size={16} /> Back</button>}{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action && <div className="page-actions">{action}</div>}
  </div>;
}

export function SearchInput({ value, onChange, placeholder = "Search..." }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="search-input"><Search size={17} aria-hidden="true" /><input aria-label={placeholder} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></div>;
}

export function Empty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-symbol" aria-hidden="true"><Plus size={26} strokeWidth={1.4} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

const STATUS_LABELS = ["Reporting", "Started", "Finished", "Judgements", "Finalysed", "Published"];

export function StatusBadge({ status }: { status: number }) {
  const label = status < 0 ? "Not started" : STATUS_LABELS[status] ?? "Unknown";
  const tone = status < 0 ? "idle" : Math.min(status, STATUS_LABELS.length - 1);
  return <span className={`status-badge status-${tone}`}>{status < 0 ? label : `#${status} ${label}`}</span>;
}

export function RowActions({ onView, onEdit, onDelete }: { onView?: () => void; onEdit?: () => void; onDelete?: () => void }) {
  return <div className="row-actions">{onView && <button type="button" onClick={onView}>View</button>}{onEdit && <button type="button" onClick={onEdit}>Edit</button>}{onDelete && <button type="button" className="danger-text" onClick={onDelete}>Delete</button>}</div>;
}

export function AddButton({ children = "Add new", onClick }: { children?: ReactNode; onClick: () => void }) {
  return <Button icon={<Plus size={17} />} onClick={onClick}>{children}</Button>;
}

/** "festize." wordmark with its mark in front — used wherever the name appears. */
export function Wordmark({ className = "", markSize = "1em" }: { className?: string; markSize?: string | number }) {
  return <span className={`wordmark-line ${className}`}>
    <span className="wordmark-logo" style={{ width: markSize, height: markSize } as CSSProperties}><FestizeLogo title={null} withWordmark={false} size={typeof markSize === "number" ? markSize : undefined} /></span>
    <span className="wordmark">festize<span>.</span></span>
  </span>;
}

/** Tiny, recognisable logo at the top-right corner of anything that gets printed. */
export function PrintLogo({ logo, label = "FESTIZE" }: { logo?: string | null; label?: string }) {
  return <div className="print-logo" aria-label={`${label} logo`}><img src={printLogoSrc(logo)} alt="" /></div>;
}

/** List rows or a 3-in-a-row box grid; the choice is remembered per section and user. */
export type ViewMode = "list" | "box";

export function useViewPref(key: string): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setModeState] = useState<ViewMode>(() => {
    try { return localStorage.getItem(`festize-view:${key}`) === "box" ? "box" : "list"; }
    catch { return "list"; }
  });
  const setMode = (next: ViewMode) => {
    setModeState(next);
    try { localStorage.setItem(`festize-view:${key}`, next); } catch { /* storage unavailable */ }
  };
  return [mode, setMode];
}

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return <div className="view-toggle" role="group" aria-label="Layout">
    <button type="button" title="List view" aria-label="List view" aria-pressed={mode === "list"} className={mode === "list" ? "active" : ""} onClick={() => onChange("list")}><List size={14} /></button>
    <button type="button" title="Box view · 3 in a row" aria-label="Box view" aria-pressed={mode === "box"} className={mode === "box" ? "active" : ""} onClick={() => onChange("box")}><LayoutGrid size={14} /></button>
  </div>;
}

export function Toast({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return <AnimatePresence>{message && <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }} role="status" aria-live="polite" className="toast"><span className="toast-check"><Check size={15} /></span><span>{message}</span>{onDismiss && <button type="button" aria-label="Dismiss notification" onClick={onDismiss}><X size={15} /></button>}</motion.div>}</AnimatePresence>;
}

export function LinkArrow({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="link-arrow" onClick={onClick}>{children}<ArrowRight size={17} /></button>;
}

export interface ModalProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  footer?: ReactNode;
}

export function Modal({ title, subtitle, children, onClose, wide = false, footer }: ModalProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])') || []);
    (panelRef.current?.querySelector<HTMLElement>("[autofocus]") || focusable()[0])?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, []);
  const titleId = `modal-title-${useId()}`;
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: .22 }} className={`modal-panel ${wide ? "modal-wide" : ""}`}>
      <div className="modal-top"><div><h2 className="modal-title" id={titleId}>{title}</h2>{subtitle && <p className="muted mt-2">{subtitle}</p>}</div><IconButton label="Close dialog" onClick={onClose}><X size={20} /></IconButton></div>
      <div className="modal-body">{children}</div>{footer && <div className="modal-footer">{footer}</div>}
    </motion.section>
  </div>;
}