import React, { useEffect, useMemo, useState } from "react";
import { useStore, log } from "../lib/store";
import type { Role } from "../lib/store";
import { Icon, IconBtn, ThemePicker, useToast, useAsk } from "../lib/ui";
import { Dashboard, RandomPicker, RandomLetter, TeamMarks, PublicScores, TopCandidates } from "./Misc";
import { TeamsSection, CategoriesSection, MembersSection, AccessSection, GradesSection } from "./Manage";
import { ProgramsSection, ProgramControl, StageControl } from "./Programs";
import { CodeLetterSection, CodeLetterDetail, JudgementSection, JudgementDetail, MonitorSection, MonitorDetail, MediaSection } from "./Judging";
import { StagesSection, StageDetail } from "./Stages";
import { PrintoutsHub, PrintTeams, PrintTeamPage, PrintCats, PrintCatPage, PrintReportCats, PrintReportProgs, PrintReportPage } from "./Printouts";
import { IdCardSection } from "./IdCard";
import { PostersSection, PosterEditor, ResultsSection, ResultDetail } from "./Posters";
import { ScheduleSection } from "./Schedule";
import { SettingsSection } from "./Settings";
import { BellSection } from "./Bell";

export interface Route { id: string; params?: Record<string, string>; }
type Push = (r: Route) => void;

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  group?: string;
}

const MENU: Record<Role, MenuItem[]> = {
  MAIN: [
    // Overview
    { id: "dashboard", label: "Dashboard", icon: "grid", group: "Overview" },
    { id: "publicScores", label: "Public Team Scores", icon: "globe", group: "Overview" },
    { id: "top", label: "Top Candidates", icon: "star", group: "Overview" },

    // Organization
    { id: "access", label: "Access Control", icon: "key", group: "Organization" },
    { id: "teams", label: "Teams", icon: "flag", group: "Organization" },
    { id: "members", label: "Members", icon: "users", group: "Organization" },
    { id: "categories", label: "Categories", icon: "tag", group: "Organization" },

    // Competitions & Evaluation
    { id: "programs", label: "Programs", icon: "list", group: "Competitions" },
    { id: "programControl", label: "Program Control", icon: "sliders", group: "Competitions" },
    { id: "codeLetter", label: "Code Letter Entry", icon: "mail", group: "Competitions" },
    { id: "judgement", label: "Judgement", icon: "scale", group: "Competitions" },
    { id: "bell", label: "Judge Bell", icon: "bell", group: "Competitions" },
    { id: "grades", label: "Grade Points", icon: "award", group: "Competitions" },

    // Venue & Schedule
    { id: "stages", label: "Stages", icon: "image", group: "Venue & Schedule" },
    { id: "stageControl", label: "Stage Control", icon: "monitor", group: "Venue & Schedule" },
    { id: "schedule", label: "Schedule", icon: "calendar", group: "Venue & Schedule" },

    // Results & Media
    { id: "monitor", label: "Monitor", icon: "eye", group: "Results & Media" },
    { id: "media", label: "Media", icon: "camera", group: "Results & Media" },
    { id: "results", label: "Results", icon: "trophy", group: "Results & Media" },
    { id: "teamMarks", label: "Team Marks", icon: "bar", group: "Results & Media" },

    // Designs & Printouts
    { id: "idcard", label: "ID Card Setup", icon: "idcard", group: "Designs & Printouts" },
    { id: "posters", label: "Poster Templates", icon: "palette", group: "Designs & Printouts" },
    { id: "printouts", label: "Printouts", icon: "printer", group: "Designs & Printouts" },

    // System & Tools
    { id: "random", label: "Random Picker", icon: "shuffle", group: "System" },
    { id: "settings", label: "Settings", icon: "settings", group: "System" },
  ],
  JUDGE: [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "judgement", label: "Judgement", icon: "scale" },
    { id: "bell", label: "Bell", icon: "bell" },
    { id: "random", label: "Random Picker", icon: "shuffle" },
    { id: "publicScores", label: "Public Team Scores", icon: "globe" },
  ],
  MEDIA: [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "monitor", label: "Monitor", icon: "eye" },
    { id: "media", label: "Media", icon: "camera" },
    { id: "posters", label: "Poster Templates", icon: "palette" },
    { id: "results", label: "Results", icon: "trophy" },
    { id: "publicScores", label: "Public Team Scores", icon: "globe" },
  ],
  "TEAM MANAGER": [
    { id: "members", label: "Members", icon: "users" },
    { id: "programs", label: "Programs", icon: "list" },
    { id: "printouts", label: "Printouts", icon: "printer" },
  ],
  MONITOR: [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "stageControl", label: "Stage Control", icon: "monitor" },
    { id: "schedule", label: "Schedule", icon: "calendar" },
    { id: "codeLetter", label: "Code Letter Entry", icon: "mail" },
    { id: "monitor", label: "Monitor", icon: "eye" },
    { id: "random", label: "Random Picker", icon: "shuffle" },
    { id: "randomLetter", label: "Random Letter", icon: "text" },
    { id: "publicScores", label: "Public Team Scores", icon: "globe" },
    { id: "printouts", label: "Printouts", icon: "printer" },
  ],
  "STAGE MANAGER": [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "stages", label: "Stages", icon: "image" },
    { id: "stageControl", label: "Stage Control", icon: "monitor" },
    { id: "schedule", label: "Schedule", icon: "calendar" },
    { id: "programControl", label: "Program Control", icon: "sliders" },
    { id: "random", label: "Random Picker", icon: "shuffle" },
  ],
  MEMBER: [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "results", label: "Results", icon: "trophy" },
    { id: "publicScores", label: "Public Team Scores", icon: "globe" },
  ],
};

