import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Award,
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  Clapperboard,
  ClipboardList,
  Dices,
  FileText,
  Gavel,
  IdCard,
  Image,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Megaphone,
  MessageSquareText,
  Moon,
  MoreHorizontal,
  Printer,
  Radio,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  Trophy,
  UserRound,
  Users,
  Vote,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { IconButton } from "./ui";
import ThemePicker from "./ThemePicker";
import { type Fest, type FestData, type Section, type UserRecord } from "./types";
import {
  AccessSection,
  CategoriesSection,
  GradePointsSection,
  MembersSection,
  StagesSection,
  TeamsSection,
} from "./sections/Setup";
import { ProgramsSection } from "./sections/Programs";
import {
  CodeLetterSection,
  ControlSection,
  JudgementSection,
  MonitorSection,
} from "./sections/Operations";
import { BellSection, RandomSection } from "./sections/Tools";
import { ScheduleAdvanced } from "./sections/ScheduleAdvanced";
import {
  DashboardSection,
  PublicScoresSection,
  ResultsSection,
  SettingsSection,
  TeamMarksSection,
  TopCandidatesSection,
} from "./sections/Insights";
import { IDCardSection, PosterTemplatesSection } from "./sections/designer";
import { PrintoutsSection } from "./sections/Printouts";
import { StopwatchSection } from "./sections/Stopwatch";
import { HighlightsSection } from "./sections/Highlights";
import {
  MemberQuizSection,
  QuizAnswersSection,
  QuizBuilderSection,
  QuizPointsSection,
  QuizPublishSection,
} from "./sections/Quiz";
import { PredictionSection } from "./sections/Prediction";
import type { SectionProps } from "./sections/common";
import { loadFonts } from "./lib/fonts";
import { readTheme, SITE_THEMES, waveThemeChange } from "./lib/theme";

interface WorkspaceProps {
  fest: Fest;
  user: UserRecord;
  onChange: (updater: (data: FestData) => FestData, activity?: string) => void;
  onProvision: (user: UserRecord, action?: "create" | "update" | "revoke") => Promise<void>;
  onBack: () => void;
  onLogout: () => void;
  onChangeUser?: () => void;
  notify: (message: string) => void;
}

const ICONS: Record<Section, LucideIcon> = {
  Dashboard: LayoutDashboard,
  "Access Control": ShieldCheck,
  Teams: Users,
  Members: UserRound,
  Categories: Layers,
  Programs: Clapperboard,
  "Program Control": Activity,
  Stages: MapPin,
  "Stage Control": Activity,
  Schedule: CalendarDays,
  Judgement: Gavel,
  "Team Marks": Trophy,
  "Grade Points": Award,
  "ID Card Setup": IdCard,
  Printouts: Printer,
  "Code Letter Entry": FileText,
  Results: Trophy,
  "Public Team Scores": BarChart3,
  "Random Picker": Dices,
  Stopwatch: Timer,
  "Poster Templates": Image,
  "Top Candidates": Award,
  Monitor: ClipboardList,
  Media: Megaphone,
  Highlights: Radio,
  Prediction: Vote,
  Quiz: BookOpenCheck,
  "Quiz Builder": ListChecks,
  "Quiz Points": Trophy,
  "Quiz Answers": MessageSquareText,
  "Publish Result": Send,
  Bell: Bell,
  Settings: Settings,
};

const MAIN_GROUPS: Array<{ label: string; items: Section[] }> = [
  { label: "OVERVIEW", items: ["Dashboard"] },
  { label: "PEOPLE & SETUP", items: ["Access Control", "Teams", "Members", "Categories", "Programs", "Grade Points"] },
  { label: "LIVE FEST", items: ["Program Control", "Stages", "Stage Control", "Schedule", "Code Letter Entry", "Judgement"] },
  { label: "RESULTS", items: ["Monitor", "Media", "Results", "Public Team Scores", "Team Marks", "Top Candidates"] },
  { label: "CREATE & SHARE", items: ["Poster Templates", "ID Card Setup", "Printouts"] },
  { label: "TOOLS", items: ["Prediction", "Random Picker", "Bell", "Settings"] },
];

const ROLE_GROUPS: Record<string, Array<{ label: string; items: Section[] }>> = {
  JUDGE: [{ label: "YOUR SPACE", items: ["Dashboard", "Judgement", "Stopwatch", "Bell"] }],
  MONITOR: [
    {
      label: "YOUR SPACE",
      items: ["Dashboard", "Stage Control", "Code Letter Entry", "Monitor", "Stopwatch", "Public Team Scores", "Printouts", "Random Picker"],
    },
  ],
  MEDIA: [
    { label: "YOUR SPACE", items: ["Dashboard", "Highlights", "Monitor", "Media", "Results", "Public Team Scores", "ID Card Setup", "Poster Templates", "Settings"] },
  ],
  "STAGE MANAGER": [{ label: "YOUR SPACE", items: ["Dashboard", "Stage Control", "Stages", "Schedule", "Bell"] }],
};

