import { useEffect, useRef, useState } from "react";
import { useStore, uid, log } from "../lib/store";
import type { ScheduleSlot, Schedule } from "../lib/store";
import { Icon, Btn, IconBtn, Empty, PageHead, useToast, useAsk } from "../lib/ui";
import type { Route } from "./Shell";

type P = { push: (r: Route) => void; params?: Record<string, string>; back?: () => void };

const cellKey = (stageId: string, slotId: string) => `${stageId}__${slotId}`;
const slotStart = (s: ScheduleSlot) => new Date(`${s.date}T${s.time || "00:00"}`);
const slotEnd = (s: ScheduleSlot) => new Date(`${s.date}T${s.endTime || s.time || "00:00"}`);
const fmtSlot = (s: ScheduleSlot) => {
  const st = slotStart(s), en = slotEnd(s);
  const fmt = (d: Date) => isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${s.date}  ${fmt(st)} - ${fmt(en)}`;
};
const fmtTime = (s: ScheduleSlot) => {
  const st = slotStart(s), en = slotEnd(s);
  const fmt = (d: Date) => isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${fmt(st)} - ${fmt(en)}`;
};
const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
};
const CELL_COLORS = ["#2fbf9f", "#ffc53d", "#ff7a50", "#6fc3df", "#d48cc0", "#9db85a", "#c78bff", "#f0916a"];
const catColor = (idx: number) => CELL_COLORS[((idx % CELL_COLORS.length) + CELL_COLORS.length) % CELL_COLORS.length];

