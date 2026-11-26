import type { Opportunity, PROFILE } from "../src/data/catalog";
export function mountDesk(root: HTMLElement, catalogue: Opportunity[], profile: typeof PROFILE, initial: unknown, feedUrl: string, aiBrief?: (day: string, items: Opportunity[]) => Promise<string>): () => void;
