import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { ArrowLeft, ArrowRight, Bell, Check, ChevronDown, Globe, IdCard, KeyRound, ListChecks, Minus, MonitorSpeaker, Play, Plus, Printer, ShieldCheck, Users, UsersRound, Eye, EyeOff } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { readTheme } from "./lib/theme";
import { FestizeLogo } from "./FestizeLogo";

const PAIN_POINTS = [
  { icon: "❌", name: "Spreadsheet Chaos", text: "Formulas break, sheets get accidentally overwritten, and nobody knows which version is the true final tally." },
  { icon: "👀", name: "Score Disputes", text: "When teams question a judgment, there is no verifiable digital audit trail showing individual judges' marks." },
  { icon: "📱", name: "WhatsApp Overload", text: "Hundreds of frantic group messages, missed calls between stage managers, and lost result paper slips." },
  { icon: "⏱️", name: "Valedictory Delays", text: "Hours lost manually calculating championship points, typing winner posters, and handwriting certificates." },
];

const STEPS = [
  { number: "01", name: "Import & Roster", text: "Paste rows or upload Excel sheets. Unique participant codes (#42@123) are generated automatically." },
  { number: "02", name: "Program Rules", text: "Configure events, category limits, individual vs group quotas, and specific grade point scales." },
  { number: "03", name: "Stage & Timetable", text: "Interactive schedule prevents student clashes across overlapping stages. Floor tracking moves in real time." },
  { number: "04", name: "Blind Judging", text: "Judges mark anonymous code letters only out of 100 with our integrated acoustic stage bell." },
  { number: "05", name: "Instant Publish", text: "Approved results generate result posters, live public leaderboards, and Excel call sheets." },
];

const FEATURES = [
  { Icon: ListChecks, tone: "gold", name: "Program & Rule Engine", text: "Support for individual and group competitions, category quotas, team member caps, and custom grade scales." },
  { Icon: MonitorSpeaker, tone: "mint", name: "Stage Control & Timetable", text: "Conflict-aware timetable with start and end times that strictly prevents any student from being scheduled simultaneously in two programs." },
  { Icon: Bell, tone: "peach", name: "Blind Judging & Stage Bell", text: "Evaluators only see anonymous code letters. Features realistic acoustic bell tones with continuous ringing and automated timer warning dings." },
  { Icon: IdCard, tone: "mint", name: "ID Card & Badge Studio", text: "Design festival passes with 300 DPI high-resolution export, custom bleed, 500+ fonts, participant QR codes, and A4 multi-card printable layouts." },
  { Icon: Globe, tone: "lilac", name: "Live Public Scoreboard", text: "Share real-time team championship standing. Main administrators control exactly which published results release to the public board." },
  { Icon: Printer, tone: "gold", name: "Excel & PDF Call Sheets", text: "Generate ready-to-print official Excel spreadsheets and PDF sheets with group combos, team rosters, and signature columns." },
];

const ROLES = [
  { Icon: KeyRound, name: "Main Administrator", tagline: "Total Command Over Every Stage, Rule & Result", points: ["Create, rename, configure and permanently safeguard entire festival databases.", "Full role-based access delegation for judges, stage managers, team managers, and monitors.", "Custom grade point scales (Standard, Simple, Custom) bound to individual programs.", "Timetable scheduler with automated student conflict prevention across overlapping stages."] },
  { Icon: ShieldCheck, name: "Judges", tagline: "Fair Marks Without Names or Pressure", points: ["See only the programs assigned to them, nothing else.", "Score anonymous code letters out of 100 — never names or teams.", "Grades and grade points calculated live from the program's own scale.", "A one-tap acoustic stage bell for timing performances."] },
  { Icon: MonitorSpeaker, name: "Stage Managers", tagline: "Keep Every Stage Moving on Time", points: ["Live stage control with the full Reporting → Published flow.", "Stage and venue details with photos at their fingertips.", "The shared timetable, always current on every device.", "Bell cues for openings, warnings, and closings."] },
  { Icon: UsersRound, name: "Team Managers", tagline: "Their Team, Their Entries, Nothing Else", points: ["Add and edit members of their own team only.", "Enter their members into eligible programs within quota limits.", "Team-scoped printouts and program registers.", "A clean tab-based workspace with zero clutter."] },
  { Icon: Eye, name: "Monitors & Media", tagline: "Verify First, Celebrate Second", points: ["Monitors review scored results and mark them checked before release.", "Code letter entry and random draw tools for fair stage order.", "Media teams see confirmed results ready for poster production.", "Reporting lists printable straight from the workspace."] },
  { Icon: Users, name: "Participants & Parents", tagline: "One Scan Away From Their Moment", points: ["Members sign in with their personal code — or scan their ID card QR.", "A personal dashboard with their programs, finished and upcoming.", "Published results with poster templates, numbered by release.", "The public team scoreboard, live as points are released."] },
];