const TITLES: Record<string, string> = {
  dashboard: "Dashboard", access: "Access Control", teams: "Teams", members: "Members",
  categories: "Categories", programs: "Programs", programControl: "Program Control",
  stages: "Stages", stageDetail: "Stage Map", stageControl: "Stage Control", schedule: "Schedule",
  teamMarks: "Team Marks", grades: "Grade Points", idcard: "ID Card Setup",
  printouts: "Printouts", printTeams: "Teams", printTeam: "Team Sheet", printCats: "Categories",
  printCat: "Category Sheet", printReportCats: "Reporting List", printReportProgs: "Programs", printReport: "Reporting Sheet",
  codeLetter: "Code Letter Entry", codeLetterDetail: "Code Letters",
  judgement: "Judgement", judgementDetail: "Mark Entry",
  bell: "Judge Bell",
  monitor: "Monitor", monitorDetail: "Result Check", media: "Media",
  results: "Results", resultDetail: "Result Poster",
  publicScores: "Public Team Scores", random: "Random Picker", randomLetter: "Random Letter",
  posters: "Poster Templates", posterEditor: "Template Editor", top: "Top Candidates", settings: "Settings",
};

const defaultRoute = (role: Role): Route =>
  role === "TEAM MANAGER" ? { id: "members" } : { id: "dashboard" };

