import type { DemoScenario } from "./runtime";

export interface PanelDemoAssets {
  cover: string;
  gallery: string[];
  promos: string[];
  profile: {
    cover: string;
    gallery: string[];
  };
}

export const demoClubAssets: PanelDemoAssets = {
  cover: "/demo/koala-jack/cover.jpg",
  gallery: [
    "/demo/koala-jack/gallery-01.jpg",
    "/demo/koala-jack/gallery-02.jpg",
    "/demo/koala-jack/gallery-03.jpg",
  ],
  promos: [
    "/demo/koala-jack/promo-01.jpg",
    "/demo/koala-jack/promo-02.jpg",
    "/demo/koala-jack/promo-03.jpg",
  ],
  profile: {
    cover: "/demo/koala-jack/cover.jpg",
    gallery: [
      "/demo/koala-jack/gallery-01.jpg",
      "/demo/koala-jack/gallery-02.jpg",
      "/demo/koala-jack/gallery-03.jpg",
    ],
  },
};

export const demoBarAssets: PanelDemoAssets = {
  cover: "/demo/tairet-bar/cover.jpg",
  gallery: [
    "/demo/tairet-bar/gallery-01.jpg",
    "/demo/tairet-bar/gallery-02.jpg",
    "/demo/tairet-bar/gallery-03.jpg",
  ],
  promos: [
    "/demo/tairet-bar/promo-01.jpg",
    "/demo/tairet-bar/promo-02.jpg",
  ],
  profile: {
    cover: "/demo/tairet-bar/cover.jpg",
    gallery: [
      "/demo/tairet-bar/gallery-01.jpg",
      "/demo/tairet-bar/gallery-02.jpg",
      "/demo/tairet-bar/gallery-03.jpg",
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
