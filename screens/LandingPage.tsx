import { useState, useRef, useEffect } from "react";
import { Icon, ThemePicker } from "../lib/ui";
import { useStore } from "../lib/store";

interface Props {
  onUnlock: () => void;
  onExplore?: () => void;
  onHaveFest?: () => void;
}

export function LandingPage({ onUnlock, onExplore, onHaveFest }: Props) {
  const { theme, setTheme } = useStore();

  // Secret 5-click logo mechanism
  const [clickCount, setClickCount] = useState(0);
  const [unlocking, setUnlocking] = useState(false);
  const clickTimerRef = useRef<number | null>(null);

  const handleLogoClick = () => {
    if (unlocking) return;

    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
    }

    const nextCount = clickCount + 1;

    if (nextCount >= 5) {
      setUnlocking(true);
      setClickCount(5);
      // Brief visual flash before transitioning to first screen
      window.setTimeout(() => {
        onUnlock();
      }, 350);
    } else {
      setClickCount(nextCount);
      // Reset count if no follow-up click within 2.2 seconds
      clickTimerRef.current = window.setTimeout(() => {
        setClickCount(0);
      }, 2200);
    }
  };

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    };
  }, []);

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Active role tab state
  const [activeRole, setActiveRole] = useState<number>(0);

  const roles = [
    {
      title: "Main Administrator",
      icon: "key",
      tagline: "Total Command Over Every Stage, Rule & Result",
      points: [
        "Create, rename, configure and permanently safeguard entire festival databases.",
        "Full role-based access delegation for judges, stage managers, team managers, and monitors.",
        "Custom grade point scales (Standard, Strict, Custom) bound to individual programs.",
        "Timetable scheduler with automated student conflict prevention across overlapping stages.",
      ],
    },
    {
      title: "Judges",
      icon: "scale",
      tagline: "Unbiased Blind Evaluation with Stage Signal Bell",
      points: [
        "Blind code letter evaluation prevents favoritism and scoring bias.",
        "Input marks capped out of 100 with immediate grade assignment.",
        "Integrated acoustic stage bell with continuous rapid ringing and warning signals.",
        "Clean, focused workspace with no distractions or participant names.",
      ],
    },
    {
      title: "Stage Managers",
      icon: "monitor",
      tagline: "Live Floor Orchestration & Schedule Tracking",
      points: [
        "Live status pipeline: Reporting → Started → Finished.",
        "Satellite venue maps with draggable pins for judging tables, audio setups, and cameras.",
        "Conflict-free timetable viewer updated in real time across the festival grounds.",
        "One-touch reporting checklist generation.",
      ],
    },
    {
      title: "Team Managers",
      icon: "users",
      tagline: "Streamlined Team Rosters & Excel Bulk Add",
      points: [
        "Dedicated bottom taskbar for fast mobile navigation.",
        "Import dozens of participants instantly via Excel, CSV or raw text copy-paste.",
        "Scoped view: add and manage candidates strictly from their own assigned team.",
        "Excel-style formatted printable call sheets and team certificates.",
      ],
    },
    {
      title: "Monitors & Media",
      icon: "camera",
      tagline: "Independent Verification & Instant Result Releases",
      points: [
        "Audited verification step with tick stamp before results can be published.",
        "Exclusive media workspace to announce winners and runners-up.",
        "Multi-template poster generation with high-resolution export.",
        "Public scoreboard release gate to control when points go live.",
      ],
    },
    {
      title: "Participants & Parents",
      icon: "globe",
      tagline: "Personal Watch-Only Dashboard & Live Standing",
      points: [
        "Dedicated member dashboard displaying personal profile, code, and assigned programs.",
        "Real-time track of finished vs. non-started events.",
        "Official published grade scores and public championship leaderboard.",
        "Mobile-optimized bottom navigation with zero configuration needed.",
      ],
    },
  ];

  const faqs = [
    {
      q: "Can we run Festize completely offline during the festival?",
      a: "Yes! Festize is built as a single-file application with persistent offline storage. You can run all judging, scheduling, stage control, and ID card printing locally without an active internet connection. When connected, it syncs live to the cloud database.",
    },
    {
      q: "How does anonymous code-based judging work?",
      a: "When participants report to a stage, the system assigns randomized code letters (A, B, C...). Judges see and score only these code letters out of 100 — participant names and team affiliations remain strictly hidden until results are finalized.",
    },
    {
      q: "Can a student be accidentally scheduled in two programs at the same time?",
      a: "No. Festize features a built-in timetable conflict engine. If you attempt to schedule a program in an overlapping time slot with another program that shares even one mutual member, the system blocks the placement and names the clashing participant.",
    },
    {
      q: "How does multi-device cloud synchronization work?",
      a: "With Google Firebase Firestore integration enabled, every change made by judges, stage managers, or administrators syncs in real time across all logged-in phones, tablets, and laptops on the grounds.",
    },
    {
      q: "Can we print ID cards with 3 mm bleed and crop marks on standard A4 paper?",
      a: "Yes. The ID Card Designer allows you to choose standard event badge sizes (75×105 mm, CR80, or custom), upload custom 300 DPI templates, place participant QR codes and photos, and download ready-to-print multi-card A4 sheets with cutting marks.",
    },
  ];

  return (
    <div className="min-h-screen text-[var(--ink)] bg-[var(--bg)] selection:bg-[var(--marigold)] selection:text-black">
      {/* ---------------- 1. ANNOUNCEMENT BANNER ---------------- */}
      <div
        className="px-4 py-2 text-center text-[12px] font-extrabold flex items-center justify-center gap-2 border-b select-none"
        style={{
          background: "linear-gradient(90deg, var(--panel2), var(--panel3), var(--panel2))",
          borderColor: "var(--line)",
          color: "var(--marigold)",
        }}
      >
        <span className="w-2 h-2 rounded-full animate-ping bg-[var(--marigold)] shrink-0" />
        <span>FESTIZE 2.0 — School Arts & Cultural Fest Operating System</span>
        <span className="opacity-50 hidden sm:inline">|</span>
        <span className="text-[var(--mut)] hidden sm:inline">From 50 to 5,000+ Participants</span>
      </div>

      {/* ---------------- 2. NAVBAR ---------------- */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md border-b px-4 lg:px-8 py-3.5 flex items-center justify-between"
        style={{ background: "rgba(var(--bg), 0.85)", borderColor: "var(--line)" }}
      >
        {/* LOGO WITH 5-CLICK SECRET ACCESS */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLogoClick}
            className="group relative flex items-center gap-2.5 p-1 rounded-xl transition-all cursor-pointer focus:outline-none"
            title="Festize Platform"
            aria-label="Festize Brand Logo"
          >
            {/* Logo Wordmark */}
            <span
              className={`font-d text-[24px] font-black tracking-tighter transition-all ${
                unlocking
                  ? "scale-110 text-[var(--marigold)]"
                  : clickCount > 0
                  ? "scale-105 text-[var(--acc)]"
                  : "text-[var(--ink)] group-hover:text-[var(--marigold)]"
              }`}
            >
              festize
              <span style={{ color: "var(--marigold)" }}>.</span>
            </span>

            {/* Subtle click indicator for the 5-click secret gate */}
            {clickCount > 0 && clickCount < 5 && (
              <span className="flex items-center gap-1 pl-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full transition-all"
                    style={{
                      background: i < clickCount ? "var(--marigold)" : "var(--line2)",
                      transform: i < clickCount ? "scale(1.2)" : "scale(1)",
                    }}
                  />
                ))}
              </span>
            )}

            {unlocking && (
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--acc)] animate-pulse pl-1">
                Access Granted...
              </span>
            )}
          </button>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-[13px] font-bold text-[var(--mut)]">
          <a href="#features" className="hover:text-[var(--ink)] transition-colors">Features</a>
          <a href="#control-room" className="hover:text-[var(--ink)] transition-colors">Control Room</a>
          <a href="#workflow" className="hover:text-[var(--ink)] transition-colors">Workflow</a>
          <a href="#roles" className="hover:text-[var(--ink)] transition-colors">Roles</a>
          <a href="#pricing" className="hover:text-[var(--ink)] transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-[var(--ink)] transition-colors">FAQ</a>
        </nav>

        {/* Right Nav Utilities */}
        <div className="flex items-center gap-3">
          <ThemePicker theme={theme} setTheme={setTheme} />
          <button
            type="button"
            onClick={handleLogoClick}
            className="btn line sm hidden sm:inline-flex"
            title="Festival System"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--acc)] animate-pulse" />
            <span>Platform Live</span>
          </button>
        </div>
      </header>

      {/* ---------------- 3. HERO SECTION ---------------- */}
      <section className="relative overflow-hidden pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Glow ambient background */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[340px] rounded-full pointer-events-none opacity-20 blur-[100px]"
          style={{ background: "radial-gradient(circle, var(--marigold), var(--acc))" }}
        />

        <div className="text-center space-y-6 relative z-10 max-w-4xl mx-auto">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--line2)] bg-[var(--panel2)] shadow-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--marigold)]">
              ✦ School Arts & Cultural Fest Software
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="font-d text-[34px] sm:text-[48px] md:text-[58px] font-black leading-[1.08] tracking-tight text-[var(--ink)]">
            Run your fest without chasing{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--marigold) 0%, var(--coral) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              spreadsheets, score sheets
            </span>{" "}
            and stage updates.
          </h1>

          {/* Subtitle */}
          <p className="text-[15px] sm:text-[17px] font-semibold text-[var(--mut)] max-w-2xl mx-auto leading-relaxed">
            Set up participants and programs, keep stages moving, collect judges’ marks with zero bias, and publish approved results in one unified place. From 50 to 5,000 participants — run your festival with complete confidence.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => onExplore?.()}
              className="btn gold big shadow-xl cursor-pointer"
              style={{ paddingInline: 28 }}
            >
              <Icon n="sliders" s={18} />
              <span>Explore Platform</span>
            </button>
            <a
              href="#workflow"
              className="btn line big"
              style={{ paddingInline: 24 }}
            >
              <Icon n="play" s={16} />
              <span>How It Works</span>
            </a>
          </div>

          <div className="pt-2 text-[12px] font-bold text-[var(--mut)]">
            Evaluation is permanently free · Offline-first architecture · Instant real-time sync
          </div>
        </div>

        {/* ---------------- 4. INTERACTIVE CONTROL ROOM SHOWCASE ---------------- */}
        <div id="control-room" className="mt-14 relative z-10">
          <div className="card overflow-hidden shadow-2xl border-2 border-[var(--line2)] bg-[var(--panel)]">
            {/* Mock Control Window Header */}
            <div
              className="px-4 py-3 flex items-center justify-between border-b flex-wrap gap-2"
              style={{ background: "var(--panel2)", borderColor: "var(--line)" }}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
                <span className="font-mono text-[12px] font-bold text-[var(--mut)] ml-2">
                  festize://control-room/live-stages
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                  <Icon n="globe" s={12} /> Live Sync Active
                </span>
                <span className="tag" style={{ background: "var(--marigold-soft)", color: "var(--marigold)" }}>
                  3 Stages Running
                </span>
              </div>
            </div>

            {/* Mock Stage Floor Dashboard */}
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-d text-[16px] font-extrabold text-[var(--ink)]">
                    Live Stage Orchestration
                  </h3>
                  <p className="text-[12px] font-bold text-[var(--mut)]">
                    Real-time program pipeline synchronized across organizers, judges, and audience
                  </p>
                </div>
                <div className="flex gap-1.5 text-[11px] font-extrabold">
                  <span className="tag" style={{ background: "var(--sky)" + "22", color: "var(--sky)" }}>
                    14 Reporting
                  </span>
                  <span className="tag" style={{ background: "var(--marigold)" + "22", color: "var(--marigold)" }}>
                    3 On Stage
                  </span>
                  <span className="tag" style={{ background: "var(--acc)" + "22", color: "var(--acc)" }}>
                    28 Published
                  </span>
                </div>
              </div>

              {/* Sample Program Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Stage 1 */}
                <div className="card2 p-4 space-y-3 border-l-4" style={{ borderColor: "var(--marigold)" }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mut)] block">
                        STAGE 1 · MAIN ARENA
                      </span>
                      <h4 className="font-d text-[14px] font-extrabold text-[var(--ink)] mt-0.5">
                        Classical Solo Song
                      </h4>
                    </div>
                    <span className="tag st-STARTED">Started</span>
                  </div>
                  <div className="text-[12px] font-semibold text-[var(--mut)]">
                    Category: Senior · 18 Candidates
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-[12px] font-bold">
                    <span>Code Letter: <b className="mono text-[var(--coral)]">B</b></span>
                    <span className="text-[var(--marigold)]">On Stage Now</span>
                  </div>
                </div>

                {/* Stage 2 */}
                <div className="card2 p-4 space-y-3 border-l-4" style={{ borderColor: "var(--sky)" }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mut)] block">
                        STAGE 2 · AUDITORIUM
                      </span>
                      <h4 className="font-d text-[14px] font-extrabold text-[var(--ink)] mt-0.5">
                        Group Folk Dance
                      </h4>
                    </div>
                    <span className="tag st-REPORTING">Reporting</span>
                  </div>
                  <div className="text-[12px] font-semibold text-[var(--mut)]">
                    Category: General · 8 Teams (64 Members)
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-[12px] font-bold">
                    <span>Codes Verified: <b>8/8</b></span>
                    <span className="text-[var(--sky)]">Ready to Start</span>
                  </div>
                </div>

                {/* Stage 3 */}
                <div className="card2 p-4 space-y-3 border-l-4" style={{ borderColor: "var(--acc)" }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mut)] block">
                        STAGE 3 · HALL B
                      </span>
                      <h4 className="font-d text-[14px] font-extrabold text-[var(--ink)] mt-0.5">
                        Extempore Speech
                      </h4>
                    </div>
                    <span className="tag st-FINALYSED">Finalysed</span>
                  </div>
                  <div className="text-[12px] font-semibold text-[var(--mut)]">
                    Category: High School · 12 Candidates
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-[12px] font-bold">
                    <span>Monitor: <b>Checked ✓</b></span>
                    <span className="text-[var(--acc)]">Ready to Publish</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 5. THE PROBLEM ("Sound Familiar? 😫") ---------------- */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--coral)]">
            Stop Managing Your Festival with Spreadsheets
          </span>
          <h2 className="font-d text-[28px] sm:text-[36px] font-black">
            Sound Familiar? 😫
          </h2>
          <p className="text-[14.5px] font-semibold text-[var(--mut)]">
            Every year, hundreds of school fests suffer from the same preventable administrative nightmares.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5 space-y-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500 font-d text-[20px] font-black">
              ✕
            </div>
            <h3 className="font-d text-[15px] font-extrabold">Spreadsheet Chaos</h3>
            <p className="text-[12.5px] font-semibold text-[var(--mut)] leading-relaxed">
              Formulas break, sheets get accidentally overwritten, and nobody knows which version is the true final tally.
            </p>
          </div>

          <div className="card p-5 space-y-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-yellow-500/10 text-yellow-500 font-d text-[20px] font-black">
              ⚖
            </div>
            <h3 className="font-d text-[15px] font-extrabold">Score Disputes</h3>
            <p className="text-[12.5px] font-semibold text-[var(--mut)] leading-relaxed">
              When teams question a judgment, there is no verifiable digital audit trail showing individual judges’ marks.
            </p>
          </div>

          <div className="card p-5 space-y-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-500 font-d text-[20px] font-black">
              📱
            </div>
            <h3 className="font-d text-[15px] font-extrabold">WhatsApp Overload</h3>
            <p className="text-[12.5px] font-semibold text-[var(--mut)] leading-relaxed">
              Hundreds of frantic group messages, missed calls between stage managers, and lost result paper slips.
            </p>
          </div>

          <div className="card p-5 space-y-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-500 font-d text-[20px] font-black">
              ⏱
            </div>
            <h3 className="font-d text-[15px] font-extrabold">Valedictory Delays</h3>
            <p className="text-[12.5px] font-semibold text-[var(--mut)] leading-relaxed">
              Hours lost manually calculating championship points, typing winner posters, and handwriting certificates.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- 6. WORKFLOW PIPELINE ---------------- */}
      <section id="workflow" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--marigold)]">
            One Unified Command Center
          </span>
          <h2 className="font-d text-[28px] sm:text-[36px] font-black">
            Up and Running in 5 Seamless Steps 🎯
          </h2>
          <p className="text-[14.5px] font-semibold text-[var(--mut)]">
            Festize replaces fragmented tools with an end-to-end operational pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              step: "01",
              title: "Import & Roster",
              desc: "Paste rows or upload Excel sheets. Unique participant codes (#42@123) are generated automatically.",
            },
            {
              step: "02",
              title: "Program Rules",
              desc: "Configure events, category limits, individual vs group quotas, and specific grade point scales.",
            },
            {
              step: "03",
              title: "Stage & Timetable",
              desc: "Interactive schedule prevents student clashes across overlapping stages. Floor tracking moves in real time.",
            },
            {
              step: "04",
              title: "Blind Judging",
              desc: "Judges mark anonymous code letters only out of 100 with our integrated acoustic stage bell.",
            },
            {
              step: "05",
              title: "Instant Publish",
              desc: "Approved results generate result posters, live public championship leaderboards, and Excel call sheets.",
            },
          ].map((item, idx) => (
            <div key={idx} className="card p-4 space-y-2 relative border-t-2 border-t-[var(--acc)]">
              <span className="font-mono text-[18px] font-black text-[var(--acc)]">
                {item.step}
              </span>
              <h3 className="font-d text-[14px] font-extrabold">{item.title}</h3>
              <p className="text-[12px] font-semibold text-[var(--mut)] leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 7. COMPLETE FEATURE ECOSYSTEM ---------------- */}
      <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--acc)]">
            Engineered for Precision
          </span>
          <h2 className="font-d text-[28px] sm:text-[36px] font-black">
            Everything Your Festival Needs 🛠️
          </h2>
          <p className="text-[14.5px] font-semibold text-[var(--mut)]">
            Built from real ground experience managing state and district youth cultural festivals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Feature 1 */}
          <div className="card p-5 space-y-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--marigold-soft)] text-[var(--marigold)]">
              <Icon n="list" s={18} />
            </div>
            <h3 className="font-d text-[15px] font-extrabold">Program & Rule Engine</h3>
            <p className="text-[12.5px] font-semibold text-[var(--mut)] leading-relaxed">
              Support for individual and group competitions, category quotas, team member caps, and custom grade scales.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="card p-5 space-y-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--acc-soft)] text-[var(--acc)]">
              <Icon n="monitor" s={18} />
            </div>
            <h3 className="font-d text-[15px] font-extrabold">Stage Control & Timetable</h3>
            <p className="text-[12.5px] font-semibold text-[var(--mut)] leading-relaxed">
              Conflict-aware timetable with start and end times that strictly prevents any student from being scheduled simultaneously in two programs.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="card p-5 space-y-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--coral-soft)] text-[var(--coral)]">
              <Icon n="bell" s={18} />
            </div>
            <h3 className="font-d text-[15px] font-extrabold">Blind Judging & Stage Bell</h3>
            <p className="text-[12.5px] font-semibold text-[var(--mut)] leading-relaxed">
              Evaluators only see anonymous code letters. Features 14 realistic acoustic bell tones with continuous ringing and automated timer warning dings.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="card p-5 space-y-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--sky)]" style={{ background: "rgba(111, 195, 223, 0.15)" }}>
              <Icon n="idcard" s={18} />
            </div>
            <h3 className="font-d text-[15px] font-extrabold">ID Card & Badge Studio</h3>
            <p className="text-[12.5px] font-semibold text-[var(--mut)] leading-relaxed">
              Design festival passes with 300 DPI high-resolution export, custom bleed, 500+ fonts, participant QR codes, and A4 multi-card printable layouts.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="card p-5 space-y-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--plum)]" style={{ background: "rgba(212, 140, 192, 0.15)" }}>
              <Icon n="globe" s={18} />
            </div>
            <h3 className="font-d text-[15px] font-extrabold">Live Public Scoreboard</h3>
            <p className="text-[12.5px] font-semibold text-[var(--mut)] leading-relaxed">
              Share real-time team championship standing. Main administrators control exactly which published results release to the public board.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="card p-5 space-y-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--panel3)] text-[var(--ink)]">
              <Icon n="printer" s={18} />
            </div>
            <h3 className="font-d text-[15px] font-extrabold">Excel & PDF Call Sheets</h3>
            <p className="text-[12.5px] font-semibold text-[var(--mut)] leading-relaxed">
              Generate ready-to-print official Excel spreadsheets and PDF sheets with group combos, team rosters, and signature columns.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- 8. ROLES SHOWCASE ---------------- */}
      <section id="roles" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--marigold)]">
            Tailored User Experiences
          </span>
          <h2 className="font-d text-[28px] sm:text-[36px] font-black">
            Right Access for Every Crew Member 🔐
          </h2>
          <p className="text-[14.5px] font-semibold text-[var(--mut)]">
            Each role gets exactly the workspace and controls they need to do their job without confusion.
          </p>
        </div>

        {/* Role Selection Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {roles.map((r, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveRole(idx)}
              className={`px-3.5 py-2 rounded-xl text-[12.5px] font-extrabold flex items-center gap-2 border transition-all ${
                activeRole === idx
                  ? "bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)] shadow-md"
                  : "bg-[var(--panel2)] text-[var(--mut)] border-[var(--line)] hover:text-[var(--ink)]"
              }`}
            >
              <Icon n={r.icon} s={15} />
              <span>{r.title}</span>
            </button>
          ))}
        </div>

        {/* Active Role Content Card */}
        <div className="card p-6 md:p-8 space-y-5 max-w-3xl mx-auto border-2 border-[var(--line2)]">
          <div className="flex items-center gap-3">
            <span
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-[var(--acc)] font-bold"
              style={{ background: "var(--acc-soft)" }}
            >
              <Icon n={roles[activeRole].icon} s={24} />
            </span>
            <div>
              <h3 className="font-d text-[18px] font-black">{roles[activeRole].title}</h3>
              <p className="text-[12.5px] font-bold text-[var(--marigold)]">
                {roles[activeRole].tagline}
              </p>
            </div>
          </div>

          <div className="grid gap-2.5 pt-2">
            {roles[activeRole].points.map((point, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[13px] font-semibold">
                <span className="text-[var(--acc)] font-black">✓</span>
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 9. FESTIVAL EDITIONS & CONTACT ---------------- */}
      <section id="pricing" className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--acc)]">
            Simple & Transparent
          </span>
          <h2 className="font-d text-[28px] sm:text-[36px] font-black">
            Festival Editions 💰
          </h2>
          <p className="text-[14.5px] font-semibold text-[var(--mut)]">
            Choose the plan that fits your fest. Every plan includes all features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Plan 1: Standard */}
          <div className="card p-6 space-y-4 border-2 border-[var(--acc)] bg-[var(--panel)] flex flex-col justify-between relative shadow-lg">
            <div className="space-y-3">
              <span className="tag" style={{ background: "var(--acc-soft)", color: "var(--acc)", fontWeight: 800 }}>
                ★ Standard
              </span>
              <p className="font-d text-[14px] font-extrabold text-[var(--ink)] mt-1">
                For a small fest with many participants and programs.
              </p>
              <div className="divider my-2" />
              <div className="space-y-2.5 text-[12.5px] font-semibold text-[var(--ink)]">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--acc)] font-black text-[14px]">✓</span>
                  <span>Up to <b>200</b> participants</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--acc)] font-black text-[14px]">✓</span>
                  <span>Up to <b>10</b> teams</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--acc)] font-black text-[14px]">✓</span>
                  <span>Up to <b>40</b> programs</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--acc)] font-black text-[14px]">✓</span>
                  <span>Up to <b>4</b> stages</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--acc)] font-black text-[14px]">✓</span>
                  <span>Excel & PDF Reports + ID Cards</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="https://wa.me/qr/LP2C2F5XW77EN1"
                target="_blank"
                rel="noopener noreferrer"
                className="btn primary w-full"
              >
                Contact
              </a>
            </div>
          </div>

          {/* Plan 2: Full Fest */}
          <div className="card p-6 space-y-4 border-2 border-[var(--marigold)] bg-[var(--panel2)] flex flex-col justify-between relative shadow-xl">
            <div className="space-y-3">
              <span className="tag" style={{ background: "var(--marigold-soft)", color: "var(--marigold)", fontWeight: 800 }}>
                ★ Full Fest
              </span>
              <p className="font-d text-[14px] font-extrabold text-[var(--ink)] mt-1">
                For a full-size institutional fest with many participants and programs.
              </p>
              <div className="divider my-2" />
              <div className="space-y-2.5 text-[12.5px] font-semibold text-[var(--ink)]">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--marigold)] font-black text-[14px]">✓</span>
                  <span>Up to <b>500</b> participants</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--marigold)] font-black text-[14px]">✓</span>
                  <span>Up to <b>25</b> teams</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--marigold)] font-black text-[14px]">✓</span>
                  <span>Up to <b>100</b> programs</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--marigold)] font-black text-[14px]">✓</span>
                  <span>Real-time Cloud Sync across all devices</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--marigold)] font-black text-[14px]">✓</span>
                  <span>Priority Technical Support</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="https://wa.me/qr/LP2C2F5XW77EN1"
                target="_blank"
                rel="noopener noreferrer"
                className="btn gold w-full"
              >
                Contact
              </a>
            </div>
          </div>

          {/* Plan 3: Custom */}
          <div className="card p-6 space-y-4 border-2 border-[var(--plum)] bg-[var(--panel)] flex flex-col justify-between relative shadow-lg">
            <div className="space-y-3">
              <span className="tag" style={{ background: "var(--plum)" + "1f", color: "var(--plum)", fontWeight: 800 }}>
                ★ Custom
              </span>
              <p className="font-d text-[14px] font-extrabold text-[var(--ink)] mt-1">
                For an event whose size or requirements do not fit the standard plans.
              </p>
              <div className="divider my-2" />
              <div className="space-y-2.5 text-[12.5px] font-semibold text-[var(--ink)]">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--plum)] font-black text-[14px]">✓</span>
                  <span><b>Limitless</b> participants</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--plum)] font-black text-[14px]">✓</span>
                  <span><b>Limitless</b> teams</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--plum)] font-black text-[14px]">✓</span>
                  <span><b>Limitless</b> programs</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--plum)] font-black text-[14px]">✓</span>
                  <span>Real-time Cloud Sync across all devices</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--plum)] font-black text-[14px]">✓</span>
                  <span>Bespoke setup tailored to your event</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="https://wa.me/qr/LP2C2F5XW77EN1"
                target="_blank"
                rel="noopener noreferrer"
                className="btn w-full"
                style={{ background: "var(--plum)", color: "white", boxShadow: "0 4px 14px var(--plum)" }}
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 10. FAQ SECTION ---------------- */}
      <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--marigold)]">
            Questions & Answers
          </span>
          <h2 className="font-d text-[28px] sm:text-[34px] font-black">
            Frequently Asked Questions 💡
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <div
                key={i}
                className="card overflow-hidden border border-[var(--line2)] transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full p-4 text-left font-d text-[14.5px] font-extrabold flex items-center justify-between gap-3"
                >
                  <span>{faq.q}</span>
                  <span className="text-[18px] text-[var(--marigold)] shrink-0">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-[13px] font-semibold text-[var(--mut)] leading-relaxed border-t border-[var(--line)]">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------- 11. HAVE A FEST? (FINAL CALL TO ACTION) ---------------- */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-[var(--line)]">
        <div className="card p-8 sm:p-10 text-center space-y-4 shadow-xl border-2 border-[var(--marigold)]">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: "var(--marigold-soft)", color: "var(--marigold)" }}
          >
            <Icon n="key" s={26} />
          </div>
          <h2 className="font-d text-[24px] sm:text-[30px] font-black">
            Already have a fest code? 🎟️
          </h2>
          <p className="text-[14px] font-semibold text-[var(--mut)] max-w-xl mx-auto">
            Type the fest code your admin shared to jump straight into your fest's login — on any device.
          </p>
          <div>
            <button
              type="button"
              onClick={() => onHaveFest?.()}
              className="btn primary big shadow-xl cursor-pointer"
              style={{ paddingInline: 30 }}
            >
              <Icon n="key" s={16} />
              <span>Have a fest?</span>
            </button>
          </div>
        </div>
      </section>

      {/* ---------------- 12. FOOTER ---------------- */}
      <footer className="border-t border-[var(--line)] py-12 px-4 lg:px-8 bg-[var(--panel)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1">
            <button
              type="button"
              onClick={handleLogoClick}
              className="font-d text-[22px] font-black tracking-tight text-[var(--ink)] hover:text-[var(--marigold)] transition-colors cursor-pointer"
            >
              festize<span style={{ color: "var(--marigold)" }}>.</span>
            </button>
            <p className="text-[12px] font-semibold text-[var(--mut)]">
              The complete operating system for school, college & cultural festivals.
            </p>
          </div>

          <div className="text-[12px] font-bold text-[var(--mut)] space-y-1">
            <div>© 2026 Festize Platform · Built for Festival Organizers</div>
            <div className="text-[11px] opacity-70">
              Single-file portable deployment · Fast, reliable and auditable
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
