import { CATALOG, type Opportunity } from "@/data/catalog";

export type Status = "new" | "shortlist" | "drafting" | "applied" | "ignore";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(m: number) {
  return MONTHS[m - 1] ?? "";
}

export function isOpen(o: Opportunity, month: number) {
  return o.months.includes(month);
}

/** Stable daily rotation so the morning desk changes without inventing fake listings. */
export function dailyPick(date = new Date(), pool?: Opportunity[]) {
  const source = (pool ?? CATALOG).slice().sort((a, b) => b.fit - a.fit);
  const start = dayOfYear(date) % Math.max(1, source.length);
  const n = Math.min(5, source.length);
  const out: Opportunity[] = [];
  for (let i = 0; i < n; i++) out.push(source[(start + i * 3) % source.length]!);
  return out;
}

export function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

export function urgency(o: Opportunity, month: number) {
  if (!isOpen(o, month)) return "later" as const;
  const idx = o.months.indexOf(month);
  const left = o.months.length - idx;
  if (left <= 2) return "closing" as const;
  if (idx <= 1) return "just-opened" as const;
  return "open" as const;
}

export function gradeLabel(g: Opportunity["grade"]) {
  if (g === "ok") return "Grade likely acceptable";
  if (g === "borderline") return "Grade near the line — explain 7.61";
  return "Grade filter may reject 7.61";
}