export default function Shell({ onExit }: { onExit: () => void }) {
  const { fest, session, data, updateFest, theme, setTheme, logout } = useStore();
  const toast = useToast();
  const ask = useAsk();
  const [stack, setStack] = useState<Route[]>(() => [defaultRoute(session?.role || "MAIN")]);
  const [drawer, setDrawer] = useState(false);
  const route = stack[stack.length - 1];

  const menu = useMemo(() => MENU[session?.role || "MAIN"], [session]);
  const hasBottomBar = session?.role === "MEMBER" || session?.role === "TEAM MANAGER";
  const push: Push = (r) => { setStack((s) => [...s, r]); setDrawer(false); };
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const goto = (id: string) => { setStack([{ id }]); setDrawer(false); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "[" && !hasBottomBar && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) setDrawer((d) => !d);
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [hasBottomBar]);

  // schedule notifications — fires once when a scheduled slot's time arrives
  useEffect(() => {
    if (!fest || !data) return;
    const key = `festize.notified.${fest.id}`;
    const notified = new Set<string>(JSON.parse(localStorage.getItem(key) || "[]"));
    const check = () => {
      const now = Date.now();
      for (const slot of data.scheduleSlots) {
        if (notified.has(slot.id)) continue;
        const t = new Date(`${slot.date}T${slot.time || "00:00"}`).getTime();
        if (isNaN(t) || now < t || now - t > 120000) continue;
        const items = data.stages
          .map((s) => ({ stage: s.name, pid: data.schedule[`${s.id}__${slot.id}`] }))
          .filter((x) => x.pid)
          .map((x) => `${data.programs.find((p) => p.id === x.pid)?.name || "Program"} @ ${x.stage}`);
        notified.add(slot.id);
        localStorage.setItem(key, JSON.stringify([...notified]));
        if (items.length) toast(`⏰ Now due — ${items.join(" · ")}`, "info");
      }
    };
    check();
    const iv = setInterval(check, 20000);
    return () => clearInterval(iv);
  }, [fest, data, toast]);

  if (!fest || !session || !data) return null;

  const activeId = menu.some((m) => m.id === route.id) ? route.id : menu[0].id;

  const back = async () => {
    if (stack.length > 1) { pop(); return; }
    const ok = await ask({ title: "Leave this fest?", body: "You will return to the login screen.", yes: "Leave" });
    if (!ok) return;
    updateFest(fest.id, (d) => log(d, session.name, "Logged out"));
    logout();
    onExit();
  };
  const doLogout = async () => {
    const ok = await ask({ title: "Log out?", body: `${session.name} will be signed out of ${fest.name}.`, yes: "Log out" });
    if (!ok) return;
    updateFest(fest.id, (d) => log(d, session.name, "Logged out"));
    logout();
    toast("Logged out", "ok");
    onExit();
  };

  const render = () => {
    const p = { push, params: route.params, back: pop };
    switch (route.id) {
      case "dashboard": return <Dashboard {...p} />;
      case "access": return <AccessSection {...p} />;
      case "teams": return <TeamsSection {...p} />;
      case "members": return <MembersSection {...p} />;
      case "categories": return <CategoriesSection {...p} />;
      case "programs": return <ProgramsSection {...p} />;
      case "programControl": return <ProgramControl {...p} />;
      case "stages": return <StagesSection {...p} />;
      case "stageDetail": return <StageDetail {...p} />;
      case "stageControl": return <StageControl {...p} />;
      case "schedule": return <ScheduleSection {...p} />;
      case "teamMarks": return <TeamMarks {...p} />;
      case "grades": return <GradesSection {...p} />;
      case "idcard": return <IdCardSection {...p} />;
      case "printouts": return <PrintoutsHub {...p} />;
      case "printTeams": return <PrintTeams {...p} />;
      case "printTeam": return <PrintTeamPage {...p} />;
      case "printCats": return <PrintCats {...p} />;
      case "printCat": return <PrintCatPage {...p} />;
      case "printReportCats": return <PrintReportCats {...p} />;
      case "printReportProgs": return <PrintReportProgs {...p} />;
      case "printReport": return <PrintReportPage {...p} />;
      case "codeLetter": return <CodeLetterSection {...p} />;
      case "codeLetterDetail": return <CodeLetterDetail {...p} />;
      case "judgement": return <JudgementSection {...p} />;
      case "judgementDetail": return <JudgementDetail {...p} />;
      case "bell": return <BellSection {...p} />;

      case "monitor": return <MonitorSection {...p} />;
      case "media": return <MediaSection {...p} />;
      case "monitorDetail": return <MonitorDetail {...p} />;
      case "results": return <ResultsSection {...p} />;
      case "resultDetail": return <ResultDetail {...p} />;
      case "publicScores": return <PublicScores {...p} />;
      case "random": return <RandomPicker {...p} />;
      case "randomLetter": return <RandomLetter {...p} />;
      case "posters": return <PostersSection {...p} />;
      case "posterEditor": return <PosterEditor {...p} />;
      case "top": return <TopCandidates {...p} />;
      case "settings": return <SettingsSection {...p} />;
      default: return <Dashboard {...p} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* topbar */}
      <header className="sticky top-0 z-40 flex items-center gap-2 px-3.5 py-2.5" style={{ background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
        <IconBtn n="back" title="Back" onClick={back} />
        {!hasBottomBar && (
          <button className="icobtn" onClick={() => setDrawer(true)} title="Menu ( [ )" aria-label="Open menu">
            <Icon n="menu" s={19} />
          </button>
        )}
        <div className="text-[13.5px] md:text-[14.5px] font-extrabold truncate ml-1" style={{ fontFamily: '"Courier Prime", "Courier New", monospace' }}>
          <span style={{ color: "var(--marigold)" }}>{fest.name}</span>
          <span className="mx-2 opacity-40">/</span>
          <span key={route.id} className="pop inline-block">{TITLES[route.id] || route.id}</span>
        </div>
        <div className="flex-1" />
        {fest.isEvaluation && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold" style={{ background: "var(--marigold-soft)", color: "var(--marigold)", border: "1px solid var(--marigold)" }} title="Evaluation/Demo Plan: max 2 teams, 3 categories, 20 members, 5 programs, 5 users">
            <span>⚡ Evaluation Plan</span>
            <span className="opacity-70 font-mono text-[10px]">({data.teams.length}/2 T · {data.categories.length}/3 C · {data.members.length}/20 M · {data.programs.length}/5 P · {data.accessUsers.length}/5 U)</span>
          </div>
        )}
        <div className="hidden sm:flex items-center gap-2.5 pl-3.5 pr-4 py-1.5 rounded-full" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11.5px] font-extrabold" style={{ background: "var(--acc-soft)", color: "var(--acc)", fontFamily: '"Courier Prime", "Courier New", monospace' }}>
            {session.name.slice(0, 2).toUpperCase()}
          </span>
          <span>
            <span className="block text-[12.5px] font-extrabold leading-tight mono">{session.name}</span>
            <span className="block text-[9.5px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>{session.role}</span>
          </span>
        </div>
        <ThemePicker theme={theme} setTheme={setTheme} />
        <IconBtn n="logout" title="Logout" danger onClick={doLogout} />
      </header>

      {/* Fixed bottom task bar for MEMBER and TEAM MANAGER roles */}
      {hasBottomBar && (
        <nav
          className="fixed bottom-0 inset-x-0 z-50 shadow-2xl"
          style={{
            background: "var(--panel)",
            borderTop: "1px solid var(--line)",
            paddingBottom: "env(safe-area-inset-bottom)",
            fontFamily: '"Courier Prime", "Courier New", monospace',
          }}
        >
          <div className="flex items-center w-full max-w-[540px] mx-auto h-[62px]">
            {menu.map((m) => {
              const on = activeId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => goto(m.id)}
                  className="flex-1 flex flex-col items-center justify-center h-full transition-all relative cursor-pointer select-none px-1"
                  style={{
                    color: on ? "var(--acc)" : "var(--mut)",
                  }}
                >
                  {on && (
                    <span
                      className="absolute top-0 inset-x-5 h-[3px] rounded-b-full transition-all"
                      style={{ background: "var(--acc)" }}
                    />
                  )}
                  <span className="transition-transform" style={{ transform: on ? "scale(1.08)" : "scale(1)" }}>
                    <Icon n={m.icon} s={20} sw={on ? 2.4 : 1.8} />
                  </span>
                  <span
                    className="text-[11px] font-extrabold mt-1 tracking-tight leading-none truncate w-full text-center"
                    style={{
                      color: on ? "var(--ink)" : "var(--mut)",
                    }}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* drawer (only for roles without bottom bar) */}
      {drawer && !hasBottomBar && <div className="fixed inset-0 z-[60] fade-in" style={{ background: "#060a0899" }} onMouseDown={() => setDrawer(false)} />}
      {!hasBottomBar && (
        <aside className="fixed top-0 bottom-0 left-0 z-[70] w-[276px] flex flex-col transition-transform duration-300"
          style={{ background: "var(--panel)", borderRight: "1px solid var(--line)", transform: drawer ? "translateX(0)" : "translateX(-105%)", transitionTimingFunction: "cubic-bezier(0.2,0.9,0.3,1)" }}>
          <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
            <div>
              <div className="text-[15px] font-black leading-tight" style={{ fontFamily: '"Courier Prime", "Courier New", monospace' }}>{fest.name}</div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] mt-1" style={{ color: "var(--mut)", fontFamily: '"Courier Prime", monospace' }}>{session.role} menu</div>
            </div>
            <IconBtn n="x" title="Close menu" onClick={() => setDrawer(false)} />
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" style={{ fontFamily: '"Courier Prime", "Courier New", monospace' }}>
            {menu.map((m, i) => {
              const showHeading = m.group && (i === 0 || menu[i - 1]?.group !== m.group);
              return (
                <React.Fragment key={m.id}>
                  {showHeading && (
                    <div className="text-[10.5px] font-black uppercase tracking-[0.16em] px-3 pt-3.5 pb-1" style={{ color: "var(--marigold)", fontFamily: '"Courier Prime", monospace' }}>
                      {m.group}
                    </div>
                  )}
                  <button className={`side-item side-in ${activeId === m.id ? "on" : ""}`}
                    style={{ animationDelay: i * 20 + "ms", fontFamily: '"Courier Prime", "Courier New", monospace' }}
                    onClick={() => goto(m.id)}>
                    <span key={activeId === m.id ? m.id + "-on" : m.id} className={activeId === m.id ? "pop" : ""}><Icon n={m.icon} s={17} /></span>
                    {m.label}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
          <div className="px-4 py-3.5 text-[10.5px] font-bold" style={{ borderTop: "1px solid var(--line)", color: "var(--mut)" }}>
            <span className="kbd">[</span> menu &nbsp;·&nbsp; <span className="kbd">Esc</span> close &nbsp;·&nbsp; <span className="kbd">/</span> search
          </div>
        </aside>
      )}

      {/* content */}
      <main className={`flex-1 w-full max-w-[1020px] mx-auto px-4 md:px-6 py-6 ${hasBottomBar ? "pb-24" : ""}`}>
        <div key={route.id + JSON.stringify(route.params || {})} className="anim-in">
          {render()}
        </div>
      </main>
    </div>
  );
}
