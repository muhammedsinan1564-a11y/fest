import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Copy, LockKeyhole, Plus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthLayout, Landing, PasswordInput } from "./Landing";
import { Button, Field, IconButton, Modal, Toast } from "./ui";
import { createDemoFest, emptyData, id, makeFestCode, randomPassword, username, type Fest, type FestData, type UserRecord } from "./types";
import { cloudEnabled, createCloudFest, deleteCloudFest, getAdminFests, loadOfflineFests, loginAdmin, loginFest, provisionUser, saveCloudFest, saveOfflineFests, supabase, watchFest } from "./lib/persistence";
import Workspace from "./Workspace";

type Screen = "landing" | "admin-login" | "admin" | "join" | "fest-login" | "workspace";

const ADMIN_KEY = "SINAN610CM321";
const allLogins = (fest: Fest): UserRecord[] => [
  ...fest.mainUsers,
  ...fest.data.users,
  ...fest.data.members.map(member => ({ id: member.id, name: member.name, password: member.code, role: "MEMBER" as const, memberId: member.id, teamId: member.teamId })),
];

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [fests, setFests] = useState<Fest[]>(() => cloudEnabled ? [] : loadOfflineFests());
  const [activeFest, setActiveFest] = useState<Fest | null>(null);
  const activeRef = useRef<Fest | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const leavingRef = useRef(false);
  const deepLinkRef = useRef(false);
  const [session, setSession] = useState<UserRecord | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [festCode, setFestCode] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingFest, setEditingFest] = useState<Fest | null>(null);
  const [festName, setFestName] = useState("");
  const [festDate, setFestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mainCount, setMainCount] = useState("1");
  const [freshCredentials, setFreshCredentials] = useState<UserRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [demoSwitch, setDemoSwitch] = useState(false);

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 3600); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!cloudEnabled || !activeFest || activeFest.demo || screen !== "workspace") return;
    return watchFest(activeFest.id, data => {
      const current = activeRef.current;
      if (!current) return;
      const users = data.users.map(user => ({ ...user, password: user.password || current.data.users.find(item => item.id === user.id)?.password || "" }));
      const next = { ...current, data: { ...data, users } };
      activeRef.current = next; setActiveFest(next);
    });
  }, [activeFest?.id, activeFest?.demo, screen]);

  useEffect(() => {
    if (deepLinkRef.current) return;
    deepLinkRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("fest"); const name = params.get("u"); const pass = params.get("c");
    if (!code || !name) return;
    window.history.replaceState({}, "", window.location.pathname);
    setFestCode(code.toUpperCase()); setLoginName(name); setLoginPassword(pass || ""); setDemoSwitch(false); setScreen("fest-login");
    if (pass) void runLogin(code, name, pass);
    // The scanned link only prefills the sign-in, so the credential is still verified.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFests = (next: Fest[]) => { setFests(next); if (!cloudEnabled) saveOfflineFests(next); };
  const notify = (message: string) => setToast(message);
  const startExplore = () => {
    let demo: Fest;
    try { demo = JSON.parse(localStorage.getItem("festize-explore-v2") || "null") || createDemoFest(); }
    catch { demo = createDemoFest(); }
    activeRef.current = demo; setActiveFest(demo); setSession(demo.mainUsers[0]); setDemoSwitch(false); setScreen("workspace"); notify("Welcome to the Festize explore workspace");
  };
  const enterFest = (fest: Fest, user: UserRecord) => { activeRef.current = fest; setActiveFest(fest); setSession(user); setScreen("workspace"); setLoginName(""); setLoginPassword(""); notify(`Welcome back, ${user.name}`); };

  const submitAdmin = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true);
    try {
      if (cloudEnabled) { await loginAdmin(adminPassword); updateFests(await getAdminFests()); }
      else if (adminPassword !== "ADMIN999") throw new Error("That administrator password is not correct.");
      setAdminPassword(""); setScreen("admin"); notify("Administrator access granted");
    } catch (error) { notify(error instanceof Error ? error.message : "Sign in failed"); }
    finally { setBusy(false); }
  };

  const enterAdmin = async () => {
    if (busy) return;
    if (!cloudEnabled) { setScreen("admin"); notify("Administrator access granted"); return; }
    setBusy(true);
    try {
      // The secret code doubles as the Supabase password for the administrator account.
      await loginAdmin(ADMIN_KEY);
      updateFests(await getAdminFests());
      setScreen("admin"); notify("Administrator access granted");
    } catch {
      setScreen("admin-login"); notify("Enter your administrator password to continue.");
    } finally { setBusy(false); }
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    const code = festCode.trim().toUpperCase();
    if (!code) return;
    if (code === ADMIN_KEY) { setFestCode(""); void enterAdmin(); return; }
    if (!cloudEnabled && !fests.some(fest => fest.code.toUpperCase() === code) && !demoSwitch) { notify("We could not find a fest with that code on this device."); return; }
    setFestCode(code); setScreen("fest-login");
  };

  const runLogin = async (code: string, name: string, password: string, demo = false) => {
    if (busy) return;
    setBusy(true);
    try {
      if (demo) {
        const sample = activeRef.current?.demo ? activeRef.current : createDemoFest();
        const user = allLogins(sample).find(item => item.name.toLowerCase() === name.trim().toLowerCase() && item.password === password);
        if (!user) throw new Error("Invalid username or password.");
        enterFest(sample, user);
      } else if (cloudEnabled) {
        const { fest, user } = await loginFest(code.trim(), name.trim(), password);
        enterFest(fest, user);
      } else {
        const fest = fests.find(item => item.code.toUpperCase() === code.trim().toUpperCase());
        if (!fest) throw new Error("Fest not found.");
        const user = allLogins(fest).find(item => item.name.toLowerCase() === name.trim().toLowerCase() && item.password === password);
        if (!user) throw new Error("Invalid username or password.");
        enterFest(fest, user);
      }
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to sign in"); }
    finally { setBusy(false); }
  };

  const submitFestLogin = async (event: FormEvent) => {
    event.preventDefault();
    await runLogin(festCode, loginName, loginPassword, demoSwitch);
  };

  const saveFestForm = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !festName.trim()) return;
    setBusy(true);
    try {
      if (editingFest) {
        const next = { ...editingFest, name: festName.trim(), date: festDate };
        if (cloudEnabled) await saveCloudFest(next, true);
        updateFests(fests.map(fest => fest.id === next.id ? next : fest));
        notify("Fest details updated");
      } else {
        const count = Number(mainCount);
        if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error("Choose between 1 and 20 main users.");
        const date = festDate;
        const used = new Set<string>();
        const mainUsers: UserRecord[] = Array.from({ length: count }, () => {
          let name = username(); while (used.has(name)) name = username(); used.add(name);
          return { id: id(), name, password: randomPassword(), role: "MAIN" };
        });
        let code = makeFestCode(festName.trim(), date);
        while (fests.some(fest => fest.code === code)) code = makeFestCode(festName.trim(), date);
        const next: Fest = { id: id(), name: festName.trim(), code, date, ownerId: "offline-admin", mainUsers, data: emptyData() };
        const saved = cloudEnabled ? await createCloudFest(next) : next;
        updateFests([saved, ...fests]); setFreshCredentials(mainUsers); notify("Your fest is ready");
      }
      setShowCreate(false); setEditingFest(null); setFestName(""); setMainCount("1");
    } catch (error) { notify(error instanceof Error ? error.message : "Could not save fest"); }
    finally { setBusy(false); }
  };

  const deleteFest = async (fest: Fest) => {
    if (!window.confirm(`Delete ${fest.name} and EVERYTHING inside it? This cannot be undone.`)) return;
    try { if (cloudEnabled) await deleteCloudFest(fest.id); updateFests(fests.filter(item => item.id !== fest.id)); notify("Fest deleted"); }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to delete fest"); }
  };

  const changeData = (updater: (data: FestData) => FestData, activity?: string) => {
    const current = activeRef.current;
    if (!current) return;
    let data = updater(structuredClone(current.data));
    if (activity && session) data = { ...data, activity: [{ id: id(), text: activity, at: new Date().toISOString(), userId: session.id }, ...data.activity].slice(0, 100) };
    const next = { ...current, data };
    activeRef.current = next; setActiveFest(next);
    if (next.demo) localStorage.setItem("festize-explore-v2", JSON.stringify(next));
    else if (cloudEnabled) saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveCloudFest(next)).catch(error => notify(`Sync failed: ${error instanceof Error ? error.message : "Please retry"}`));
    else setFests(previous => { const updated = previous.map(fest => fest.id === next.id ? next : fest); saveOfflineFests(updated); return updated; });
  };

  const provision = async (user: UserRecord, action: "create" | "update" | "revoke" = "create") => {
    const current = activeRef.current;
    if (!cloudEnabled || !current || current.demo) return;
    try { await provisionUser(current.id, current.code, user, action); }
    catch (error) { notify(`User saved, but cloud account sync needs attention: ${error instanceof Error ? error.message : "request failed"}`); }
  };

  const leaveWorkspace = (toHome = false) => {
    if (leavingRef.current) return;
    if (!window.confirm(toHome ? "Return to the main home page? Your changes have been saved." : "Return to the login screen? Your changes have been saved.")) return;
    leavingRef.current = true;
    void (async () => {
      try {
        await saveQueue.current;
        if (cloudEnabled) await supabase?.auth.signOut();
        if (toHome || activeRef.current?.demo) { setScreen("landing"); setDemoSwitch(false); }
        else { setFestCode(activeRef.current?.code || ""); setScreen("fest-login"); }
        setSession(null); setActiveFest(null); activeRef.current = null;
      } catch (error) { notify(error instanceof Error ? error.message : "Could not finish signing out"); }
      finally { leavingRef.current = false; }
    })();
  };
  const logout = () => {
    const current = activeRef.current;
    if (current?.demo && session?.role !== "MAIN") { setSession(current.mainUsers[0]); notify("Switched back to MAIN69"); return; }
    leaveWorkspace(false);
  };
  const switchDemoUser = () => {
    if (!activeRef.current?.demo) return;
    setDemoSwitch(true); setFestCode(activeRef.current.code); setLoginName(""); setLoginPassword(""); setScreen("fest-login");
  };

  return <>
    <AnimatePresence mode="wait">
      {screen === "landing" && <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Landing onExplore={startExplore} onJoin={() => { setDemoSwitch(false); setFestCode(""); setScreen("join"); }} /></motion.div>}
      {screen === "admin-login" && <AuthLayout key="admin-login" onBack={() => setScreen("landing")} eyebrow="ADMINISTRATOR ACCESS" title="Behind every great fest." description="Enter your administrator password to manage your fests."><form onSubmit={submitAdmin} className="auth-form"><Field label="Password"><PasswordInput value={adminPassword} onChange={setAdminPassword} /></Field><Button type="submit" disabled={busy} className="auth-submit">{busy ? "Checking..." : "Enter control room"}<ArrowRight size={17} /></Button></form>{!cloudEnabled && <p className="auth-note">Offline preview mode. Add Supabase credentials to enable cross-device sync.</p>}</AuthLayout>}
      {screen === "join" && <AuthLayout key="join" onBack={() => setScreen("landing")} eyebrow="YOUR FEST AWAITS" title="Have a fest code?" description="Enter the unique code shared by your fest administrator."><form onSubmit={submitCode} className="auth-form"><Field label="Fest code"><input autoFocus required value={festCode} onChange={event => setFestCode(event.target.value.toUpperCase())} placeholder="Enter your fest code" /></Field><Button type="submit" className="auth-submit">Continue <ArrowRight size={17} /></Button></form><p className="auth-note">Scanning a participant QR code brings you straight here, already signed in.</p></AuthLayout>}
      {screen === "fest-login" && <AuthLayout key="fest-login" onBack={() => setScreen(demoSwitch ? "workspace" : "join")} eyebrow="WELCOME BACK" title="Step into your fest." description="Sign in with the username and password given to you."><form onSubmit={submitFestLogin} className="auth-form"><Field label="Username"><input autoFocus required value={loginName} onChange={event => setLoginName(event.target.value)} placeholder="Username" /></Field><Field label="Password"><PasswordInput value={loginPassword} onChange={setLoginPassword} /></Field><Button type="submit" disabled={busy} className="auth-submit">{busy ? "Signing in..." : "Enter workspace"}<ArrowRight size={17} /></Button></form>{demoSwitch && <p className="auth-note">Explore credentials: MAIN69 / DEMO999, JUDGE21 / JUDGE123, MANAGER07 / TEAM123. You can also use users you add.</p>}</AuthLayout>}
      {screen === "admin" && <div key="admin" className="admin-screen"><header className="admin-header"><button className="wordmark small" onClick={() => setScreen("landing")}>festize<span>.</span></button><div><span className="admin-label"><LockKeyhole size={15} /> ADMIN SPACE</span><button className="admin-exit" onClick={() => { if (cloudEnabled) void supabase?.auth.signOut(); setScreen("landing"); notify("Signed out of admin space"); }}>Sign out <ArrowRight size={16} /></button></div></header><main className="admin-main"><button className="back-inline" onClick={() => setScreen("landing")}><ArrowLeft size={16} /> Back to home</button><div className="admin-intro"><div><span className="eyebrow">YOUR CONTROL ROOM</span><h1>Your fests<span>.</span></h1><p>One home for every event you bring to life.</p></div><Button icon={<Plus size={18} />} onClick={() => { setEditingFest(null); setFestName(""); setFestDate(new Date().toISOString().slice(0, 10)); setShowCreate(true); }}>Create a fest</Button></div>{!cloudEnabled && <div className="offline-notice"><Sparkles size={18} /><span>This preview saves to this browser only. Configure Supabase for cross-device workspaces.</span></div>}
        {fests.length ? <div className="fest-list">{fests.map((fest, index) => <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }} key={fest.id} className="fest-row"><div className="fest-index">{String(index + 1).padStart(2, "0")}</div><div className="fest-row-main"><h2>{fest.name}</h2><div className="fest-code-line"><span>FEST CODE</span><strong>{fest.code}</strong><button aria-label={`Copy code for ${fest.name}`} onClick={() => { void navigator.clipboard.writeText(fest.code); notify("Fest code copied"); }}><Copy size={14} /></button><span>{fest.date}</span></div><div className="credential-list">{fest.mainUsers.map(user => <div key={user.id}><span>{user.name}</span><span>{user.password || "Password set at creation"}</span>{user.password && <button aria-label={`Copy password for ${user.name}`} onClick={() => { void navigator.clipboard.writeText(user.password); notify("Password copied"); }}><Copy size={13} /></button>}</div>)}</div></div><div className="fest-row-actions"><button className="open-fest" onClick={() => { setDemoSwitch(false); setFestCode(fest.code); setScreen("fest-login"); }}>Open fest <ArrowRight size={18} /></button><div><button onClick={() => { setEditingFest(fest); setFestName(fest.name); setFestDate(fest.date); setShowCreate(true); }}>Edit</button><button className="danger-text" onClick={() => void deleteFest(fest)}>Delete</button></div></div></motion.article>)}</div> : <div className="admin-empty"><span>01</span><h2>A new fest starts here.</h2><p>Create a fest, share its code and main-user credentials, and let the good things begin.</p><Button icon={<Plus size={17} />} onClick={() => setShowCreate(true)}>Create your first fest</Button></div>}
      </main></div>}
      {screen === "workspace" && activeFest && session && <Workspace key={activeFest.id + session.id} fest={activeFest} user={session} onChange={changeData} onProvision={provision} onBack={() => leaveWorkspace(true)} onLogout={logout} onChangeUser={activeFest.demo ? switchDemoUser : undefined} notify={notify} />}
    </AnimatePresence>
    {showCreate && <Modal title={editingFest ? "Edit fest" : "Create a fest"} subtitle="The beginning of something memorable." onClose={() => { setShowCreate(false); setEditingFest(null); }}><form onSubmit={saveFestForm} className="form-stack"><Field label="Fest name"><input required autoFocus value={festName} onChange={event => setFestName(event.target.value)} placeholder="e.g. Aurora Arts Festival" /></Field><Field label="Fest date"><input required type="date" value={festDate} onChange={event => setFestDate(event.target.value)} /></Field>{!editingFest && <Field label="Number of main users"><input required type="number" min="1" max="20" value={mainCount} onChange={event => setMainCount(event.target.value)} /></Field>}<div className="form-actions"><Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setEditingFest(null); }}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Confirm"} <ArrowRight size={16} /></Button></div></form></Modal>}
    {freshCredentials.length > 0 && <Modal title="Your main users are ready" subtitle="Copy these credentials now and share them securely with your team." onClose={() => setFreshCredentials([])}><div className="new-credentials">{freshCredentials.map(user => <div key={user.id}><div><strong>{user.name}</strong><span>{user.password}</span></div><IconButton label={`Copy credentials for ${user.name}`} onClick={() => { void navigator.clipboard.writeText(`${user.name} / ${user.password}`); notify("Credentials copied"); }}><Copy size={17} /></IconButton></div>)}</div><Button className="w-full mt-6" onClick={() => setFreshCredentials([])}>Done <Check size={17} /></Button></Modal>}
    <Toast message={toast} onDismiss={() => setToast("")} />
  </>;
}
