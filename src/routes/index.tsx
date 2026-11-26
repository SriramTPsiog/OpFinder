import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { CATALOG, PROFILE } from "@/data/catalog";
import { briefingAvailable, writeBriefing } from "@/lib/briefing";
import { mountDesk } from "../../desk/app.mjs";
import deskCss from "../../desk/desk.css?url";

export const Route = createFileRoute("/")({
  head: () => ({ links: [{ rel: "stylesheet", href: deskCss }] }),
  loader: () => briefingAvailable(),
  component: Home,
});

function Home() {
  const root = useRef<HTMLDivElement>(null);
  const aiAvailable = Route.useLoaderData();
  useEffect(() => {
    if (!root.current) return;
    return mountDesk(root.current, CATALOG, PROFILE, null, new URL("./data/opportunities.json", document.baseURI).href,
      aiAvailable ? async (day, list) => {
        const items = list.map(({ title, institution, country, why, risks, window, fit }) => ({ title, institution, country, why, risks, window, fit }));
        const answer = await writeBriefing({ data: { day, items } });
        if (!answer.ok) throw new Error(answer.error);
        return answer.text;
      } : undefined);
  }, [aiAvailable]);
  return <div className="wd" ref={root}><main className="wd-wrap"><h1>Wafer Desk</h1><p>Loading your admissions desk…</p></main></div>;
}
