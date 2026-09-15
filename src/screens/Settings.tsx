import { useState } from "react";
import { useStore, log, defaultGradeScales } from "../lib/store";
import { Icon, Btn, Field, Modal, Empty, PageHead, Dots, THEMES, useToast } from "../lib/ui";
import { cloudEnabled, pushFest } from "../lib/cloud";
import type { Route } from "./Shell";

type P = { push: (r: Route) => void; params?: Record<string, string>; back?: () => void };

export function SettingsSection({ push: _push }: P) {
  const { data, fest, session, updateFest, updateDb, theme, setTheme } = useStore();
  const toast = useToast();

  const [festName, setFestName] = useState(fest?.name || "");
  const [defMaxTeam, setDefMaxTeam] = useState("2");
  const [defScaleId, setDefScaleId] = useState("");

  const [resetModal, setResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  if (!data || !fest || !session) return null;
  const isMain = session.role === "MAIN";

  if (!isMain) {
    return (
      <div>
        <PageHead title="Settings" sub="Access restricted" />
        <Empty icon="lock" title="Main User Only" body="Settings are restricted to the Main Administrator of this fest." />
      </div>
    );
  }

  const saveFestName = () => {
    const nm = festName.trim();
    if (!nm) { toast("Fest name cannot be empty", "err"); return; }
    updateDb((d) => {
      const f = d.fests.find((x) => x.id === fest.id);
      if (f) {
        f.name = nm;
        log(f.data, session.name, `Fest renamed to "${nm}"`);
      }
    });
    toast("Fest name updated", "ok");
  };

  // Reset Fest Data
  const handleResetData = () => {
    if (resetConfirmText.trim().toLowerCase() !== fest.name.toLowerCase()) {
      toast("Fest name mismatch — reset canceled", "err");
      return;
    }
    updateFest(fest.id, (d) => {
      d.teams = [];
      d.categories = [];
      d.members = [];
      d.programs = [];
      d.statuses = {};
      d.codeLetters = {};
      d.lettersDone = {};
      d.judgementMarks = {};
      d.judgementSaved = {};
      d.monitorDone = {};
      d.activities = [];
      d.publicReleased = {};
      d.schedule = {};
      d.scheduleSlots = [];
      d.publishOrder = {};
      log(d, session.name, "Fest data reset to blank state");
    });
    setResetModal(false);
    setResetConfirmText("");
    toast("Fest data reset complete", "ok");
  };

  return (
    <div className="max-w-[760px] mx-auto space-y-6">
      <PageHead title="Settings" sub="Fest configuration, data management, backups, and security (Main Administrator only)." />

      {/* 1. FEST IDENTITY */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--marigold)" }}><Icon n="sparkle" s={18} /></span>
          <span className="font-d text-[15px] font-extrabold">Fest Identity & General</span>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Field label="Fest Name">
              <input
                className="input"
                value={festName}
                onChange={(e) => setFestName(e.target.value)}
                placeholder="e.g. Rivertown Fest 2026"
              />
            </Field>
          </div>
          <Btn onClick={saveFestName}><Icon n="check" s={15} sw={2.4} /> Save Name</Btn>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="card2 p-3.5">
            <span className="lbl">Theme color code</span>
            <div className="grid gap-1.5">
              {THEMES.map((t) => {
                const on = t.id === theme;
                return (
                  <button key={t.id} type="button" onClick={() => { setTheme(t.id); toast(`Theme: ${t.label} (${t.code})`, "ok"); }}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                    style={{ background: on ? "var(--acc-soft)" : "transparent", border: `1.5px solid ${on ? "var(--acc)" : "var(--line)"}` }}>
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

          <div className="card2 p-3.5 flex items-center justify-between">
            <div>
              <span className="lbl mb-0">Cloud Sync Status</span>
              <span className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: cloudEnabled() ? "var(--acc)" : "var(--mut)" }}>
                <Icon n="globe" s={14} /> {cloudEnabled() ? "Connected & Synced" : "Local-Only Mode"}
              </span>
            </div>
            {cloudEnabled() && (
              <Btn size="sm" kind="soft" onClick={() => { pushFest(fest, session.name); toast("Cloud sync refreshed", "ok"); }}>
                Resync
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* 2. MAIN USER CREDENTIALS */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--acc)" }}><Icon n="key" s={18} /></span>
            <span className="font-d text-[15px] font-extrabold">Main Administrators ({fest.mainUsers.length})</span>
          </div>
        </div>
        <p className="text-[12.5px] font-semibold" style={{ color: "var(--mut)" }}>
          These Main User credentials can log in on any device to manage this fest.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {fest.mainUsers.map((u) => (
            <div key={u.name} className="card2 px-3.5 py-2.5 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>Main User</div>
                <div className="mono text-[14px] font-extrabold" style={{ color: "var(--acc)" }}>{u.name}</div>
              </div>
              <Dots secret={u.password} />
            </div>
          ))}
        </div>
      </div>

      {/* 3. PROGRAM & EVALUATION DEFAULTS */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--coral)" }}><Icon n="sliders" s={18} /></span>
          <span className="font-d text-[15px] font-extrabold">Program & Scoring Defaults</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Default Max Members Per Team">
            <input className="input" inputMode="numeric" value={defMaxTeam} onChange={(e) => setDefMaxTeam(e.target.value.replace(/\D/g, ""))} />
          </Field>

          <Field label="Default Grade Scale for Programs">
            <select className="select" value={defScaleId} onChange={(e) => setDefScaleId(e.target.value)}>
              <option value="">Default (First Scale)</option>
              {(data.gradeScales || defaultGradeScales()).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        </div>

      </div>

      {/* 4. DANGER ZONE / RESET */}
      <div className="card p-5 space-y-3" style={{ border: "1.5px solid var(--coral-soft)" }}>
        <div className="flex items-center gap-2" style={{ color: "var(--coral)" }}>
          <Icon n="trash" s={18} />
          <span className="font-d text-[15px] font-extrabold">Danger Zone</span>
        </div>
        <p className="text-[12.5px] font-semibold" style={{ color: "var(--mut)" }}>
          Resetting clear all teams, members, categories, programs, and results inside this fest while keeping your main admin login.
        </p>
        <div>
          <Btn kind="danger" onClick={() => { setResetConfirmText(""); setResetModal(true); }}>
            <Icon n="trash" s={15} /> Reset All Fest Data
          </Btn>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        open={resetModal}
        onClose={() => setResetModal(false)}
        title="Reset All Fest Data?"
        footer={
          <>
            <Btn kind="soft" onClick={() => setResetModal(false)}>Cancel</Btn>
            <Btn kind="danger" onClick={handleResetData}>Confirm Reset</Btn>
          </>
        }
      >
        <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--mut)" }}>
          This action will erase all teams, members, programs, schedule entries, and results for <b style={{ color: "var(--ink)" }}>{fest.name}</b>.
        </p>
        <Field label={`Type "${fest.name}" to confirm reset`}>
          <input
            className="input"
            value={resetConfirmText}
            placeholder={fest.name}
            onChange={(e) => setResetConfirmText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleResetData()}
          />
        </Field>
      </Modal>
    </div>
  );
}
