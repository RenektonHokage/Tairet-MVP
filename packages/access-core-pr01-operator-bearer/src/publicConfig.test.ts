import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  ACCESS_CORE_SUPABASE_PUBLIC_CONFIG,
  verifySupabasePublicConfigIdentity,
  type SupabasePublicConfig,
} from "./publicConfig";

test("binds the exact approved publishable configuration identity", () => {
  const identity = verifySupabasePublicConfigIdentity(
    ACCESS_CORE_SUPABASE_PUBLIC_CONFIG,
  );
  const calculatedHash = createHash("sha256")
    .update(
      Buffer.from(
        ACCESS_CORE_SUPABASE_PUBLIC_CONFIG.publishableKey,
        "utf8",
      ),
    )
    .digest("hex");

  assert.equal(
    calculatedHash,
    "1c653c81714c4282263c0bd73d2d993d54e81d6273038026f9ed8a6266409f8f",
  );
  assert.equal(identity.keyValueSha256, calculatedHash);
  assert.equal(identity.projectRef, "omteyctmrgahavgfaodw");
  assert.equal(identity.keyType, "publishable");
  assert.equal(identity.keyDisabled, false);
  assert.equal(
    ACCESS_CORE_SUPABASE_PUBLIC_CONFIG.publishableKey.startsWith(
      "sb_publishable_",
    ),
    true,
  );
  assert.equal(
    JSON.stringify(identity).includes(
      ACCESS_CORE_SUPABASE_PUBLIC_CONFIG.publishableKey,
    ),
    false,
  );
});

test("rejects service-role, secret and non-publishable key classes", () => {
  const variants = [
    {
      ...ACCESS_CORE_SUPABASE_PUBLIC_CONFIG,
      publishableKey: "service_role_synthetic",
    },
    {
      ...ACCESS_CORE_SUPABASE_PUBLIC_CONFIG,
      publishableKey: "sb_secret_synthetic",
    },
    {
      ...ACCESS_CORE_SUPABASE_PUBLIC_CONFIG,
      keyType: "secret",
    },
  ] as unknown as SupabasePublicConfig[];

  for (const variant of variants) {
    assert.throws(
      () => verifySupabasePublicConfigIdentity(variant),
      (error: unknown) =>
        error instanceof Error &&
        !error.message.includes(variant.publishableKey),
    );
  }
});
