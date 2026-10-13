import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowLeft, Award, BarChart3, Bell, CalendarDays, ChevronRight, Clapperboard, ClipboardList, Dices, FileText, Gavel, IdCard, Image, Layers, LayoutDashboard, LogOut, MapPin, Megaphone, Moon, MoreHorizontal, Printer, Settings, ShieldCheck, Sparkles, Sun, Trophy, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IconButton } from "./ui";
import ThemePicker from "./ThemePicker";
import { type Fest, type FestData, type Section, type UserRecord } from "./types";
import { AccessSection, CategoriesSection, GradePointsSection, MembersSection, StagesSection, TeamsSection } from "./sections/Setup";
import { ProgramsSection } from "./sections/Programs";
import { CodeLetterSection, ControlSection, JudgementSection, MonitorSection } from "./sections/Operations";
import { BellSection, RandomSection } from "./sections/Tools";
import { ScheduleAdvanced } from "./sections/ScheduleAdvanced";
import { DashboardSection, PublicScoresSection, ResultsSection, SettingsSection, TeamMarksSection, TopCandidatesSection } from "./sections/Insights";
import { IDCardSection, PosterTemplatesSection } from "./sections/Designer";
import { PrintoutsSection } from "./sections/Printouts";
import type { SectionProps } from "./sections/common";

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
  Dashboard: LayoutDashboard, "Access Control": ShieldCheck, Teams: Users, Members: UserRound, Categories: Layers,
  Programs: Clapperboard, "Program Control": Activity, Stages: MapPin, "Stage Control": Activity, Schedule: CalendarDays,
  Judgement: Gavel, "Team Marks": Trophy, "Grade Points": Award, "ID Card Setup": IdCard, Printouts: Printer,
  "Code Letter Entry": FileText, Results: Trophy, "Public Team Scores": BarChart3, "Random Picker": Dices,
  "Random Letter": Dices, "Poster Templates": Image, "Top Candidates": Award, Monitor: ClipboardList,
  Media: Megaphone, Bell, Settings,
};

const MAIN_GROUPS: { label: string; items: Section[] }[] = [
  { label: "OVERVIEW", items: ["Dashboard"] },
  { label: "PEOPLE & SETUP", items: ["Access Control", "Teams", "Members", "Categories", "Programs", "Grade Points"] },
  { label: "LIVE FEST", items: ["Program Control", "Stages", "Stage Control", "Schedule", "Code Letter Entry", "Judgement"] },
  { label: "RESULTS", items: ["Monitor", "Media", "Results", "Public Team Scores", "Team Marks", "Top Candidates"] },
  { label: "CREATE & SHARE", items: ["Poster Templates", "ID Card Setup", "Printouts"] },
  { label: "TOOLS", items: ["Random Picker", "Bell", "Settings"] },
];

const ROLE_GROUPS: Record<string, { label: string; items: Section[] }[]> = {
  JUDGE: [{ label: "YOUR SPACE", items: ["Dashboard", "Judgement", "Bell", "Results"] }],
  MONITOR: [{ label: "YOUR SPACE", items: ["Dashboard", "Stage Control", "Code Letter Entry", "Monitor", "Public Team Scores", "Printouts", "Random Picker", "Random Letter"] }],
  MEDIA: [{ label: "YOUR SPACE", items: ["Dashboard", "Monitor", "Media", "Results", "Poster Templates"] }],
  "STAGE MANAGER": [{ label: "YOUR SPACE", items: ["Dashboard", "Stage Control", "Stages", "Schedule", "Bell"] }],
};

const TAB_GROUPS: Record<string, Section[]> = {
  "TEAM MANAGER": ["Dashboard", "Members", "Programs", "Printouts"],
  MEMBER: ["Dashboard", "Results", "Public Team Scores"],
};

