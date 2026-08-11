import { createHash } from "node:crypto";

export type SupabasePublicConfig = Readonly<{
  projectRef: string;
  projectUrl: string;
  keyId: string;
  keyName: string;
  keyType: "publishable";
  keyDisabled: false;
  publishableKey: string;
  keyValueSha256: string;
}>;

type SupabasePublicConfigIdentity = Readonly<{
  projectRef: string;
  projectUrl: string;
  keyId: string;
  keyName: string;
  keyType: "publishable";
  keyDisabled: false;
  keyValueSha256: string;
}>;

const EXPECTED_PROJECT_REF = "omteyctmrgahavgfaodw";
const EXPECTED_PROJECT_URL = "https://omteyctmrgahavgfaodw.supabase.co";
const EXPECTED_KEY_ID = "9dbd7e56-68f9-432f-8847-93a09869c9a9";
const EXPECTED_KEY_VALUE_SHA256 = "1c653c81714c4282263c0bd73d2d993d54e81d6273038026f9ed8a6266409f8f";

export const ACCESS_CORE_SUPABASE_PUBLIC_CONFIG: SupabasePublicConfig =
  Object.freeze({
    projectRef: EXPECTED_PROJECT_REF,
    projectUrl: EXPECTED_PROJECT_URL,
    keyId: EXPECTED_KEY_ID,
    keyName: "default",
    keyType: "publishable",
    keyDisabled: false,
    publishableKey: "sb_publishable_mW-4HsOXPv_AMoJB_6zZ0Q_wEmU3NQn",
    keyValueSha256: EXPECTED_KEY_VALUE_SHA256,
  });

export function verifySupabasePublicConfigIdentity(
  config: SupabasePublicConfig,
): SupabasePublicConfigIdentity {
  if (
    config.projectRef !== EXPECTED_PROJECT_REF ||
    config.projectUrl !== EXPECTED_PROJECT_URL ||
    config.keyId !== EXPECTED_KEY_ID ||
    config.keyName !== "default" ||
    config.keyType !== "publishable" ||
    config.keyDisabled !== false
  ) {
    throw new Error("SUPABASE_PUBLIC_CONFIG_IDENTITY_MISMATCH");
  }

  if (
    !config.publishableKey.startsWith("sb_publishable_") ||
    config.publishableKey.includes("service_role") ||
    config.publishableKey.startsWith("sb_secret_")
  ) {
    throw new Error("SUPABASE_PUBLIC_CONFIG_KEY_CLASS_MISMATCH");
  }

  const calculatedHash = createHash("sha256")
    .update(Buffer.from(config.publishableKey, "utf8"))
    .digest("hex");
  if (
    calculatedHash !== EXPECTED_KEY_VALUE_SHA256 ||
    config.keyValueSha256 !== EXPECTED_KEY_VALUE_SHA256
  ) {
    throw new Error("SUPABASE_PUBLIC_CONFIG_HASH_MISMATCH");
  }

  return Object.freeze({
    projectRef: config.projectRef,
    projectUrl: config.projectUrl,
    keyId: config.keyId,
    keyName: config.keyName,
    keyType: config.keyType,
    keyDisabled: config.keyDisabled,
    keyValueSha256: calculatedHash,
  });
}
