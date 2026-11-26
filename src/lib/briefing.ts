import { createServerFn } from "@tanstack/react-start";

type BriefInput = {
  day: string;
  items: { title: string; institution: string; country: string; why: string; risks: string; window: string; fit: number }[];
};

export const writeBriefing = createServerFn({ method: "POST" })
  .validator((input: BriefInput) => {
    if (!input || !Array.isArray(input.items) || input.items.length === 0 || input.items.length > 6) {
      throw new Error("Pick between 1 and 6 programmes.");
    }
    return {
      day: String(input.day ?? "").slice(0, 40),
      items: input.items.map((i) => ({
        title: String(i.title).slice(0, 180),
        institution: String(i.institution).slice(0, 160),
        country: String(i.country).slice(0, 60),
        why: String(i.why).slice(0, 400),
        risks: String(i.risks).slice(0, 400),
        window: String(i.window).slice(0, 240),
        fit: Number(i.fit) || 0,
      })),
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI briefing is not available in this environment." };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 700,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You write a short morning desk note for one applicant: Sriram Arasu T, B.E. EEE, CGPA 7.61/10, Graduate Engineer Trainee at PSIOG Digital since August 2026. He wants a master's in electronics, circuits, or semiconductors (intake around Aug–Oct 2027) in the UK, Malaysia, Singapore, Japan, China, Taiwan, Denmark, or a stronger neighbouring country. Be concrete, slightly blunt, no hype, no bullet icons. 220–320 words. Name what to do this week. Never invent a deadline date or a URL. Say when a grade filter may hurt him.",
          },
          {
            role: "user",
            content: `Date: ${data.day}\nProgrammes already scored for him:\n${data.items
              .map(
                (i, n) =>
                  `${n + 1}. ${i.title} — ${i.institution}, ${i.country} (fit ${i.fit}). Window: ${i.window}. Why: ${i.why} Risk: ${i.risks}`,
              )
              .join("\n")}`,
          },
        ],
      }),
    });

    if (!res.ok) return { ok: false as const, error: `Briefing failed (${res.status}). Try again later.` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false as const, error: "Empty briefing." };
    return { ok: true as const, text };
  });

export const briefingAvailable = createServerFn({ method: "GET" }).handler(() => Boolean(process.env.XAI_API_KEY));
