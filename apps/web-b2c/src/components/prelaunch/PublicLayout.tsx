import { useEffect, useRef, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { chooseConsent, MediaPreferences, useConsentState } from "./consent";
import { ConsentBanner, ConsentDialog, PublicDock, PublicFooter, PublicHeader } from "./PublicChrome";
import { setupVisualEffects } from "./visualEffects";
import "./approved-shell.css";
import "./prelaunch.css";
import "./global-typography.css";

export function PublicLayout({ page, title, children }: { page: string; title: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const priorOverflow = useRef<string | null>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const { consent, persisted } = useConsentState();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const isGuide = page === "halloween";

  useEffect(() => {
    const previous = document.title;
    const pageTitle = title + " — TAIRET";
    document.title = pageTitle;
    return () => { if (document.title === pageTitle) document.title = previous; };
  }, [title]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const dialog = el.querySelector<HTMLDialogElement>("#r4-cookie-dialog");
    const responsive = matchMedia("(max-width: 760px)");
    const compactSearch = matchMedia("(max-width: 560px)");
    const header = el.querySelector("header.header");
    const applyScroll = () => header?.classList.toggle("is-scroll-locked", window.scrollY > 48);
    const applyWidth = () => {
      for (const group of el.querySelectorAll<HTMLDetailsElement>(".tf-footer-group")) {
        group.open = !responsive.matches;
        const summary = group.querySelector("summary");
        if (summary) {
          summary.tabIndex = responsive.matches ? 0 : -1;
          if (responsive.matches) summary.removeAttribute("aria-disabled");
          else summary.setAttribute("aria-disabled", "true");
        }
      }
      const input = el.querySelector<HTMLInputElement>("[data-search-input]");
      if (input) input.placeholder = isGuide
        ? (compactSearch.matches ? "Buscar fiesta…" : "Buscar fiesta, música o zona…")
        : (compactSearch.matches ? "Buscar…" : "Buscar por zona, local o música…");
    };
    const currentNav = isGuide ? undefined : ["home", "asuncion", "mapa"].includes(page) ? page : "informacion";
    for (const link of el.querySelectorAll<HTMLElement>("[data-nav]")) {
      if (link.dataset.nav === currentNav) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    const stopEffects = setupVisualEffects(el, page);
    applyWidth();
    applyScroll();
    responsive.addEventListener("change", applyWidth);
    compactSearch.addEventListener("change", applyWidth);
    window.addEventListener("scroll", applyScroll, { passive: true });
    const unlock = () => {
      if (priorOverflow.current !== null) document.documentElement.style.overflow = priorOverflow.current;
      priorOverflow.current = null;
    };
    dialog?.addEventListener("close", unlock);
    return () => {
      dialog?.close();
      unlock();
      dialog?.removeEventListener("close", unlock);
      stopEffects();
      responsive.removeEventListener("change", applyWidth);
      compactSearch.removeEventListener("change", applyWidth);
      window.removeEventListener("scroll", applyScroll);
    };
  }, [page, location.key, isGuide]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>(".tu-document").forEach(node => { node.dataset.theme = theme; });
    const toggle = el.querySelector("[data-theme-toggle]");
    toggle?.setAttribute("aria-label", theme === "dark" ? "Activar modo claro" : "Activar modo oscuro");
    toggle?.setAttribute("aria-pressed", String(theme === "light"));
    const sun = el.querySelector<SVGElement>("[data-sun]");
    const moon = el.querySelector<SVGElement>("[data-moon]");
    if (sun) sun.style.display = theme === "dark" ? "" : "none";
    if (moon) moon.style.display = theme === "light" ? "" : "none";
  }, [theme, page]);

  const preferences = () => root.current?.querySelector<HTMLDialogElement>("#r4-cookie-dialog");
  const openPreferences = () => {
    const dialog = preferences();
    if (!dialog || dialog.open) return;
    const external = dialog.querySelector<HTMLInputElement>("#r4-external-toggle");
    const analytics = dialog.querySelector<HTMLInputElement>("#r4-analytics-toggle");
    if (external) external.checked = consent?.external === true;
    if (analytics) analytics.checked = consent?.analytics === true;
    const status = dialog.querySelector("#r4-cookie-status");
    if (status) status.textContent = consent
      ? `Contenido externo: ${consent.external ? "permitido" : "bloqueado"}. Analítica: ${consent.analytics ? "permitida" : "bloqueada"}.`
      : "Todavía no elegiste una preferencia.";
    priorOverflow.current = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog.showModal();
  };

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    if (target.closest('.tf-footer-group summary[aria-disabled="true"]')) {
      event.preventDefault();
      return;
    }
    const dialog = preferences();
    if (dialog && target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    }
    const control = target.closest("button, a");
    if (!control) return;
    if (control.matches("[data-tu-join], [data-open-owner]")) navigate("/para-locales/solicitud");
    else if (control.hasAttribute("data-tf-return")) {
      if (location.key === "default") navigate("/");
      else navigate(-1);
    } else if (control.hasAttribute("data-theme-toggle")) setTheme(theme === "dark" ? "light" : "dark");
    else if (control.hasAttribute("data-r4-preferences")) openPreferences();
    else if (control.hasAttribute("data-r4-cookie-close")) dialog?.close();
    else if (control.matches("[data-r4-cookie-accept], [data-r4-cookie-reject]")) {
      const allow = control.hasAttribute("data-r4-cookie-accept");
      chooseConsent(allow, allow);
      dialog?.close();
    } else if (control.hasAttribute("data-r4-cookie-save") && dialog) {
      chooseConsent(Boolean(dialog.querySelector<HTMLInputElement>("#r4-external-toggle")?.checked),
        Boolean(dialog.querySelector<HTMLInputElement>("#r4-analytics-toggle")?.checked));
      dialog.close();
    }
  }

  function handleSearch(event: FormEvent<HTMLDivElement>) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches(".catalog-search")) return;
    event.preventDefault();
    const q = String(new FormData(form).get("q") ?? "").trim();
    navigate({ pathname: isGuide ? "/halloween" : "/explorar", search: q ? new URLSearchParams({ q }).toString() : "" });
  }

  return <MediaPreferences.Provider value={{ external: consent?.external === true, openPreferences }}>
    <div ref={root} lang="es" className="prelaunch" data-concept="cinema" data-route={page} data-theme={theme} data-reference="rojo"
      data-tf-page={!["home", "asuncion", "halloween"].includes(page)} onClick={handleClick} onSubmit={handleSearch}>
      <a className="skip" href="#main" onClick={e => { e.preventDefault(); root.current?.querySelector<HTMLElement>("main")?.focus(); }}>Saltar al contenido</a>
      <PublicHeader />
      <main id="main" tabIndex={-1}><div className={"pl-" + page}>{children}</div></main>
      <PublicFooter /><PublicDock />
      {!consent && <ConsentBanner />}
      <ConsentDialog />
      {!persisted && <p className="pl-storage-notice" role="status">La preferencia se aplica en esta visita. El navegador no permitió guardarla.</p>}
    </div>
  </MediaPreferences.Provider>;
}
