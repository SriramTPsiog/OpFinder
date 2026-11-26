import { useEffect, useState } from "react";
import type { Status } from "@/lib/desk";

const KEY = "wafer-desk-v1";

export type TrackerState = {
  status: Record<string, Status>;
  notes: Record<string, string>;
  letters: Record<string, string>;
};

const empty: TrackerState = { status: {}, notes: {}, letters: {} };

function read(): TrackerState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as TrackerState;
    return {
      status: parsed.status ?? {},
      notes: parsed.notes ?? {},
      letters: parsed.letters ?? {},
    };
  } catch {
    return empty;
  }
}

export function useTracker() {
  const [state, setState] = useState<TrackerState>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(read());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, ready]);

  function setStatus(id: string, status: Status) {
    setState((s) => ({ ...s, status: { ...s.status, [id]: status } }));
  }
  function setNote(id: string, note: string) {
    setState((s) => ({ ...s, notes: { ...s.notes, [id]: note } }));
  }
  function saveLetter(day: string, text: string) {
    setState((s) => ({ ...s, letters: { ...s.letters, [day]: text } }));
  }

  return { ...state, ready, setStatus, setNote, saveLetter };
}
