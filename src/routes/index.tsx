import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CATALOG, PROFILE, REGIONS, type Opportunity } from "@/data/catalog";
import { dailyPick, gradeLabel, isOpen, urgency } from "@/lib/desk";
import type { Status } from "@/lib/desk";
import { useTracker } from "@/lib/tracker";
import { writeBriefing } from "@/lib/briefing";

export const Route = createFileRoute("/")({ component: Home });

const STATUSES: { id: Status; label: string }[] = [
  { id: "new", label: "New" },
  { id: "shortlist", label: "Shortlist" },
  { id: "drafting", label: "Drafting" },
  { id: "applied", label: "Applied" },
  { id: "ignore", label: "Ignore" },
];

function Home() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const dayKey = now.toISOString().slice(0, 10);
  const tracker = useTracker();
  const [tab, setTab] = useState<"today" | "catalogue" | "apply">("today");
  const [region, setRegion] = useState<string>("All");
  const [kind, setKind] = useState<string>("All");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hideIgnored, setHideIgnored] = useState(true);
  const [letter, setLetter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const openNow = useMemo(
    () => CATALOG.filter((o) => isOpen(o, month)).sort((a, b) => b.fit - a.fit),
    [month],
  );
  const featured = useMemo(() => dailyPick(now, openNow.length ? openNow : CATALOG), [dayKey]);

  const filtered = useMemo(() => {
    return CATALOG.filter((o) => {
      if (region !== "All" && o.country !== region) return false;
      if (kind !== "All" && o.kind !== kind) return false;
      if (onlyOpen && !isOpen(o, month)) return false;
      if (hideIgnored && tracker.status[o.id] === "ignore") return false;
      if (query) {
        const blob = `${o.title} ${o.institution} ${o.field} ${o.country}`.toLowerCase();
        if (!blob.includes(query.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => b.fit - a.fit);
  }, [region, kind, onlyOpen, query, hideIgnored, tracker.status, month]);

  const applyList = CATALOG.filter((o) => {
    const s = tracker.status[o.id];
    return s === "shortlist" || s === "drafting" || s === "applied";
  }).sort((a, b) => b.fit - a.fit);

  const counts = {
    open: openNow.length,
    short: applyList.filter((o) => tracker.status[o.id] !== "applied").length,
    applied: applyList.filter((o) => tracker.status[o.id] === "applied").length,
    core: CATALOG.filter((o) => o.core).length,
  };

  async function brief() {
    setBusy(true);
    setErr(null);
    const items = featured.slice(0, 5).map((o) => ({
      title: o.title,
      institution: o.institution,
      country: o.country,
      why: o.why,
      risks: o.risks,
      window: o.window,
      fit: o.fit,
    }));
    try {
      const res = await writeBriefing({ data: { day: dayKey, items } });
      if (!res.ok) setErr(res.error);
      else {
        setLetter(res.text);
        tracker.saveLetter(dayKey, res.text);
      }
    } catch {
      setErr("Could not reach the briefing service.");
    } finally {
      setBusy(false);
    }
  }

  const shownLetter = letter ?? tracker.letters[dayKey] ?? null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-line)] bg-[#f7f1e7]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:items-end md:justify-between md:px-6">
          <div>
            <p className="text-[11px] tracking-[0.22em] text-[var(--color-copper)] uppercase">
              Wafer Desk · {dayKey}
            </p>
            <h1 className="serif mt-1 text-4xl leading-none text-[var(--color-ink)] md:text-5xl">
              Master's for the chip path
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#5c5148]">
              Built for {PROFILE.name}: {PROFILE.role} since {PROFILE.since}. Electronics, circuits,
              semiconductors. Intake target {PROFILE.intake}.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat n={counts.open} label="Open this month" />
            <Stat n={counts.short} label="On your list" />
            <Stat n={counts.applied} label="Marked applied" />
            <Stat n={counts.core} label="Core matches" />
          </dl>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4 md:px-6">
          {(
            [
              ["today", "Today's desk"],
              ["catalogue", "Catalogue"],
              ["apply", "Apply list"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`border-b-2 px-3 py-2 text-sm ${
                tab === id
                  ? "border-[var(--color-copper)] text-[var(--color-ink)]"
                  : "border-transparent text-[#6d6258]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:px-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit border border-[var(--color-line)] bg-white/70 p-4">
          <p className="text-[11px] tracking-[0.18em] text-[#7a6d62] uppercase">Applicant</p>
          <h2 className="serif mt-1 text-2xl">{PROFILE.name}</h2>
          <p className="mt-1 text-sm text-[#5c5148]">{PROFILE.degree}</p>
          <p className="mt-1 text-sm">
            CGPA <span className="font-medium">{PROFILE.cgpa}</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#3d342c]">{PROFILE.proof}</p>
          <p className="mt-3 text-xs leading-relaxed text-[#6d6258]">{PROFILE.skills}</p>
          <div className="mt-4 border-t border-[var(--color-line)] pt-3 text-xs leading-relaxed text-[#5c5148]">
            Deadlines move. Every card is a researched starting point, not a promise that a round is
            still open. Open the official page before you pay a fee.
          </div>
        </aside>

        {tab === "today" && (
          <section className="space-y-4">
            <div className="border border-[var(--color-ink)] bg-[#1c1612] p-5 text-[#f4efe6]">
              <p className="text-[11px] tracking-[0.2em] text-[#e7c4a8] uppercase">Morning note</p>
              <h2 className="serif mt-1 text-3xl">What is actually open in {monthLabel(month)}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#e6d9cc]">
                {openNow.length} programmes and scholarships on your map usually accept applications
                this month. The five below are today's priority stack — it rotates each morning so
                you do not keep rereading the same three names. UK rounds are mid-season. Denmark,
                Sweden, Delft, ETH, and Erasmus Mundus are in their dangerous early-close window.
                MEXT embassy track is not this month; it returns in spring.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={brief}
                  disabled={busy}
                  className="bg-[#e7c4a8] px-4 py-2 text-sm font-medium text-[#1c1612] disabled:opacity-60"
                >
                  {busy ? "Writing…" : "Write today's letter"}
                </button>
                <span className="text-xs text-[#cbbbaa]">Uses a short Grok note. Once per click, saved on this device.</span>
              </div>
              {err && <p className="mt-3 text-sm text-[#f0b4a0]">{err}</p>}
              {shownLetter && (
                <article className="serif mt-4 max-w-2xl text-[15px] leading-relaxed whitespace-pre-wrap text-[#f7f1e7]">
                  {shownLetter}
                </article>
              )}
            </div>

            <div className="grid gap-3">
              {featured.map((o, i) => (
                <Card
                  key={o.id}
                  o={o}
                  month={month}
                  rank={i + 1}
                  status={tracker.status[o.id] ?? "new"}
                  note={tracker.notes[o.id] ?? ""}
                  expanded={openId === o.id}
                  onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                  onStatus={(s) => tracker.setStatus(o.id, s)}
                  onNote={(n) => tracker.setNote(o.id, n)}
                />
              ))}
            </div>

            <div>
              <h3 className="serif text-2xl">Also open this month</h3>
              <ul className="mt-2 divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
                {openNow
                  .filter((o) => !featured.some((f) => f.id === o.id))
                  .map((o) => (
                    <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                      <button className="text-left" onClick={() => { setTab("catalogue"); setOpenId(o.id); }}>
                        <span className="font-medium">{o.institution}</span>
                        <span className="text-[#6d6258]"> — {o.title}</span>
                      </button>
                      <span className="text-[#9a4e24]">{o.fit}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </section>
        )}

        {tab === "catalogue" && (
          <section>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search school, field, country"
                className="min-w-0 flex-1 border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
              />
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="border border-[var(--color-line)] bg-white px-2 py-2 text-sm"
              >
                <option>All</option>
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="border border-[var(--color-line)] bg-white px-2 py-2 text-sm"
              >
                <option>All</option>
                <option value="program">program</option>
                <option value="scholarship">scholarship</option>
                <option value="both">both</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
                Open now
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hideIgnored} onChange={(e) => setHideIgnored(e.target.checked)} />
                Hide ignored
              </label>
            </div>
            <p className="mb-3 text-xs text-[#6d6258]">{filtered.length} shown, ranked by fit to your profile.</p>
            <div className="grid gap-3">
              {filtered.map((o) => (
                <Card
                  key={o.id}
                  o={o}
                  month={month}
                  status={tracker.status[o.id] ?? "new"}
                  note={tracker.notes[o.id] ?? ""}
                  expanded={openId === o.id}
                  onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                  onStatus={(s) => tracker.setStatus(o.id, s)}
                  onNote={(n) => tracker.setNote(o.id, n)}
                />
              ))}
            </div>
          </section>
        )}

        {tab === "apply" && (
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="serif text-3xl">Applications</h2>
                <p className="mt-1 max-w-xl text-sm text-[#5c5148]">
                  Shortlist first, then drafting, then applied. Suggested order: scholarships with
                  early closes (Erasmus, Chevening if still open, DTU, KTH, Delft) before prestige
                  programmes you can file in January.
                </p>
              </div>
              <button
                onClick={() => downloadCsv(applyList, tracker.status, tracker.notes)}
                className="border border-[var(--color-ink)] px-3 py-2 text-sm"
              >
                Download CSV
              </button>
            </div>
            {applyList.length === 0 ? (
              <p className="border border-dashed border-[var(--color-line)] p-6 text-sm text-[#6d6258]">
                Nothing on the list yet. Open Today's desk and mark three programmes as Shortlist.
              </p>
            ) : (
              <ol className="grid gap-3">
                {applyList.map((o, i) => (
                  <Card
                    key={o.id}
                    o={o}
                    month={month}
                    rank={i + 1}
                    status={tracker.status[o.id] ?? "new"}
                    note={tracker.notes[o.id] ?? ""}
                    expanded={openId === o.id}
                    onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                    onStatus={(s) => tracker.setStatus(o.id, s)}
                    onNote={(n) => tracker.setNote(o.id, n)}
                  />
                ))}
              </ol>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="border border-[var(--color-line)] bg-white/60 px-3 py-2">
      <dt className="text-[10px] tracking-wider text-[#7a6d62] uppercase">{label}</dt>
      <dd className="serif text-2xl">{n}</dd>
    </div>
  );
}

function monthLabel(m: number) {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1];
}

function Card({
  o,
  month,
  rank,
  status,
  note,
  expanded,
  onToggle,
  onStatus,
  onNote,
}: {
  o: Opportunity;
  month: number;
  rank?: number;
  status: Status;
  note: string;
  expanded: boolean;
  onToggle: () => void;
  onStatus: (s: Status) => void;
  onNote: (n: string) => void;
}) {
  const u = urgency(o, month);
  const tone =
    u === "closing"
      ? "bg-[#9a4e24] text-white"
      : u === "just-opened"
        ? "bg-[#2f5d50] text-white"
        : u === "open"
          ? "bg-[#e7efe9] text-[#23483d]"
          : "bg-[#efe8dc] text-[#5c5148]";
  const uLabel =
    u === "closing" ? "Window late" : u === "just-opened" ? "Just opened" : u === "open" ? "In window" : "Not this month";

  return (
    <article className="border border-[var(--color-line)] bg-white">
      <button onClick={onToggle} className="flex w-full flex-col gap-2 px-4 py-3 text-left sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] tracking-wide uppercase">
            {rank != null && <span className="text-[var(--color-copper)]">#{rank}</span>}
            <span className={`px-1.5 py-0.5 ${tone}`}>{uLabel}</span>
            <span className="text-[#7a6d62]">{o.country}</span>
            <span className="text-[#7a6d62]">{o.kind}</span>
            {o.valuesExperience && <span className="text-[#2f5d50]">Work experience helps</span>}
          </div>
          <h3 className="serif mt-1 text-xl leading-tight">{o.title}</h3>
          <p className="text-sm text-[#5c5148]">
            {o.institution} · {o.city}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="serif text-3xl leading-none">{o.fit}</p>
          <p className="text-[10px] tracking-wider text-[#7a6d62] uppercase">fit</p>
        </div>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-[var(--color-line)] px-4 py-3 text-sm">
          <p className="leading-relaxed">{o.why}</p>
          <p className="leading-relaxed text-[#6a3b1e]">
            <span className="font-medium">Watch: </span>
            {o.risks}
          </p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] tracking-wider text-[#7a6d62] uppercase">Usual window</dt>
              <dd>{o.window}</dd>
            </div>
            <div>
              <dt className="text-[10px] tracking-wider text-[#7a6d62] uppercase">Funding</dt>
              <dd>{o.funding}</dd>
            </div>
            <div>
              <dt className="text-[10px] tracking-wider text-[#7a6d62] uppercase">Intake</dt>
              <dd>{o.intake}</dd>
            </div>
            <div>
              <dt className="text-[10px] tracking-wider text-[#7a6d62] uppercase">Your CGPA</dt>
              <dd>{gradeLabel(o.grade)}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => onStatus(s.id)}
                className={`border px-2 py-1 text-xs ${
                  status === s.id ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white" : "border-[var(--color-line)]"
                }`}
              >
                {s.label}
              </button>
            ))}
            <a
              href={o.url}
              target="_blank"
              rel="noreferrer"
              className="border border-[var(--color-copper)] px-2 py-1 text-xs text-[var(--color-copper)]"
            >
              Official page
            </a>
          </div>
          <label className="block text-xs text-[#6d6258]">
            Note for this application
            <textarea
              value={note}
              onChange={(e) => onNote(e.target.value)}
              rows={2}
              className="mt-1 w-full border border-[var(--color-line)] p-2 text-sm text-[var(--color-ink)]"
              placeholder="Referee, deadline you confirmed, portal login…"
            />
          </label>
        </div>
      )}
    </article>
  );
}

function downloadCsv(
  rows: Opportunity[],
  status: Record<string, Status>,
  notes: Record<string, string>,
) {
  const header = ["status", "fit", "title", "institution", "country", "kind", "intake", "funding", "url", "risks", "note"];
  const body = rows.map((o) =>
    [status[o.id] ?? "", o.fit, o.title, o.institution, o.country, o.kind, o.intake, o.funding, o.url, o.risks, notes[o.id] ?? ""]
      .map((c) => `"${String(c).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "wafer-desk-applications.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