const TAB_GROUPS: Record<string, Section[]> = {
  "TEAM MANAGER": ["Dashboard", "Members", "Programs", "Printouts"],
  MEMBER: ["Dashboard", "Highlights", "Quiz", "Results", "Public Team Scores"],
  "PUBLIC RESULT": ["Results", "Highlights", "Public Team Scores"],
  "QUIZ MASTER": ["Quiz Builder", "Quiz Points", "Quiz Answers", "Publish Result"],
};

const ACCENT_HEX: Record<string, { dark: string; light: string }> = {
  gold: { dark: "#f59e0b", light: "#b45309" },
  mint: { dark: "#34d399", light: "#059669" },
  peach: { dark: "#f0a37b", light: "#c2410c" },
  lilac: { dark: "#c084fc", light: "#7c3aed" },
  blue: { dark: "#38bdf8", light: "#0284c7" },
  rose: { dark: "#fb7185", light: "#e11d48" },
};

export default function Workspace({
  fest,
  user,
  onChange,
  onProvision,
  onBack,
  onLogout,
  onChangeUser,
  notify,
}: WorkspaceProps) {
  const homeSection: Section =
    user.role === "PUBLIC RESULT" ? "Results" : user.role === "QUIZ MASTER" ? "Quiz Builder" : "Dashboard";
  const [section, setSection] = useState<Section>(() => {
    try {
      const saved = localStorage.getItem(`festize-section:${fest.id}:${user.id}`) as Section | null;
      return saved ?? homeSection;
    } catch {
      return homeSection;
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [personalAppearance, setPersonalAppearance] = useState<{ dark?: boolean }>({});
  const alerted = useRef(new Set<string>());
  const historyRef = useRef<Section[]>(section === homeSection ? [homeSection] : [homeSection, section]);
  const sectionRef = useRef<Section>(section);
  sectionRef.current = section;

  const settings = fest.data.settings;
  const currentDark = user.role === "MAIN" ? settings.dark : (personalAppearance.dark ?? settings.dark);
  const festTheme = fest.data.settings.theme;
  // A fest's palette affects that fest only: applied on entry, device theme restored on exit.
  useEffect(() => {
    if (!festTheme) return;
    const previous = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = festTheme;
    return () => {
      document.documentElement.dataset.theme = previous ?? readTheme();
    };
  }, [festTheme]);
  // Sync light/dark mode on documentElement so modals, menus and scrollbars match too.
  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", !currentDark);
    return () => {
      document.documentElement.classList.remove("theme-light");
    };
  }, [currentDark]);

  const darkThemeColor =
    SITE_THEMES.find((theme) => theme.id === (festTheme ?? readTheme()))?.swatch[0] || "#0e0c0b";
  const tabbed =
    user.role === "TEAM MANAGER" || user.role === "MEMBER" || user.role === "PUBLIC RESULT" || user.role === "QUIZ MASTER";
  const publicShell = user.role === "PUBLIC RESULT";
  const groups = user.role === "MAIN" ? MAIN_GROUPS : ROLE_GROUPS[user.role] || MAIN_GROUPS;
  const tabs = TAB_GROUPS[user.role] || [];
  const atHome = section === homeSection;

  const setAndRemember = (next: Section) => {
    setSection(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      localStorage.setItem(`festize-section:${fest.id}:${user.id}`, next);
    } catch {
      /* storage unavailable */
    }
  };

  const navigate = (next: Section) => {
    if (next !== sectionRef.current) {
      const stack = historyRef.current;
      if (stack[stack.length - 1] !== next) stack.push(next);
      try {
        window.history.pushState({ festizeSection: next }, "");
      } catch {
        /* history unavailable */
      }
    }
    setAndRemember(next);
  };

  /**
   * Back button rule: leaving/logging out from the fest is only possible from
   * Dashboard (or a role's home screen). From any other section, Back goes to
   * the previous section instead.
   */
  const goBack = () => {
    if (sectionRef.current === homeSection) {
      onBack();
      return;
    }
    const stack = historyRef.current;
    if (stack.length > 1) stack.pop();
    const previous = stack[stack.length - 1] ?? homeSection;
    setAndRemember(previous);
  };

  // Intercept browser/device back + Alt+ArrowLeft so users step through sections before exiting.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    try {
      window.history.pushState({ festizeGuard: true }, "");
    } catch {
      /* history unavailable */
    }
    const onPop = () => {
      if (sectionRef.current !== homeSection) {
        const stack = historyRef.current;
        if (stack.length > 1) stack.pop();
        setAndRemember(stack[stack.length - 1] ?? homeSection);
        try {
          window.history.pushState({ festizeGuard: true }, "");
        } catch {
          /* ignore */
        }
      } else {
        onBackRef.current();
        try {
          window.history.pushState({ festizeGuard: true }, "");
        } catch {
          /* ignore */
        }
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        if (sectionRef.current === homeSection) onBackRef.current();
        else {
          const stack = historyRef.current;
          if (stack.length > 1) stack.pop();
          setAndRemember(stack[stack.length - 1] ?? homeSection);
        }
      }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeSection]);

  const props: SectionProps = { fest, user, onChange, onProvision, notify, navigate };

  useEffect(() => {
    loadFonts([settings.font, settings.headingFont]);
  }, [settings.font, settings.headingFont]);

  const setAppearance = (patch: Partial<typeof settings>) => {
    if (user.role !== "MAIN") {
      setPersonalAppearance((previous) => ({ ...previous, ...patch }));
      return;
    }
    onChange((data) => ({ ...data, settings: { ...data.settings, ...patch } }), "Changed workspace appearance");
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", close);
    const timer = setTimeout(() => document.querySelector<HTMLElement>(".nav-drawer .nav-item.active")?.focus(), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  // Live schedule alerts: nudge the crew the moment a placement begins.
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      fest.data.schedule.forEach((cell) => {
        const slot = fest.data.slots.find((item) => item.id === cell.slotId);
        if (!slot || slot.date !== date || slot.start !== time || alerted.current.has(cell.id)) return;
        alerted.current.add(cell.id);
        notify(`Scheduled now: ${fest.data.programs.find((program) => program.id === cell.programId)?.name || "Program"}`);
      });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [fest.data.schedule, fest.data.slots, fest.data.programs, notify]);

  const renderSection = () => {
    switch (section) {
      case "Dashboard":
        return <DashboardSection {...props} />;
      case "Access Control":
        return <AccessSection {...props} />;
      case "Teams":
        return <TeamsSection {...props} />;
      case "Members":
        return <MembersSection {...props} />;
      case "Categories":
        return <CategoriesSection {...props} />;
      case "Programs":
        return <ProgramsSection {...props} />;
      case "Program Control":
        return <ControlSection {...props} />;
      case "Stages":
        return <StagesSection {...props} />;
      case "Stage Control":
        return <ControlSection stageOnly {...props} />;
      case "Schedule":
        return <ScheduleAdvanced {...props} />;
      case "Judgement":
        return <JudgementSection {...props} />;
      case "Team Marks":
        return <TeamMarksSection {...props} />;
      case "Grade Points":
        return <GradePointsSection {...props} />;
      case "ID Card Setup":
        return <IDCardSection {...props} />;
      case "Printouts":
        return <PrintoutsSection {...props} />;
      case "Code Letter Entry":
        return <CodeLetterSection {...props} />;
      case "Results":
        return <ResultsSection {...props} />;
      case "Public Team Scores":
        return <PublicScoresSection {...props} />;
      case "Random Picker":
        return <RandomSection />;
      case "Poster Templates":
        return <PosterTemplatesSection {...props} />;
      case "Top Candidates":
        return <TopCandidatesSection {...props} />;
      case "Monitor":
        return <MonitorSection {...props} />;
      case "Media":
        return <MonitorSection mediaOnly {...props} />;
      case "Bell":
        return <BellSection {...props} />;
      case "Stopwatch":
        return <StopwatchSection {...props} />;
      case "Highlights":
        return <HighlightsSection {...props} />;
      case "Prediction":
        return <PredictionSection {...props} />;
      case "Quiz":
        return <MemberQuizSection {...props} />;
      case "Quiz Builder":
        return <QuizBuilderSection {...props} />;
      case "Quiz Points":
        return <QuizPointsSection {...props} />;
      case "Quiz Answers":
        return <QuizAnswersSection {...props} />;
      case "Publish Result":
        return <QuizPublishSection {...props} />;
      case "Settings":
        return <SettingsSection {...props} />;
      default:
        return <DashboardSection {...props} />;
    }
  };

  const accentPair = settings.accent && settings.accent !== "theme" ? ACCENT_HEX[settings.accent] : undefined;
  const accentHex = accentPair ? (currentDark ? accentPair.dark : accentPair.light) : undefined;
  const style = {
    "--body-font": `"${settings.font}", monospace`,
    "--heading-font": `"${settings.headingFont}", Georgia, serif`,
    "--fest-logo-bg": fest.data.festLogo ? `url(${JSON.stringify(fest.data.festLogo)})` : "none",
    ...(accentHex
      ? {
          "--fz-accent": accentHex,
          "--fz-accent-fg": currentDark ? "#16130f" : "#ffffff",
          "--fz-accent-soft": `color-mix(in srgb, ${accentHex} 14%, transparent)`,
        }
      : {}),
  } as CSSProperties;

  return (
    <div
      className={`workspace ${currentDark ? "" : "theme-light"} ${tabbed ? "has-bottom-tabs" : ""} ${
        publicShell ? "public-result-shell no-top-shell" : ""
      }`}
      style={style}
    >
      <a className="skip-link" href="#workspace-main">Skip to content</a>
      {fest.data.festLogo && <div className="fest-global-watermark" aria-hidden="true" />}

      {!publicShell && (
        <header className="workspace-header">
          <div className="header-left">
            <IconButton label={atHome ? "Back to home" : "Previous section"} onClick={goBack}>
              <ArrowLeft size={19} />
            </IconButton>
            {!tabbed && (
              <IconButton label="Open menu" onClick={() => setMenuOpen(true)}>
                <MoreHorizontal size={24} />
              </IconButton>
            )}
            <span className="header-divider" />
            <div className="header-fest">
              <strong>{fest.name}</strong>
              <span>{fest.demo ? "EXPLORE WORKSPACE" : "FEST WORKSPACE"}</span>
            </div>
          </div>

          {onChangeUser && (
            <button type="button" className="change-user" onClick={onChangeUser}>
              <Sparkles size={15} /> Change user <ChevronRight size={16} />
            </button>
          )}

          <div className="header-right">
            <ThemePicker compact />
            <IconButton
              label={currentDark ? "Use light theme" : "Use dark theme"}
              onClick={(event) =>
                waveThemeChange(
                  event.currentTarget,
                  () => flushSync(() => setAppearance({ dark: !currentDark })),
                  currentDark ? "#f7f4ee" : darkThemeColor
                )
              }
            >
              {currentDark ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
            <span className="header-divider right-divider" />
            {user.role === "MAIN" ? (
              <button type="button" className="user-chip user-chip-link" onClick={() => navigate("Settings")} title="Open settings">
                <span>{user.name.charAt(0)}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>Main user · open settings</small>
                </div>
              </button>
            ) : (
              <div className="user-chip">
                <span>{user.name.charAt(0)}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.role.toLowerCase()}</small>
                </div>
              </div>
            )}
            <IconButton label="Log out" onClick={onLogout}>
              <LogOut size={18} />
            </IconButton>
          </div>
        </header>
      )}

      <AnimatePresence>
        {menuOpen && !tabbed && (
          <>
            <motion.div
              className="nav-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              className="nav-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
            >
              <div className="nav-drawer-head">
                <div>
                  <span className="nav-drawer-kicker">YOUR WORKSPACE</span>
                  <h2>{fest.name}</h2>
                </div>
                <IconButton label="Close menu" onClick={() => setMenuOpen(false)}>
                  <X size={20} />
                </IconButton>
              </div>
              <div className="nav-scroll">
                {groups.map((group) => (
                  <div className="nav-group" key={group.label}>
                    <span className="nav-group-label">{group.label}</span>
                    {group.items.map((item) => {
                      const Icon = ICONS[item];
                      return (
                        <button type="button" className={`nav-item ${section === item ? "active" : ""}`} key={item} onClick={() => navigate(item)}>
                          {section === item && (
                            <motion.span layoutId="active-nav" className="nav-active-bg" transition={{ type: "spring", stiffness: 410, damping: 34 }} />
                          )}
                          <Icon size={17} strokeWidth={1.8} />
                          <span>{item}</span>
                          {section === item && <ChevronRight size={15} />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="nav-drawer-bottom">
                <button type="button" onClick={onLogout}>
                  <LogOut size={17} /> Logout
                </button>
                <span>MAKE IT MEMORABLE.</span>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main id="workspace-main" className="workspace-main" tabIndex={-1}>
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="workspace-content"
        >
          {renderSection()}
        </motion.div>
      </main>

      {tabbed && (
        <nav
          className="bottom-tabs"
          role="tablist"
          aria-label="Main navigation"
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const currentIdx = tabs.indexOf(section);
            const nextIdx = (currentIdx + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            navigate(tabs[nextIdx]);
          }}
        >
          {tabs.map((item) => {
            const Icon = ICONS[item];
            return (
              <button
                type="button"
                role="tab"
                aria-selected={section === item}
                key={item}
                onClick={() => navigate(item)}
                className={section === item ? "active" : ""}
              >
                {section === item && <motion.span layoutId="active-tab" className="tab-active-line" />}
                <Icon size={20} strokeWidth={1.8} />
                <span>{item === "Public Team Scores" ? "Scores" : item}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