const EDITIONS = [
  { tone: "mint", badge: "Standard", intro: "For a small fest with many participants and programs.", items: ["Up to 200 participants", "Up to 10 teams", "Up to 40 programs", "Up to 4 stages", "Excel & PDF Reports + ID Cards"] },
  { tone: "gold", badge: "Full Fest", intro: "For a full-size institutional fest with many participants and programs.", items: ["Up to 500 participants", "Up to 25 teams", "Up to 100 programs", "Real-time Cloud Sync across all devices", "Priority Technical Support"] },
  { tone: "lilac", badge: "Custom", intro: "For an event whose size or requirements do not fit the standard plans.", items: ["Limitless participants", "Limitless teams", "Limitless programs", "Real-time Cloud Sync across all devices", "Bespoke setup tailored to your event"] },
];

const FAQS = [
  { question: "Can we run Festize completely offline during the festival?", answer: "Yes! Festize is built as a single-file application with persistent offline storage. You can run all judging, scheduling, stage control, and ID card printing locally without an active internet connection. When connected, it syncs live to the cloud database." },
  { question: "How does anonymous code-based judging work?", answer: "When candidates report in, each one receives a unique code letter. Judges see only those letters — never names or teams — and enter marks out of 100. Grades and grade points are calculated automatically from the grade scale bound to that program, and the full trail of every judge's marks is kept for review." },
  { question: "Can a student be accidentally scheduled in two programs at the same time?", answer: "No. The timetable checks every placement as you make it. A program can only occupy one slot, and if two programs share even a single member, Festize refuses to place them in overlapping times — on any stage — and tells you exactly which member clashes." },
  { question: "How does multi-device cloud synchronization work?", answer: "Every fest lives under its own fest code. When cloud sync is configured, changes made by any signed-in crew member are saved to the database and pushed live to every other device in the same fest. Each fest's data stays completely separate from every other fest." },
  { question: "Can we print ID cards with 3 mm bleed and crop marks on standard A4 paper?", answer: "Yes. The ID Card Studio supports preset and fully custom card sizes, multiple paper options including A4, adjustable margins and gaps, optional crop marks, and automatic multi-card layout. The PDF export matches the on-screen preview exactly." },
];

/** The first screen always uses the Obsidian Gold palette. */
const LANDING_THEME = "obsidian";
const OBSIDIAN_GOLD_RGB = "217,169,79";

/**
 * Pointer-reactive constellation drawn on a fixed, full-viewport canvas behind the
 * whole first screen: drifting dots link to their neighbours, light up near the
 * cursor, are gently pushed aside, and draw threads to the pointer.
 */
function Constellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(OBSIDIAN_GOLD_RGB);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: -9999, y: -9999, active: false };
    type Dot = { x: number; y: number; vx: number; vy: number; r: number; phase: number };
    let dots: Dot[] = [];
    let frame = 0; let time = 0;
    const seed = () => {
      const width = canvas.clientWidth; const height = canvas.clientHeight;
      const count = Math.round(Math.min(240, Math.max(76, width * height / 7000)));
      dots = Array.from({ length: count }, () => ({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - .5) * .38, vy: (Math.random() - .5) * .38, r: Math.random() * 1.6 + .6, phase: Math.random() * Math.PI * 2 }));
    };
    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio; canvas.height = canvas.clientHeight * devicePixelRatio;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      seed();
    };
    const move = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; pointer.active = pointer.y >= 0 && pointer.y <= rect.height; };
    const leave = () => { pointer.active = false; pointer.x = -9999; pointer.y = -9999; };
    const LINK = 128; const REACH = 190;
    const draw = () => {
      const width = canvas.clientWidth; const height = canvas.clientHeight; const rgb = colorRef.current;
      time += .016;
      context.clearRect(0, 0, width, height);
      for (const dot of dots) {
        const dx = dot.x - pointer.x; const dy = dot.y - pointer.y; const distance = Math.hypot(dx, dy);
        if (pointer.active && distance < REACH && distance > 0) {
          const force = (1 - distance / REACH) * .07;
          dot.vx += dx / distance * force; dot.vy += dy / distance * force;
        }
        dot.vx = dot.vx * .985 + Math.cos(time + dot.phase) * .004;
        dot.vy = dot.vy * .985 + Math.sin(time + dot.phase) * .004;
        if (!reduced) { dot.x += dot.vx; dot.y += dot.vy; }
        if (dot.x < -10) dot.x = width + 10; if (dot.x > width + 10) dot.x = -10;
        if (dot.y < -10) dot.y = height + 10; if (dot.y > height + 10) dot.y = -10;
      }
      context.lineWidth = .7;
      for (let a = 0; a < dots.length; a++) {
        for (let b = a + 1; b < dots.length; b++) {
          const dx = dots[a].x - dots[b].x; const dy = dots[a].y - dots[b].y;
          const distance = dx * dx + dy * dy;
          if (distance > LINK * LINK) continue;
          const alpha = (1 - Math.sqrt(distance) / LINK) * .2;
          context.strokeStyle = `rgba(${rgb},${alpha})`;
          context.beginPath(); context.moveTo(dots[a].x, dots[a].y); context.lineTo(dots[b].x, dots[b].y); context.stroke();
        }
      }
      for (const dot of dots) {
        const distance = Math.hypot(dot.x - pointer.x, dot.y - pointer.y);
        const near = pointer.active && distance < REACH;
        if (near) {
          context.strokeStyle = `rgba(${rgb},${(1 - distance / REACH) * .55})`;
          context.beginPath(); context.moveTo(dot.x, dot.y); context.lineTo(pointer.x, pointer.y); context.stroke();
        }
        const twinkle = .55 + Math.sin(time * 2 + dot.phase) * .25;
        context.beginPath(); context.arc(dot.x, dot.y, near ? dot.r + .9 : dot.r, 0, Math.PI * 2);
        context.fillStyle = `rgba(${rgb},${near ? .95 : twinkle * .6})`; context.fill();
      }
      if (pointer.active) {
        const glow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 34);
        glow.addColorStop(0, `rgba(${rgb},.5)`); glow.addColorStop(1, `rgba(${rgb},0)`);
        context.fillStyle = glow; context.beginPath(); context.arc(pointer.x, pointer.y, 34, 0, Math.PI * 2); context.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    resize(); draw();
    const root = document.documentElement;
    window.addEventListener("resize", resize); window.addEventListener("pointermove", move); root.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move); root.removeEventListener("pointerleave", leave); };
  }, []);
  return <canvas ref={canvasRef} className="hero-particles" aria-hidden="true" />;
}

const HERO_CHIPS = [
  { className: "chip-a", depth: 34, kicker: "● STAGE 2 · LIVE", title: "Group Dance", detail: "Code B is on stage now" },
  { className: "chip-b", depth: -26, kicker: "JUDGE 03", title: "Mark saved", detail: "92 / 100 · Grade A+" },
  { className: "chip-c", depth: -38, kicker: "RESULT #07", title: "Published", detail: "Poster ready to share ✓" },
  { className: "chip-d", depth: 24, kicker: "NORTH HOUSE", title: "+18 points", detail: "Climbs to rank 01" },
];

function FloatingChip({ chip, mx, my, index, ready }: { chip: typeof HERO_CHIPS[number]; mx: MotionValue<number>; my: MotionValue<number>; index: number; ready: boolean }) {
  const x = useTransform(mx, value => value * chip.depth);
  const y = useTransform(my, value => value * chip.depth);
  return <motion.div className={`hero-chip ${chip.className}`} style={{ x, y }} initial={{ opacity: 0, scale: .9 }} animate={ready ? { opacity: 1, scale: 1 } : { opacity: 0, scale: .9 }} transition={{ delay: ready ? .75 + index * .13 : 0, duration: .7 }} aria-hidden="true">
    <div className="hero-chip-float" style={{ animationDelay: `${index * -1.6}s` }}><span>{chip.kicker}</span><strong>{chip.title}</strong><small>{chip.detail}</small></div>
  </motion.div>;
}

