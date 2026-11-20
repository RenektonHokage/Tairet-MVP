import type { Plugin } from "vite";
import { octoberPaths } from "./src/components/prelaunch/publicPaths";
import program from "./src/content/halloween-2026.public.json";

// The static host has no SPA rewrite. Give the original bookmarks real HTML entry points.
export function publicPageEntries(): Plugin {
  const paths = new Set<string>([...octoberPaths, ...program.events.map(event => "/halloween/fiesta/" + event.slug)]);

  return {
    name: "tairet-public-page-entries",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const index = bundle["index.html"];
        if (index?.type !== "asset") this.error("Falta la entrada HTML del B2C.");
        for (const path of paths) {
          this.emitFile({ type: "asset", fileName: path.slice(1) + "/index.html", source: index.source });
        }
      },
    },
  };
}
