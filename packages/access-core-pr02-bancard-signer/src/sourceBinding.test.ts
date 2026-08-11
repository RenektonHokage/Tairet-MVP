import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import {
  BANCARD_CONFIRM_SOURCE_BINDINGS,
  verifyBancardConfirmSourceBindings,
} from "./sourceBinding";

const REPOSITORY_ROOT = resolve(__dirname, "../../..");

function runGit(repositoryRoot: string, args: readonly string[]): void {
  execFileSync("git", [...args], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      GIT_OPTIONAL_LOCKS: "0",
      GIT_TERMINAL_PROMPT: "0",
    },
    stdio: "ignore",
    windowsHide: true,
  });
}

function createIsolatedBindingFixture(): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "tairet-pr02-source-binding-"));
  for (const binding of BANCARD_CONFIRM_SOURCE_BINDINGS.files) {
    const destination = resolve(fixtureRoot, ...binding.path.split("/"));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(REPOSITORY_ROOT, ...binding.path.split("/")), destination);
  }

  runGit(fixtureRoot, ["init", "--quiet"]);
  runGit(fixtureRoot, ["config", "core.autocrlf", "false"]);
  runGit(fixtureRoot, [
    "add",
    "--",
    ...BANCARD_CONFIRM_SOURCE_BINDINGS.files.map((binding) => binding.path),
  ]);
  return fixtureRoot;
}

describe("Bancard confirm source bindings", () => {
  it("freezes the four exact source identities and the allowed/prohibited routes", () => {
    assert.equal(BANCARD_CONFIRM_SOURCE_BINDINGS.baseCommit, "0c503b5dcbe334ebf1a79612d813f3f0f402e5b7");
    assert.equal(BANCARD_CONFIRM_SOURCE_BINDINGS.allowedRoute, "POST /payments/bancard/confirm");
    assert.equal(BANCARD_CONFIRM_SOURCE_BINDINGS.prohibitedRoute, "POST /payments/callback");
    assert.equal(BANCARD_CONFIRM_SOURCE_BINDINGS.files.length, 4);
    assert.equal(Object.isFrozen(BANCARD_CONFIRM_SOURCE_BINDINGS), true);
    assert.equal(Object.isFrozen(BANCARD_CONFIRM_SOURCE_BINDINGS.files), true);
    assert.deepEqual(
      BANCARD_CONFIRM_SOURCE_BINDINGS.files.map(({ path, sha256, gitBlob, mode }) => ({
        path,
        sha256,
        gitBlob,
        mode,
      })),
      [
        {
          path: "functions/api/src/services/bancardConfirm.ts",
          sha256: "55c58014c464e4282954af270276fb78aa8b888736a41f443186d1594600de6c",
          gitBlob: "29f4de3e26a96d37350a9d6b74bc694caa5f590a",
          mode: "100644",
        },
        {
          path: "functions/api/src/schemas/bancardConfirm.ts",
          sha256: "6971725e3486100f7fa4d18b2c59dff70c49f7c3944f49f2e1ad47fa83ca9316",
          gitBlob: "d3c82ae63a6a314ac3e888c12bf99eb814b7cf37",
          mode: "100644",
        },
        {
          path: "functions/api/src/routes/payments.ts",
          sha256: "fcd6876ef1fe28c968375448c907bf02c8c78592ae53d4341c5b98b7c1300a60",
          gitBlob: "2cc217cce9e39d597f6d7afad5b54b967db2ac80",
          mode: "100644",
        },
        {
          path: "functions/api/src/server.ts",
          sha256: "97cdce68d5c96a876620a3e4e1339cfafeb5e06a9bb3161a11e2be6ea2508938",
          gitBlob: "3c0786c5444feb1ba876372a5a2dc5d9d826989c",
          mode: "100644",
        },
      ],
    );
  });

  it("verifies the current repository without importing API code", () => {
    assert.deepEqual(verifyBancardConfirmSourceBindings(REPOSITORY_ROOT), {
      ok: true,
      baseCommit: "0c503b5dcbe334ebf1a79612d813f3f0f402e5b7",
      verifiedBindingCount: 4,
      errorCode: null,
      path: null,
    });
  });

  it("fails on byte drift in each of the four canonical files", () => {
    const fixtureRoot = createIsolatedBindingFixture();
    try {
      for (const binding of BANCARD_CONFIRM_SOURCE_BINDINGS.files) {
        const path = resolve(fixtureRoot, ...binding.path.split("/"));
        const original = readFileSync(path);
        writeFileSync(path, Buffer.concat([original, Buffer.from("\n", "utf8")]));

        const result = verifyBancardConfirmSourceBindings(fixtureRoot);
        assert.equal(result.ok, false);
        assert.equal(result.errorCode, "source_sha256_mismatch");
        assert.equal(result.path, binding.path);

        writeFileSync(path, original);
        assert.equal(verifyBancardConfirmSourceBindings(fixtureRoot).ok, true);
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("fails when the Git index blob differs from the byte-exact worktree", () => {
    const fixtureRoot = createIsolatedBindingFixture();
    const binding = BANCARD_CONFIRM_SOURCE_BINDINGS.files[0];
    const path = resolve(fixtureRoot, ...binding.path.split("/"));
    const original = readFileSync(path);
    try {
      writeFileSync(path, Buffer.concat([original, Buffer.from("\n", "utf8")]));
      runGit(fixtureRoot, ["add", "--", binding.path]);
      writeFileSync(path, original);

      const result = verifyBancardConfirmSourceBindings(fixtureRoot);
      assert.equal(result.ok, false);
      assert.equal(result.errorCode, "git_blob_mismatch");
      assert.equal(result.path, binding.path);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("fails when the Git index mode differs", () => {
    const fixtureRoot = createIsolatedBindingFixture();
    const binding = BANCARD_CONFIRM_SOURCE_BINDINGS.files[0];
    try {
      runGit(fixtureRoot, ["update-index", "--chmod=+x", "--", binding.path]);

      const result = verifyBancardConfirmSourceBindings(fixtureRoot);
      assert.equal(result.ok, false);
      assert.equal(result.errorCode, "git_mode_mismatch");
      assert.equal(result.path, binding.path);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("fails closed for missing source files and invalid repository roots", () => {
    const fixtureRoot = createIsolatedBindingFixture();
    const binding = BANCARD_CONFIRM_SOURCE_BINDINGS.files[3];
    try {
      rmSync(resolve(fixtureRoot, ...binding.path.split("/")));
      const missing = verifyBancardConfirmSourceBindings(fixtureRoot);
      assert.equal(missing.ok, false);
      assert.equal(missing.errorCode, "source_file_unavailable");
      assert.equal(missing.path, binding.path);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }

    const invalidRoot = verifyBancardConfirmSourceBindings("   ");
    assert.equal(invalidRoot.ok, false);
    assert.equal(invalidRoot.errorCode, "invalid_repository_root");
  });
});
