"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  LayoutDashboard,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type PanelTheme = "dark" | "light";

const PANEL_THEME_STORAGE_KEY = "tairet.panel.theme";
const PANEL_THEME_EVENT_NAME = "tairet:panel-theme-change";

const loginBenefits = [
  {
    label: "Gestión centralizada",
    description: "Controla tu local desde el panel.",
    icon: LayoutDashboard,
  },
  {
    label: "Métricas en tiempo real",
    description: "Analítica para toma de decisiones.",
    icon: BarChart3,
  },
  {
    label: "Seguridad garantizada",
    description: "Acceso cifrado.",
    icon: ShieldCheck,
  },
  {
    label: "Disponible 24/7",
    description: "Tu negocio nunca duerme, tampoco tu panel.",
    icon: Clock3,
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<PanelTheme>("dark");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(PANEL_THEME_STORAGE_KEY);
      if (storedTheme === "dark" || storedTheme === "light") {
        setTheme(storedTheme);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_THEME_STORAGE_KEY, theme);
    } catch {
      // noop
    }

    document.documentElement.style.colorScheme = theme;
    window.dispatchEvent(
      new CustomEvent(PANEL_THEME_EVENT_NAME, {
        detail: theme,
      })
    );
  }, [theme]);

  const isDark = theme === "dark";

  const themeClasses = isDark
    ? {
        page: "bg-[#090909] text-white",
        switchButton:
          "border-[#303030] bg-[#141414]/95 text-neutral-200 hover:bg-[#1b1b1b]",
        switchIcon: "text-blue-300",
        separator:
          "bg-[linear-gradient(180deg,transparent,rgba(69,69,69,0.9)_14%,rgba(69,69,69,0.9)_86%,transparent)]",
        leftSection: "border-[#303030] bg-[#0b0d10]",
        leftGlow:
          "bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.05),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.02),transparent_28%)]",
        leftGrid:
          "opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:40px_40px]",
        logoShell: "border-[#303030] bg-[#141414]",
        brandTitle: "text-white",
        brandSub: "text-neutral-500",
        headline: "text-white",
        lead: "text-neutral-400",
        divider: "bg-white/8",
        benefitItem: "text-neutral-200",
        benefitIcon: "text-[#93c5fd]",
        benefitTitle: "text-white",
        benefitDescription: "text-neutral-500",
        rightSection: "bg-[#0d0f12]",
        rightGlow:
          "bg-[radial-gradient(circle_at_center_left,rgba(59,130,246,0.04),transparent_18%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.015),transparent_24%)]",
        card: "border-[#303030] bg-[#141414] shadow-[0_18px_40px_rgba(0,0,0,0.24)]",
        cardTitle: "text-white",
        cardSubtitle: "text-neutral-400",
        label: "text-neutral-100",
        input:
          "border-[#303030] bg-[#1b1b1b] text-white placeholder:text-neutral-500 focus:border-blue-400 focus:ring-blue-500/16",
        checkbox:
          "border-[#303030] bg-[#1b1b1b] text-blue-500 focus:ring-blue-500/16",
        auxiliary: "text-neutral-300",
        link: "text-blue-300 hover:text-blue-200",
        errorBox: "border-rose-500/25 bg-rose-500/10",
        errorText: "text-rose-100",
        cta: "border-blue-400/30 bg-[#3464ea] text-white hover:bg-[#3b6ef5]",
        support: "text-neutral-400",
        footer: "text-neutral-500",
      }
    : {
        page: "bg-[#f3f5f8] text-[#111827]",
        switchButton:
          "border-[#d7dde6] bg-white/95 text-[#334155] hover:bg-[#f8fafc]",
        switchIcon: "text-[#3464ea]",
        separator:
          "bg-[linear-gradient(180deg,transparent,rgba(203,213,225,0.18)_0%,rgba(203,213,225,0.95)_14%,rgba(203,213,225,0.95)_86%,rgba(203,213,225,0.18)_100%)]",
        leftSection: "border-[#dbe1e8] bg-[#f8fafc]",
        leftGlow:
          "bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.55),transparent_28%)]",
        leftGrid:
          "opacity-[0.05] [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:40px_40px]",
        logoShell:
          "border-[#1e293b]/10 bg-[#0f172a] shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
        brandTitle: "text-[#0f172a]",
        brandSub: "text-[#64748b]",
        headline: "text-[#0f172a]",
        lead: "text-[#5f6b7a]",
        divider: "bg-[#dde3ea]",
        benefitItem: "text-[#334155]",
        benefitIcon: "text-[#3464ea]",
        benefitTitle: "text-[#0f172a]",
        benefitDescription: "text-[#64748b]",
        rightSection: "bg-[#eef2f7]",
        rightGlow:
          "bg-[radial-gradient(circle_at_center_left,rgba(59,130,246,0.07),transparent_18%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.45),transparent_24%)]",
        card: "border-[#dbe1e8] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
        cardTitle: "text-[#0f172a]",
        cardSubtitle: "text-[#64748b]",
        label: "text-[#1e293b]",
        input:
          "border-[#d5dbe5] bg-white text-[#0f172a] placeholder:text-[#94a3b8] focus:border-blue-500 focus:ring-blue-500/14",
        checkbox:
          "border-[#cbd5e1] bg-white text-blue-600 focus:ring-blue-500/14",
        auxiliary: "text-[#475569]",
        link: "text-[#3464ea] hover:text-[#2f58cf]",
        errorBox: "border-rose-200 bg-rose-50",
        errorText: "text-rose-700",
        cta: "border-[#2f58cf]/20 bg-[#3464ea] text-white hover:bg-[#2f58cf]",
        support: "text-[#64748b]",
        footer: "text-[#64748b]",
      };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || "Error al iniciar sesión");
        return;
      }

      if (data.session) {
        router.push("/panel");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  return (
    <div className={`min-h-screen ${themeClasses.page}`} data-login-theme={theme}>
      <div className="relative grid min-h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(540px,1.1fr)]">
        <div className="absolute right-5 top-5 z-20 sm:right-6 sm:top-6">
          <button
            type="button"
            onClick={handleToggleTheme}
            title="Cambiar tema"
            aria-label={theme === "dark" ? "Cambiar a light mode" : "Cambiar a dark mode"}
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-[0.82rem] font-medium shadow-sm backdrop-blur ${themeClasses.switchButton}`}
          >
            {theme === "dark" ? (
              <Sun className={`h-4 w-4 ${themeClasses.switchIcon}`} />
            ) : (
              <Moon className={`h-4 w-4 ${themeClasses.switchIcon}`} />
            )}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>

        <div className={`pointer-events-none absolute inset-y-10 left-[45%] z-10 hidden w-px lg:block ${themeClasses.separator}`} />

        <section className={`relative overflow-hidden border-b lg:border-b-0 ${themeClasses.leftSection}`}>
          <div className={`absolute inset-0 ${themeClasses.leftGlow}`} />
          <div className={`absolute inset-0 ${themeClasses.leftGrid}`} />

          <div className="relative flex h-full flex-col px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 xl:px-14">
            <div className="inline-flex items-center gap-4">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${themeClasses.logoShell}`}>
                <Image
                  src="/tairet-mark.png"
                  alt="Tairet mark"
                  width={26}
                  height={26}
                  className="h-[26px] w-[26px] object-contain"
                />
              </span>
              <div className="space-y-1">
                <p className={`text-[1.2rem] font-semibold leading-none tracking-tight ${themeClasses.brandTitle}`}>Tairet</p>
                <p className={`text-[0.78rem] font-medium uppercase tracking-[0.26em] ${themeClasses.brandSub}`}>
                  Panel de gestión
                </p>
              </div>
            </div>

            <div className="max-w-[420px] space-y-8 py-10 sm:py-12 lg:py-14">
              <div className="space-y-5">
                <h1 className={`max-w-[368px] text-[3.05rem] font-semibold leading-[0.98] tracking-tight sm:text-[3.8rem] ${themeClasses.headline}`}>
                  Todo lo que necesita tu local.
                </h1>
                <p className={`max-w-[390px] text-[1rem] leading-8 ${themeClasses.lead}`}>
                  Tairet pone el control de tu negocio en tus manos con herramientas
                  pensadas para establecimientos reales.
                </p>
              </div>

              <div className="space-y-6">
                <div className={`h-px w-full ${themeClasses.divider}`} />
                <ul className="space-y-5">
                  {loginBenefits.map((benefit) => {
                    const Icon = benefit.icon;
                    return (
                      <li
                        key={benefit.label}
                        className={`flex items-start gap-4 text-sm ${themeClasses.benefitItem}`}
                      >
                        <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center ${themeClasses.benefitIcon}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="space-y-1">
                          <span className={`block text-[1.02rem] font-semibold leading-6 ${themeClasses.benefitTitle}`}>
                            {benefit.label}
                          </span>
                          <span className={`block text-[0.96rem] leading-7 ${themeClasses.benefitDescription}`}>
                            {benefit.description}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className={`relative overflow-hidden ${themeClasses.rightSection}`}>
          <div className={`absolute inset-0 ${themeClasses.rightGlow}`} />

          <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-8 sm:px-10 sm:py-12 lg:px-16">
            <div className={`w-full max-w-[450px] rounded-[30px] border px-8 py-8 ${themeClasses.card}`}>
              <div className="mb-8 space-y-3">
                <h2 className={`text-[2.18rem] font-semibold leading-tight tracking-tight sm:text-[2.28rem] ${themeClasses.cardTitle}`}>
                  Panel Tairet
                </h2>
                <p className={`max-w-[330px] text-[0.98rem] leading-7 ${themeClasses.cardSubtitle}`}>
                  Accedé a tu cuenta para gestionar tu local.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2.5">
                  <label
                    htmlFor="email"
                    className={`block text-[0.95rem] font-semibold ${themeClasses.label}`}
                  >
                    Correo electrónico
                  </label>
                  <input
                    data-login-input="true"
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={`h-[54px] w-full rounded-[16px] border px-4 text-[0.98rem] outline-none transition focus:ring-2 ${themeClasses.input}`}
                    placeholder="tu@local.com"
                  />
                </div>

                <div className="space-y-2.5">
                  <label
                    htmlFor="password"
                    className={`block text-[0.95rem] font-semibold ${themeClasses.label}`}
                  >
                    Contraseña
                  </label>
                  <input
                    data-login-input="true"
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className={`h-[54px] w-full rounded-[16px] border px-4 text-[0.98rem] outline-none transition focus:ring-2 ${themeClasses.input}`}
                    placeholder="••••••••"
                  />
                </div>

                {error ? (
                  <div className={`rounded-xl border px-4 py-3 ${themeClasses.errorBox}`}>
                    <p className={`text-sm ${themeClasses.errorText}`}>{error}</p>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className={`inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] border px-4 text-[1rem] font-semibold shadow-none transition disabled:cursor-not-allowed disabled:opacity-50 ${themeClasses.cta}`}
                >
                  <span>{loading ? "Iniciando sesión..." : "Entrar al panel"}</span>
                  {!loading ? <ArrowRight className="h-5 w-5" /> : null}
                </button>
              </form>

              <p className={`mt-7 text-center text-[0.95rem] leading-7 ${themeClasses.support}`}>
                ¿Tenés problemas para acceder?{" "}
                <a
                  href="mailto:soporte@tairet.com"
                  className={`font-medium transition ${themeClasses.link}`}
                >
                  Contactá con soporte
                </a>
              </p>
            </div>

            <p className={`mt-7 text-sm ${themeClasses.footer}`}>
              © 2026 Tairet · Todos los derechos reservados
            </p>
          </div>
        </section>
      </div>
      <style jsx global>{`
        [data-login-theme="dark"] input[data-login-input="true"] {
          color-scheme: dark;
        }

        [data-login-theme="dark"] input[data-login-input="true"]:-webkit-autofill,
        [data-login-theme="dark"] input[data-login-input="true"]:-webkit-autofill:hover,
        [data-login-theme="dark"] input[data-login-input="true"]:-webkit-autofill:focus,
        [data-login-theme="dark"] input[data-login-input="true"]:-webkit-autofill:active {
          -webkit-text-fill-color: #ffffff;
          caret-color: #ffffff;
          background-color: #1b1b1b !important;
          border: 1px solid #303030;
          box-shadow: 0 0 0 1000px #1b1b1b inset;
          -webkit-box-shadow: 0 0 0 1000px #1b1b1b inset;
          transition: background-color 9999s ease-in-out 0s;
        }

        [data-login-theme="light"] input[data-login-input="true"] {
          color-scheme: light;
        }

        [data-login-theme="light"] input[data-login-input="true"]:-webkit-autofill,
        [data-login-theme="light"] input[data-login-input="true"]:-webkit-autofill:hover,
        [data-login-theme="light"] input[data-login-input="true"]:-webkit-autofill:focus,
        [data-login-theme="light"] input[data-login-input="true"]:-webkit-autofill:active {
          -webkit-text-fill-color: #0f172a;
          caret-color: #0f172a;
          background-color: #ffffff !important;
          border: 1px solid #d5dbe5;
          box-shadow: 0 0 0 1000px #ffffff inset;
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>
    </div>
  );
}