const HEADLINE: { text: string; tone?: "gold" | "peach" }[] = [
  { text: "Run" }, { text: "your" }, { text: "fest" }, { text: "without" }, { text: "chasing" },
  { text: "spreadsheets,", tone: "gold" }, { text: "score", tone: "peach" }, { text: "sheets", tone: "peach" },
  { text: "and" }, { text: "stage" }, { text: "updates." },
];

const NAV_LINKS = [
  { label: "Features", target: "features" },
  { label: "Workflow", target: "workflow" },
  { label: "Roles", target: "roles" },
  { label: "Pricing", target: "pricing" },
  { label: "FAQ", target: "faq" },
];

const scrollToSection = (target: string) => document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });

const EASE_OUT = [.2, .8, .2, 1] as const;

/**
 * `introActive`: the opening intro is still covering this screen, so hold the
 * entrance animations until it hands over.
 * `logoHandoff`: the intro's logo just landed exactly on the hero logo, so the
 * hero logo appears instantly instead of animating in.
 */
export function Landing({ onExplore, onJoin, introActive = false, logoHandoff = false }: { onExplore: () => void; onJoin: () => void; introActive?: boolean; logoHandoff?: boolean }) {
  const ready = !introActive;
  const landingRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLHeadingElement>(null);
  const [brandInView, setBrandInView] = useState(true);
  const rawX = useMotionValue(0); const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 60, damping: 18 }); const my = useSpring(rawY, { stiffness: 60, damping: 18 });

  // The nav wordmark stays out of the way while the big hero brand is on screen.
  useEffect(() => {
    const brand = brandRef.current;
    if (!brand || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setBrandInView(entry.isIntersecting), { rootMargin: "-68px 0px 0px 0px" });
    observer.observe(brand);
    return () => observer.disconnect();
  }, []);

  // Lock the first screen to Obsidian Gold. The visitor's own theme choice stays
  // saved and is restored as soon as they leave this screen.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = LANDING_THEME;
    return () => { document.documentElement.dataset.theme = readTheme(); };
  }, []);

  // One pointer tracker for the whole page: drives the spotlight and the hero card parallax.
  const trackPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    rawX.set(event.clientX / window.innerWidth - .5);
    rawY.set(event.clientY / window.innerHeight - .5);
    landingRef.current?.style.setProperty("--spot-x", `${event.clientX}px`);
    landingRef.current?.style.setProperty("--spot-y", `${event.clientY}px`);
  };
  return <div className="landing dark-root" ref={landingRef} onPointerMove={trackPointer} onPointerLeave={() => { rawX.set(0); rawY.set(0); }}>
    <div className="landing-fx" aria-hidden="true">
      <div className="hero-aurora"><i className="aurora-a" /><i className="aurora-b" /><i className="aurora-c" /></div>
      <div className="hero-spotlight" />
      <Constellation />
    </div>
    <motion.header className="fest-nav" initial={{ opacity: 0, y: -14 }} animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: -14 }} transition={{ duration: .6, delay: ready ? .15 : 0, ease: EASE_OUT }}>
      <button className={`wordmark small nav-brand${brandInView ? " is-hidden" : ""}`} tabIndex={brandInView ? -1 : 0} aria-hidden={brandInView || undefined} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Festize home"><FestizeLogo className="nav-logo" title={null} />festize<span>.</span></button>
      <nav className="fest-nav-links" aria-label="Page sections">
        {NAV_LINKS.map(link => <button key={link.target} onClick={() => scrollToSection(link.target)}>{link.label}</button>)}
      </nav>
    </motion.header>
    <section className="dark-hero hero-left">
      <div className="dark-hero-glow" aria-hidden="true" />
      {HERO_CHIPS.map((chip, index) => <FloatingChip key={chip.className} chip={chip} mx={mx} my={my} index={index} ready={ready} />)}
      <div className="dark-hero-content">
        <motion.span className="hero-badge" initial={{ opacity: 0, y: -12 }} animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }} transition={{ duration: .6, delay: ready ? .28 : 0 }}><span className="badge-dot" /> SCHOOL ARTS &amp; CULTURAL FEST SOFTWARE</motion.span>
        <h1 className="hero-brand" ref={brandRef}>
          {/* The intro's logo lands exactly here, so this one stays hidden until the hand-over. */}
          <span id="hero-logo" className={`hero-logo-slot${ready && !logoHandoff ? " pop-in" : ""}`} style={{ opacity: introActive ? 0 : 1 }} aria-hidden="true"><FestizeLogo title={null} /></span>
          <motion.span className="hero-wordmark-big" initial={{ opacity: 0, scale: 1.12, filter: "blur(12px)" }} animate={ready ? { opacity: 1, scale: 1, filter: "blur(0px)" } : { opacity: 0, scale: 1.12, filter: "blur(12px)" }} transition={{ duration: .75, delay: ready ? (logoHandoff ? .02 : .14) : 0, ease: EASE_OUT }}>festize<span>.</span></motion.span>
        </h1>
        <p className="hero-tagline">
          <span className="sr-only">Run your fest without chasing spreadsheets, score sheets and stage updates.</span>
          {HEADLINE.map((word, index) => <span className="word-wrap" key={`${word.text}-${index}`} aria-hidden="true">
            <motion.span className={`word ${word.tone ? `word-${word.tone} shimmer` : ""}`} initial={{ y: "105%", opacity: 0 }} animate={ready ? { y: "0%", opacity: 1 } : { y: "105%", opacity: 0 }} transition={{ delay: ready ? .42 + index * .045 : 0, duration: .6, ease: EASE_OUT }}>{word.text}</motion.span>
          </span>)}
        </p>
        <motion.p className="hero-sub" initial={{ opacity: 0, y: 16 }} animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }} transition={{ delay: ready ? .92 : 0, duration: .7 }}>Set up participants and programs, keep stages moving, collect judges' marks with zero bias, and publish approved results in one unified place. From 50 to 5,000 participants — run your festival with complete confidence.</motion.p>
        <motion.div className="dark-hero-ctas" initial={{ opacity: 0, y: 16 }} animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }} transition={{ delay: ready ? 1.06 : 0, duration: .7 }}>
          <button className="cta-gold" onClick={onExplore}><span className="cta-sheen" aria-hidden="true" /><Play size={15} fill="currentColor" /> Explore Platform</button>
          <button className="cta-outline" onClick={() => scrollToSection("workflow")}><ChevronDown size={16} /> How It Works</button>
        </motion.div>
        <motion.span className="hero-footnote" initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={{ delay: ready ? 1.25 : 0, duration: .8 }}>Evaluation is permanently free · Offline-first architecture · Instant real-time sync</motion.span>
      </div>
      <motion.button className="scroll-cue" initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={{ delay: ready ? 1.45 : 0, duration: .6 }} onClick={() => scrollToSection("control-room")} aria-label="Scroll to learn more"><span /></motion.button>
    </section>
    <DarkSections onJoin={onJoin} />
  </div>;
}

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return <motion.div initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: .55, delay }}>{children}</motion.div>;
}