export default function Workspace({ fest, user, onChange, onProvision, onBack, onLogout, onChangeUser, notify }: WorkspaceProps) {
  const [section, setSection] = useState<Section>("Dashboard"); const [menuOpen, setMenuOpen] = useState(false);
  const [personalAppearance, setPersonalAppearance] = useState<{ dark?: boolean }>({});
  const alerted = useRef(new Set<string>());
  const settings = fest.data.settings;
  const currentDark = user.role === "MAIN" ? settings.dark : personalAppearance.dark ?? settings.dark;
  const tabbed = user.role === "TEAM MANAGER" || user.role === "MEMBER";
  const groups = user.role === "MAIN" ? MAIN_GROUPS : ROLE_GROUPS[user.role] || MAIN_GROUPS;
  const tabs = TAB_GROUPS[user.role] || [];
  const navigate = (next: Section) => { setSection(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const props: SectionProps = { fest, user, onChange, onProvision, notify, navigate };
  const setAppearance = (patch: Partial<typeof settings>) => {
    if (user.role !== "MAIN") { setPersonalAppearance(previous => ({ ...previous, ...patch })); return; }
    onChange(data => ({ ...data, settings: { ...data.settings, ...patch } }), "Changed workspace appearance");
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", close);
    const timer = setTimeout(() => document.querySelector<HTMLElement>(".nav-drawer .nav-item.active")?.focus(), 50);
    return () => { clearTimeout(timer); document.removeEventListener("keydown", close); };
  }, [menuOpen]);

  useEffect(() => {
    const check = () => {
      const now = new Date(); const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      fest.data.schedule.forEach(cell => {
        const slot = fest.data.slots.find(item => item.id === cell.slotId);
        if (!slot || slot.date !== date || slot.start !== time || alerted.current.has(cell.id)) return;
        alerted.current.add(cell.id);
        notify(`Scheduled now: ${fest.data.programs.find(program => program.id === cell.programId)?.name || "Program"}`);
      });
    };
    check(); const interval = setInterval(check, 30000); return () => clearInterval(interval);
  }, [fest.data.schedule, fest.data.slots, fest.data.programs, notify]);

  const renderSection = () => {
    switch (section) {
      case "Dashboard": return <DashboardSection {...props} />;
      case "Access Control": return <AccessSection {...props} />;
      case "Teams": return <TeamsSection {...props} />;
      case "Members": return <MembersSection {...props} />;
      case "Categories": return <CategoriesSection {...props} />;
      case "Programs": return <ProgramsSection {...props} />;
      case "Program Control": return <ControlSection {...props} />;
      case "Stages": return <StagesSection {...props} />;
      case "Stage Control": return <ControlSection {...props} stageOnly />;
      case "Schedule": return <ScheduleAdvanced {...props} />;
      case "Judgement": return <JudgementSection {...props} />;
      case "Team Marks": return <TeamMarksSection {...props} />;
      case "Grade Points": return <GradePointsSection {...props} />;
      case "ID Card Setup": return <IDCardSection {...props} />;
      case "Printouts": return <PrintoutsSection {...props} />;
      case "Code Letter Entry": return <CodeLetterSection {...props} />;
      case "Results": return <ResultsSection {...props} />;
      case "Public Team Scores": return <PublicScoresSection {...props} />;
      case "Random Picker": return <RandomSection />;
      case "Random Letter": return <RandomSection letter />;
      case "Poster Templates": return <PosterTemplatesSection {...props} />;
      case "Top Candidates": return <TopCandidatesSection {...props} />;
      case "Monitor": return <MonitorSection {...props} />;
      case "Media": return <MonitorSection {...props} mediaOnly />;
      case "Bell": return <BellSection {...props} />;
      case "Settings": return <SettingsSection {...props} />;
    }
  };

  // Colours come from the site-wide theme; the fest only controls its typography.
  const style = { "--body-font": `"${settings.font}", monospace`, "--heading-font": `"${settings.headingFont}", Georgia, serif` } as CSSProperties;

  return <div className={`workspace ${currentDark ? "" : "theme-light"} ${tabbed ? "has-bottom-tabs" : ""}`} style={style}>
    <header className="workspace-header"><div className="header-left"><IconButton label="Back to home" onClick={onBack}><ArrowLeft size={19} /></IconButton>{!tabbed && <IconButton label="Open menu" onClick={() => setMenuOpen(true)}><MoreHorizontal size={24} /></IconButton>}<span className="header-divider" /><div className="header-fest"><strong>{fest.name}</strong><span>{fest.demo ? "EXPLORE WORKSPACE" : "FEST WORKSPACE"}</span></div></div>
      {onChangeUser && <button className="change-user" onClick={onChangeUser}><Sparkles size={15} /> Change user <ChevronRight size={16} /></button>}
      <div className="header-right"><ThemePicker compact /><IconButton label={currentDark ? "Use light theme" : "Use dark theme"} onClick={() => setAppearance({ dark: !currentDark })}>{currentDark ? <Sun size={18} /> : <Moon size={18} />}</IconButton><span className="header-divider right-divider" /><div className="user-chip"><span>{user.name.charAt(0)}</span><div><strong>{user.name}</strong><small>{user.role === "MAIN" ? "Main user" : user.role.toLowerCase()}</small></div></div><IconButton label="Log out" onClick={onLogout}><LogOut size={18} /></IconButton></div>
    </header>

    <AnimatePresence>{menuOpen && !tabbed && <><motion.div className="nav-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} /><motion.aside className="nav-drawer" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 360, damping: 36 }}><div className="nav-drawer-head"><div><span className="nav-drawer-kicker">YOUR WORKSPACE</span><h2>{fest.name}</h2></div><IconButton label="Close menu" onClick={() => setMenuOpen(false)}><X size={20} /></IconButton></div><div className="nav-scroll">{groups.map(group => <div className="nav-group" key={group.label}><span className="nav-group-label">{group.label}</span>{group.items.map(item => { const Icon = ICONS[item]; return <button className={`nav-item ${section === item ? "active" : ""}`} key={item} onClick={() => navigate(item)}>{section === item && <motion.span layoutId="active-nav" className="nav-active-bg" transition={{ type: "spring", stiffness: 410, damping: 34 }} />}<Icon size={17} strokeWidth={1.8} /><span>{item}</span>{section === item && <ChevronRight size={15} />}</button>; })}</div>)}</div><div className="nav-drawer-bottom"><button onClick={onLogout}><LogOut size={17} /> Logout</button><span>MAKE IT MEMORABLE.</span></div></motion.aside></>}</AnimatePresence>

    <main className="workspace-main"><motion.div key={section} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }} className="workspace-content">{renderSection()}</motion.div></main>

    {tabbed && <nav className="bottom-tabs" aria-label="Main navigation">{tabs.map(item => { const Icon = ICONS[item]; return <button key={item} onClick={() => navigate(item)} className={section === item ? "active" : ""}>{section === item && <motion.span layoutId="active-tab" className="tab-active-line" />}<Icon size={20} strokeWidth={1.8} /><span>{item === "Public Team Scores" ? "Scores" : item}</span></button>; })}</nav>}
  </div>;
}

