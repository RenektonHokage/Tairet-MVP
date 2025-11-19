import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para el panel B2B.
 * 
 * En CI (GitHub Actions) permitimos crear un cliente Supabase dummy cuando faltan
 * env vars solo para que el build de Next.js no falle al prerenderizar /panel.
 * En entornos reales (local/prod) se sigue requiriendo que las env estén definidas.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: ReturnType<typeof createClient>;

if (!supabaseUrl || !supabaseAnonKey) {
  // En CI, usar cliente dummy para que el build no falle
  if (process.env.CI === "true") {
    console.warn(
      "Supabase env vars missing in CI; using dummy client for build."
    );
    supabase = createClient("http://localhost:54321", "public-anon-key");
  } else {
    // Fuera de CI, lanzar error estricto
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
} else {
  // Variables presentes, crear cliente real
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