export function ScheduleSection(_: P) {
  const { data, fest, session, updateFest } = useStore();
  const toast = useToast();
  const ask = useAsk();
  const isMain = session?.role === "MAIN";
  const [slots, setSlots] = useState<ScheduleSlot[]>(() => data?.scheduleSlots || []);
  const [cells, setCells] = useState<Schedule>(() => ({ ...(data?.schedule || {}) }));
  const [dirty, setDirty] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const savedRef = useRef({ slots: data?.scheduleSlots, schedule: data?.schedule });

  // Pull saves made by another role/device whenever there are no local unsaved edits.
  useEffect(() => {
    if (!data) return;
    if (data.scheduleSlots === savedRef.current.slots && data.schedule === savedRef.current.schedule) return;
    savedRef.current = { slots: data.scheduleSlots, schedule: data.schedule };
    if (!dirty) {
      setSlots(data.scheduleSlots);
      setCells({ ...data.schedule });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.scheduleSlots, data?.schedule]);

  if (!data || !fest || !session) return null;
  const sorted = [...slots].sort((a, b) => slotStart(a).getTime() - slotStart(b).getTime());
  const catIndex = (cid: string) => data.categories.findIndex((c) => c.id === cid);
  const progColor = (pid?: string) => {
    const p = data.programs.find((x) => x.id === pid);
    return p ? catColor(catIndex(p.categoryId)) : "var(--mut)";
  };
  const progName = (pid?: string) => data.programs.find((p) => p.id === pid)?.name || "";
  const progCat = (pid?: string) => data.categories.find((c) => c.id === data.programs.find((p) => p.id === pid)?.categoryId)?.name || "";

  const membersInProgram = (pid: string) => new Set(data.programs.find((p) => p.id === pid)?.entries.flatMap((e) => e.memberIds) || []);

  /** Names of members of the program in this cell who are double-booked in an overlapping slot. */
  const memberConflicts = (stageId: string, slotId: string): string[] => {
    const pid = cells[cellKey(stageId, slotId)];
    const slot = slots.find((s) => s.id === slotId);
    if (!pid || !slot) return [];
    const members = membersInProgram(pid);
    if (!members.size) return [];
    const hits = new Set<string>();
    for (const os of overlappingSlots(slot)) {
      for (const stage of data.stages) {
        const otherPid = cells[cellKey(stage.id, os.id)];
        if (!otherPid || otherPid === pid) continue;
        const otherMembers = membersInProgram(otherPid);
        for (const mid of members) if (otherMembers.has(mid)) hits.add(data.members.find((m) => m.id === mid)?.name || "Member");
      }
    }
    return [...hits];
  };

  const overlappingSlots = (slot: ScheduleSlot) => {
    const a = slotStart(slot).getTime(), b = slotEnd(slot).getTime();
    if (isNaN(a) || isNaN(b)) return [];
    return sorted.filter((s) => s.id !== slot.id && slotStart(s).getTime() < b && slotEnd(s).getTime() > a);
  };

  /** A program can appear once, and a member cannot be in overlapping programs. */
  const cellBlocker = (stageId: string, slotId: string, pid: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!pid || !slot) return null;
    for (const s of sorted) {
      for (const stage of data.stages) {
        if (stage.id === stageId && s.id === slotId) continue;
        if (cells[cellKey(stage.id, s.id)] === pid) {
          return `"${progName(pid)}" is already scheduled at ${fmtTime(s)} on "${stage.name}".`;
        }
      }
    }
    const members = membersInProgram(pid);
    for (const os of overlappingSlots(slot)) {
      for (const stage of data.stages) {
        const otherPid = cells[cellKey(stage.id, os.id)];
        if (!otherPid || otherPid === pid) continue;
        const otherMembers = membersInProgram(otherPid);
        for (const memberId of members) {
          if (otherMembers.has(memberId)) {
            const member = data.members.find((m) => m.id === memberId)?.name || "Someone";
            return `"${member}" is already in "${progName(otherPid)}" at ${fmtTime(os)} on "${stage.name}".`;
          }
        }
      }
    }
    return null;
  };

  const dateGroups: { date: string; slots: ScheduleSlot[] }[] = [];
  for (const slot of sorted) {
    let group = dateGroups.find((x) => x.date === slot.date);
    if (!group) { group = { date: slot.date, slots: [] }; dateGroups.push(group); }
    group.slots.push(slot);
  }
  const now = Date.now();
  const isNowSlot = (s: ScheduleSlot) => {
    const a = slotStart(s).getTime(), b = slotEnd(s).getTime();
    return !isNaN(a) && !isNaN(b) && now >= a && now < b;
  };

  const addSlot = () => {
    if (!newDate) { toast("Pick a date", "err"); return; }
    if (!newTime) { toast("Pick a starting time", "err"); return; }
    if (!newEndTime) { toast("Pick an ending time", "err"); return; }
    if (newEndTime <= newTime) { toast("End time must be after start time", "err"); return; }
    if (slots.some((s) => s.date === newDate && s.time === newTime && s.endTime === newEndTime)) {
      toast("That time slot already exists", "err"); return;
    }
    setSlots((s) => [...s, { id: uid(), date: newDate, time: newTime, endTime: newEndTime }]);
    setNewDate(""); setNewTime(""); setNewEndTime(""); setDirty(true);
    toast("Time slot added - remember to save", "info");
  };

  const removeSlot = async (slot: ScheduleSlot) => {
    const ok = await ask({ title: `Remove ${fmtSlot(slot)}?`, body: "Programs in this column will be cleared.", yes: "Remove", danger: true });
    if (!ok) return;
    setSlots((s) => s.filter((x) => x.id !== slot.id));
    setCells((c) => {
      const next = { ...c };
      for (const stage of data.stages) delete next[cellKey(stage.id, slot.id)];
      return next;
    });
    setDirty(true);
  };

  const setCell = (stageId: string, slotId: string, pid: string) => {
    if (pid) {
      const blocked = cellBlocker(stageId, slotId, pid);
      if (blocked) { toast(blocked, "err"); return; }
    }
    setCells((c) => {
      const next = { ...c };
      if (pid) next[cellKey(stageId, slotId)] = pid;
      else delete next[cellKey(stageId, slotId)];
      return next;
    });
    setDirty(true);
  };

  const save = () => {
    updateFest(fest.id, (d) => {
      d.scheduleSlots = slots;
      d.schedule = cells;
      log(d, session.name, "Schedule saved");
    });
    savedRef.current = { slots, schedule: cells };
    setDirty(false);
    toast("Schedule saved", "ok");
  };

  if (!data.stages.length) {
    return (
      <div>
        <PageHead title="Timetable" sub="Plan which program runs on each stage, by date and time." />
        <Empty icon="calendar" title="Add stages first" body="The timetable uses stages as rows. Add at least one stage to build it." />
      </div>
    );
  }

  return (
    <div>
      <PageHead title="Timetable" sub={isMain ? "Rows are stages and columns are date/time slots. Pick a program in each cell, then save." : "Read-only timetable - you will be notified when a program is due."}>
        {isMain && <Btn onClick={save} disabled={!dirty}><Icon n="check" s={16} sw={2.4} /> Save{dirty ? " *" : ""}</Btn>}
      </PageHead>

      {isMain && (
        <div className="card2 p-3.5 mb-4 flex items-end gap-2.5 flex-wrap">
          <div><span className="lbl">Date</span><input type="date" className="input" style={{ width: 160 }} value={newDate} onChange={(e) => setNewDate(e.target.value)} /></div>
          <div><span className="lbl">Start time</span><input type="time" className="input" style={{ width: 125 }} value={newTime} onChange={(e) => setNewTime(e.target.value)} /></div>
          <div><span className="lbl">End time</span><input type="time" className="input" style={{ width: 125 }} value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} /></div>
          <Btn kind="soft" onClick={addSlot}><Icon n="plus" s={15} sw={2.4} /> Add time slot</Btn>
          {dirty && <span className="text-[12px] font-bold ml-auto" style={{ color: "var(--marigold)" }}>Unsaved changes</span>}
        </div>
      )}

      {!sorted.length ? (
        <Empty icon="clock" title="No time slots yet" body={isMain ? "Add a date, start time and end time above." : "The organiser has not published a timetable yet."} />
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="border-separate" style={{ borderSpacing: 6, minWidth: "100%" }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ position: "sticky", left: 0, zIndex: 3, minWidth: 150, background: "var(--panel3)", borderRadius: 10, verticalAlign: "bottom" }}>
                  <span className="flex items-center gap-2 px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}><Icon n="calendar" s={14} /> Stage</span>
                </th>
                {dateGroups.map((group) => (
                  <th key={group.date} colSpan={Math.max(1, group.slots.length)} className="text-center" style={{ background: "var(--marigold-soft)", borderRadius: 10, padding: "7px 10px" }}>
                    <span className="text-[12px] font-extrabold" style={{ color: "var(--marigold)" }}>{fmtDate(group.date)}</span>
                  </th>
                ))}
              </tr>
              <tr>
                {sorted.map((slot) => (
                  <th key={slot.id} style={{ minWidth: 170, background: isNowSlot(slot) ? "var(--acc-soft)" : "var(--panel2)", borderRadius: 10, padding: "6px 8px", border: isNowSlot(slot) ? "1.5px solid var(--acc)" : "1px solid var(--line)" }}>
                    <span className="flex items-center justify-center gap-1.5">
                      {isNowSlot(slot) && <span className="pulse-dot w-2 h-2 rounded-full" style={{ background: "var(--acc)" }} />}
                      <Icon n="clock" s={12} className="opacity-70" /><span className="mono text-[11.5px] font-bold">{fmtTime(slot)}</span>
                      {isMain && <IconBtn n="x" s={12} title="Remove time slot" className="shrink-0" onClick={() => removeSlot(slot)} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.stages.map((stage) => (
                <tr key={stage.id}>
                  <td style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--panel3)", borderRadius: 10, padding: "8px 12px" }}>
                    <span className="flex items-center gap-2 font-extrabold text-[13.5px]"><Icon n="mappin" s={14} className="opacity-70" />{stage.name}</span>
                  </td>
                  {sorted.map((slot) => {
                    const pid = cells[cellKey(stage.id, slot.id)];
                    const color = progColor(pid);
                    return (
                      <td key={slot.id} style={{ verticalAlign: "top", padding: 0, height: 62 }}>
                        {(() => { const clash = memberConflicts(stage.id, slot.id); return isMain ? (
                          <label className="block relative rounded-[10px] h-full transition-all cursor-pointer" style={{ minHeight: 58, background: pid ? color + "22" : "var(--panel2)", border: `1.5px solid ${pid && clash.length ? "var(--coral)" : pid ? color : "var(--line)"}` }}>
                            {pid ? (
                              <span className="block px-2.5 py-2 pointer-events-none"><span className="block w-1.5 h-1.5 rounded-full mb-1" style={{ background: color }} /><span className="block text-[12.5px] font-extrabold leading-tight line-clamp-2">{progName(pid)}</span><span className="block text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color }}>{progCat(pid)}</span>{clash.length > 0 && <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-extrabold" style={{ color: "var(--coral)" }}>⚠ {clash[0]} double-booked</span>}</span>
                            ) : (
                              <span className="flex items-center justify-center h-full" style={{ color: "var(--mut)", minHeight: 58 }}><Icon n="plus" s={13} /></span>
                            )}
                            <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={pid || ""} onChange={(e) => setCell(stage.id, slot.id, e.target.value)} title="Assign program">
                              <option value="">- free -</option>
                              {data.programs.map((program) => {
                                const placed = program.id !== pid && Object.values(cells).includes(program.id);
                                return <option key={program.id} value={program.id} disabled={placed}>{placed ? `${program.name} (already scheduled)` : program.name}</option>;
                              })}
                            </select>
                          </label>
                        ) : pid ? (
                          <div className="rounded-[10px] px-2.5 py-2" style={{ background: color + "22", border: `1.5px solid ${clash.length ? "var(--coral)" : color}`, minHeight: 58 }}><span className="block w-1.5 h-1.5 rounded-full mb-1" style={{ background: color }} /><span className="block text-[12.5px] font-extrabold leading-tight line-clamp-2">{progName(pid)}</span><span className="block text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color }}>{progCat(pid)}</span>{clash.length > 0 && <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-extrabold" style={{ color: "var(--coral)" }}>⚠ {clash[0]} double-booked</span>}</div>
                        ) : (
                          <div className="rounded-[10px] flex items-center justify-center" style={{ background: "var(--panel2)", border: "1px dashed var(--line2)", minHeight: 58, color: "var(--mut)" }}>-</div>
                        ); })()}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length > 0 && data.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {data.categories.map((category, i) => <span key={category.id} className="inline-flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: "var(--mut)" }}><span className="w-3 h-3 rounded" style={{ background: catColor(i) }} /> {category.name}</span>)}
        </div>
      )}
      <p className="text-[12px] font-bold mt-3 flex items-center gap-2" style={{ color: "var(--mut)" }}><Icon n="info" s={14} /> Members cannot be placed in overlapping time slots, and each program can appear only once.</p>
    </div>
  );
}