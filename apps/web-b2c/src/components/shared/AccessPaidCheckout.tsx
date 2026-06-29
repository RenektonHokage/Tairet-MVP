import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

declare global {
  interface Window {
    Bancard?: {
      Checkout?: {
        createForm?: (
          containerId: string,
          processId: string,
          styles?: Record<string, string>
        ) => void;
      };
    };
  }
}

interface AccessPaidCheckoutProps {
  publicRef: string;
  processId: string;
  onClose: () => void;
}

type BancardFrameStatus = "loading" | "ready" | "error";

const BANCARD_CHECKOUT_SCRIPT_ID = "bancard-checkout-script";
const DEFAULT_BANCARD_CHECKOUT_SCRIPT_URL =
  "https://vpos.infonet.com.py:8888/checkout/javascript/dist/bancard-checkout-4.0.0.js";
const BANCARD_CHECKOUT_SCRIPT_TIMEOUT_MS = 15000;

let bancardScriptPromise: Promise<void> | null = null;

function hasBancardCheckout(): boolean {
  return typeof window !== "undefined" && typeof window.Bancard?.Checkout?.createForm === "function";
}

function getBancardCheckoutScriptUrl(): string {
  const envValue = import.meta.env?.VITE_BANCARD_CHECKOUT_SCRIPT_URL;
  return typeof envValue === "string" && envValue.trim()
    ? envValue.trim()
    : DEFAULT_BANCARD_CHECKOUT_SCRIPT_URL;
}

function loadBancardCheckoutScript(): Promise<void> {
  if (hasBancardCheckout()) {
    return Promise.resolve();
  }

  if (bancardScriptPromise) {
    return bancardScriptPromise;
  }

  bancardScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(BANCARD_CHECKOUT_SCRIPT_ID) as HTMLScriptElement | null;
    const timeoutId = window.setTimeout(() => {
      rejectWithCleanup(new Error("Bancard checkout script timed out"));
    }, BANCARD_CHECKOUT_SCRIPT_TIMEOUT_MS);

    function resolveWithCleanup() {
      window.clearTimeout(timeoutId);
      resolve();
    }

    function rejectWithCleanup(error: Error) {
      window.clearTimeout(timeoutId);
      reject(error);
    }

    const handleReady = () => {
      if (hasBancardCheckout()) {
        resolveWithCleanup();
        return;
      }
      rejectWithCleanup(new Error("Bancard checkout unavailable"));
    };

    if (existingScript) {
      if (hasBancardCheckout()) {
        resolveWithCleanup();
        return;
      }

      existingScript.addEventListener("load", handleReady, { once: true });
      existingScript.addEventListener("error", () => rejectWithCleanup(new Error("Bancard checkout script failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = BANCARD_CHECKOUT_SCRIPT_ID;
    script.src = getBancardCheckoutScriptUrl();
    script.async = true;
    script.onload = handleReady;
    script.onerror = () => {
      script.remove();
      rejectWithCleanup(new Error("Bancard checkout script failed"));
    };
    document.body.appendChild(script);
  }).catch((error) => {
    bancardScriptPromise = null;
    throw error;
  });

  return bancardScriptPromise;
}

const bancardFrameStyles: Record<string, string> = {
  "form-background-color": "#ffffff",
  "button-background-color": "#111827",
  "button-text-color": "#ffffff",
};

export function AccessPaidCheckout({ publicRef, processId, onClose }: AccessPaidCheckoutProps) {
  const [frameStatus, setFrameStatus] = useState<BancardFrameStatus>("loading");
  const containerIdRef = useRef(`bancard-checkout-${Math.random().toString(36).slice(2)}`);
  const statusPath = useMemo(
    () => `/payments/access/status?ref=${encodeURIComponent(publicRef)}`,
    [publicRef]
  );

  useEffect(() => {
    let active = true;
    const containerId = containerIdRef.current;

    setFrameStatus("loading");

    loadBancardCheckoutScript()
      .then(() => {
        if (!active) return;

        const container = document.getElementById(containerId);
        if (!container || typeof window.Bancard?.Checkout?.createForm !== "function") {
          throw new Error("Bancard checkout unavailable");
        }

        container.innerHTML = "";
        window.Bancard.Checkout.createForm(containerId, processId, bancardFrameStyles);
        setFrameStatus("ready");
      })
      .catch(() => {
        if (active) {
          setFrameStatus("error");
        }
      });

    return () => {
      active = false;
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [processId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden bg-black/70 p-3 sm:p-4">
      <div className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101010] text-white shadow-2xl">
        <div className="space-y-5 p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-[auto_1fr] items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="justify-start px-2 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <div className="min-w-0">
              <h2 className="text-left text-2xl font-bold leading-tight text-white sm:text-3xl">
                Checkout seguro
              </h2>
              <p className="mt-1 text-sm text-white/65">
                Completá el pago en Bancard. La confirmación final se verifica automáticamente.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Card className="min-h-[620px] border border-white/10 bg-[#171717]">
              <CardHeader className="border-b border-white/10 bg-white/[0.03]">
                <CardTitle className="flex items-center gap-2 text-white">
                  <CreditCard className="h-5 w-5 text-white/80" />
                  Pago con Bancard
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                {frameStatus === "loading" && (
                  <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-white/10 bg-[#111111]">
                    <div className="flex items-center gap-3 text-white/70">
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      Cargando checkout seguro...
                    </div>
                  </div>
                )}

                {frameStatus === "error" && (
                  <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
                    <div className="max-w-md space-y-3">
                      <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
                      <h3 className="text-lg font-semibold text-white">No pudimos cargar Bancard.</h3>
                      <p className="text-sm text-white/70">
                        Revisá el estado de tu pago o intentá nuevamente en unos segundos.
                      </p>
                    </div>
                  </div>
                )}

                <div
                  id={containerIdRef.current}
                  className={frameStatus === "ready" ? "min-h-[560px] w-full overflow-hidden rounded-xl bg-white" : "hidden"}
                />
              </CardContent>
            </Card>

            <Card className="h-fit border border-white/10 bg-[#171717]">
              <CardHeader>
                <CardTitle className="text-white">Estado del pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-white/70">
                <p>
                  Si Bancard ya procesó tu pago, la pantalla de estado confirma el resultado cuando llega el
                  callback del procesador.
                </p>
                <p>
                  Si el pago se confirma, las entradas se envían al correo indicado. B2C no muestra el QR.
                </p>
                <Button asChild className="w-full bg-white text-[#111827] hover:bg-white/85">
                  <Link to={statusPath}>
                    Ver estado del pago
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
