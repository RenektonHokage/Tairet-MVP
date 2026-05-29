import type { DemoScenario } from "./runtime";

export interface PanelDemoAssets {
  cover: string;
  gallery: string[];
  promos: string[];
  profile: {
    cover: string;
    hero?: string;
    gallery: string[];
  };
}

export const demoClubAssets: PanelDemoAssets = {
  cover: "/demo/koala-jack/cover.png",
  gallery: [],
  promos: [
    "/demo/koala-jack/promo-01.png",
    "/demo/koala-jack/promo-02.png",
    "/demo/koala-jack/promo-03.png",
  ],
  profile: {
    cover: "/demo/koala-jack/cover.png",
    hero: "/demo/koala-jack/cover.png",
    gallery: [],
  },
};

export const demoBarAssets: PanelDemoAssets = {
  cover: "/demo/tairet-bar/cover.png",
  gallery: [
    "/demo/tairet-bar/gallery-01.webp",
    "/demo/tairet-bar/gallery-02.png",
    "/demo/tairet-bar/gallery-03.png",
    "/demo/tairet-bar/gallery-04.webp",
  ],
  promos: [
    "/demo/tairet-bar/promo-01.jpeg",
    "/demo/tairet-bar/promo-02.jpeg",
    "/demo/tairet-bar/promo-03.jpeg",
  ],
  profile: {
    cover: "/demo/tairet-bar/cover.png",
    hero: "/demo/tairet-bar/cover-02.png",
    gallery: [
      "/demo/tairet-bar/gallery-01.webp",
      "/demo/tairet-bar/gallery-02.png",
      "/demo/tairet-bar/gallery-03.png",
      "/demo/tairet-bar/gallery-04.webp",
    ],
  },
};

export const PANEL_DEMO_ASSETS: Record<DemoScenario, PanelDemoAssets> = {
  bar: demoBarAssets,
  discoteca: demoClubAssets,
};

export function getPanelDemoAssets(scenario: DemoScenario): PanelDemoAssets {
  return PANEL_DEMO_ASSETS[scenario];
}