function SectionHead({ kicker, tone = "gold", title, subtitle }: { kicker: string; tone?: string; title: ReactNode; subtitle: string }) {
  return <Reveal><div className="dark-section-head"><span className={`dark-kicker tone-${tone}`}>{kicker}</span><h2>{title}</h2><p>{subtitle}</p></div></Reveal>;
}

function DarkSections({ onJoin }: { onJoin: () => void }) {
  const [role, setRole] = useState(0);
  const [faqOpen, setFaqOpen] = useState(0);
  const activeRole = ROLES[role];
  return <div className="dark-landing" id="how-it-works">
    <section className="dark-section" id="control-room">
      <SectionHead kicker="STOP MANAGING YOUR FESTIVAL WITH SPREADSHEETS" tone="peach" title={<>Sound Familiar? 😫</>} subtitle="Every year, hundreds of school fests suffer from the same preventable administrative nightmares." />
      <div className="pain-grid">{PAIN_POINTS.map((pain, index) => <Reveal key={pain.name} delay={index * .07}><article className="pain-card"><span className="pain-icon">{pain.icon}</span><h3>{pain.name}</h3><p>{pain.text}</p></article></Reveal>)}</div>
    </section>

    <section className="dark-section" id="workflow">
      <SectionHead kicker="ONE UNIFIED COMMAND CENTER" title={<>Up and Running in 5 Seamless Steps 🎯</>} subtitle="Festize replaces fragmented tools with an end-to-end operational pipeline." />
      <div className="step-grid">{STEPS.map((step, index) => <Reveal key={step.number} delay={index * .06}><article className="step-card"><span className="step-number">{step.number}</span><h3>{step.name}</h3><p>{step.text}</p></article></Reveal>)}</div>
    </section>

    <section className="dark-section" id="features">
      <SectionHead kicker="ENGINEERED FOR PRECISION" tone="mint" title={<>Everything Your Festival Needs 🛠️</>} subtitle="Built from real ground experience managing state and district youth cultural festivals." />
      <div className="feature-grid">{FEATURES.map((feature, index) => <Reveal key={feature.name} delay={index * .05}><article className="feature-card"><span className={`feature-icon tone-${feature.tone}`}><feature.Icon size={19} /></span><h3>{feature.name}</h3><p>{feature.text}</p></article></Reveal>)}</div>
    </section>

    <section className="dark-section" id="roles">
      <SectionHead kicker="TAILORED USER EXPERIENCES" title={<>Right Access for Every Crew Member 🔓</>} subtitle="Each role gets exactly the workspace and controls they need to do their job without confusion." />
      <Reveal><div className="role-tabs" role="tablist" aria-label="Crew roles">{ROLES.map((item, index) => <button key={item.name} role="tab" aria-selected={role === index} className={role === index ? "active" : ""} onClick={() => setRole(index)}><item.Icon size={15} /> {item.name}</button>)}</div></Reveal>
      <motion.div key={activeRole.name} role="tabpanel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }} className="role-panel">
        <div className="role-panel-head"><span className="role-panel-icon"><activeRole.Icon size={21} /></span><div><h3>{activeRole.name}</h3><p>{activeRole.tagline}</p></div></div>
        <ul>{activeRole.points.map(point => <li key={point}><Check size={15} />{point}</li>)}</ul>
      </motion.div>
    </section>

    <section className="dark-section" id="pricing">
      <SectionHead kicker="SIMPLE & TRANSPARENT" tone="mint" title={<>Festival Editions 💰</>} subtitle="Choose the plan that fits your fest. Every plan includes all features." />
      <div className="edition-grid">{EDITIONS.map((edition, index) => <Reveal key={edition.badge} delay={index * .08}><article className={`edition-card tone-${edition.tone}`}><span className="edition-badge">★ {edition.badge}</span><h3>{edition.intro}</h3><ul>{edition.items.map(item => <li key={item}><Check size={15} />{item}</li>)}</ul><a className="edition-contact" href="https://wa.me/qr/LP2C2F5XW77EN1" target="_blank" rel="noreferrer">Contact</a></article></Reveal>)}</div>
    </section>

    <section className="dark-section faq-section" id="faq">
      <SectionHead kicker="QUESTIONS & ANSWERS" title={<>Frequently Asked Questions 💡</>} subtitle="Straight answers about how Festize behaves when it matters." />
      <div className="faq-list">{FAQS.map((faq, index) => <Reveal key={faq.question} delay={index * .04}><div className={`faq-item ${faqOpen === index ? "open" : ""}`}><button className="faq-question" aria-expanded={faqOpen === index} onClick={() => setFaqOpen(faqOpen === index ? -1 : index)}>{faq.question}<span>{faqOpen === index ? <Minus size={17} /> : <Plus size={17} />}</span></button>{faqOpen === index && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="faq-answer">{faq.answer}</motion.p>}</div></Reveal>)}</div>
    </section>

    <footer className="dark-footer"><span className="footer-brand"><FestizeLogo className="footer-logo" title={null} /><span className="wordmark">festize<span>.</span></span></span><span>Let the good things happen.</span><button onClick={onJoin}>Have a fest? <ArrowRight size={16} /></button></footer>
  </div>;
}

export function AuthLayout({ children, onBack, eyebrow, title, description }: { children: ReactNode; onBack: () => void; eyebrow: string; title: string; description: string }) {
  return <div className="auth-screen"><div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" /><button className="auth-back" onClick={onBack}><ArrowLeft size={18} /> Back</button><div className="auth-brand">festize<span>.</span></div><motion.div className="auth-content" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="auth-description">{description}</p>{children}</motion.div><div className="auth-foot">A BETTER WAY TO MAKE IT HAPPEN.</div></div>;
}

export function PasswordInput({ value, onChange, placeholder = "Enter password" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="password-wrap"><input required value={value} type={visible ? "text" : "password"} placeholder={placeholder} onChange={event => onChange(event.target.value)} /><button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>;
}