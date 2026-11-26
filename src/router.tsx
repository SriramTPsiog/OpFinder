import { createRouter } from "@tanstack/react-router";
import type { LocationRewrite } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { prefixRewrite, previewPathRewrite } from "@/lib/preview-path-prefix";
import { routeTree } from "./routeTree.gen";

/**
 * GitHub Project Pages serve the site under /<repo>/ (https://user.github.io/<repo>/).
 * The static HTML is rendered for "/", so strip that prefix when matching routes
 * and add it back to generated links.
 */
function githubPagesRewrite(): LocationRewrite | undefined {
  if (typeof window === "undefined") return undefined;
  if (!window.location.hostname.endsWith(".github.io")) return undefined;
  const repo = window.location.pathname.split("/")[1];
  return repo ? prefixRewrite(`/${repo}`) : undefined;
}

export function getRouter() {
  return createRouter({
    routeTree,
    rewrite: previewPathRewrite() ?? githubPagesRewrite(),
    defaultErrorComponent: AppErrorComponent,
  });
}