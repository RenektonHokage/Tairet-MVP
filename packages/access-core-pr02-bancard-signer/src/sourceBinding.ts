import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE_FILES = Object.freeze([
  Object.freeze({
    path: "functions/api/src/services/bancardConfirm.ts",
    sha256: "55c58014c464e4282954af270276fb78aa8b888736a41f443186d1594600de6c",
    gitBlob: "29f4de3e26a96d37350a9d6b74bc694caa5f590a",
    mode: "100644",
    protects: "MD5 formula and verifier",
  }),
  Object.freeze({
    path: "functions/api/src/schemas/bancardConfirm.ts",
    sha256: "6971725e3486100f7fa4d18b2c59dff70c49f7c3944f49f2e1ad47fa83ca9316",
    gitBlob: "d3c82ae63a6a314ac3e888c12bf99eb814b7cf37",
    mode: "100644",
    protects: "shop_process_id, amount and PYG canonicalization",
  }),
  Object.freeze({
    path: "functions/api/src/routes/payments.ts",
    sha256: "fcd6876ef1fe28c968375448c907bf02c8c78592ae53d4341c5b98b7c1300a60",
    gitBlob: "2cc217cce9e39d597f6d7afad5b54b967db2ac80",
    mode: "100644",
    protects: "allowed confirm router suffix and prohibited legacy callback route",
  }),
  Object.freeze({
    path: "functions/api/src/server.ts",
    sha256: "97cdce68d5c96a876620a3e4e1339cfafeb5e06a9bb3161a11e2be6ea2508938",
    gitBlob: "3c0786c5444feb1ba876372a5a2dc5d9d826989c",
    mode: "100644",
    protects: "payments router mount at /payments",
  }),
] as const);

export const BANCARD_CONFIRM_SOURCE_BINDINGS = Object.freeze({
  baseCommit: "0c503b5dcbe334ebf1a79612d813f3f0f402e5b7",
  allowedRoute: "POST /payments/bancard/confirm",
  prohibitedRoute: "POST /payments/callback",
  files: SOURCE_FILES,
});

type CanonicalSourcePath = (typeof SOURCE_FILES)[number]["path"];

type SourceBindingErrorCode =
  | "invalid_repository_root"
  | "source_file_unavailable"
  | "source_sha256_mismatch"
  | "source_git_blob_mismatch"
  | "git_index_unavailable"
  | "git_index_entry_mismatch"
  | "git_mode_mismatch"
  | "git_blob_mismatch";

type SourceBindingResult = Readonly<{
  ok: boolean;
  baseCommit: string;
  verifiedBindingCount: number;
  errorCode: SourceBindingErrorCode | null;
  path: CanonicalSourcePath | null;
}>;

type GitIndexEntry = Readonly<{
  mode: string;
  blob: string;
  stage: string;
}>;

function bindingFailure(
  errorCode: SourceBindingErrorCode,
  path: CanonicalSourcePath | null = null,
  verifiedBindingCount = 0,
): SourceBindingResult {
  return Object.freeze({
    ok: false,
    baseCommit: BANCARD_CONFIRM_SOURCE_BINDINGS.baseCommit,
    verifiedBindingCount,
    errorCode,
    path,
  });
}

function gitBlobId(content: Buffer): string {
  const header = Buffer.from(`blob ${content.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(content).digest("hex");
}

function readGitIndex(repositoryRoot: string): Map<string, GitIndexEntry> | null {
  let output: string;
  try {
    output = execFileSync(
      "git",
      ["ls-files", "--stage", "--", ...SOURCE_FILES.map((binding) => binding.path)],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_OPTIONAL_LOCKS: "0",
          GIT_TERMINAL_PROMPT: "0",
        },
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      },
    );
  } catch {
    return null;
  }

  const lines = output.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length !== SOURCE_FILES.length) {
    return null;
  }

  const entries = new Map<string, GitIndexEntry>();
  for (const line of lines) {
    const match = /^([0-7]{6}) ([0-9a-f]{40}) ([0-3])\t(.+)$/.exec(line);
    if (!match) {
      return null;
    }

    const [, mode, blob, stage, path] = match;
    if (entries.has(path)) {
      return null;
    }

    entries.set(path, Object.freeze({ mode, blob, stage }));
  }

  return entries;
}

export function verifyBancardConfirmSourceBindings(
  repositoryRoot: string,
): SourceBindingResult {
  if (typeof repositoryRoot !== "string" || repositoryRoot.trim().length === 0) {
    return bindingFailure("invalid_repository_root");
  }

  const resolvedRepositoryRoot = resolve(repositoryRoot);
  let verifiedBindingCount = 0;

  for (const binding of SOURCE_FILES) {
    let content: Buffer;
    try {
      content = readFileSync(resolve(resolvedRepositoryRoot, ...binding.path.split("/")));
    } catch {
      return bindingFailure("source_file_unavailable", binding.path, verifiedBindingCount);
    }

    const sha256 = createHash("sha256").update(content).digest("hex");
    if (sha256 !== binding.sha256) {
      return bindingFailure("source_sha256_mismatch", binding.path, verifiedBindingCount);
    }

    if (gitBlobId(content) !== binding.gitBlob) {
      return bindingFailure("source_git_blob_mismatch", binding.path, verifiedBindingCount);
    }

    verifiedBindingCount += 1;
  }

  const index = readGitIndex(resolvedRepositoryRoot);
  if (!index) {
    return bindingFailure("git_index_unavailable", null, verifiedBindingCount);
  }

  for (const binding of SOURCE_FILES) {
    const entry = index.get(binding.path);
    if (!entry || entry.stage !== "0") {
      return bindingFailure("git_index_entry_mismatch", binding.path, verifiedBindingCount);
    }
    if (entry.mode !== binding.mode) {
      return bindingFailure("git_mode_mismatch", binding.path, verifiedBindingCount);
    }
    if (entry.blob !== binding.gitBlob) {
      return bindingFailure("git_blob_mismatch", binding.path, verifiedBindingCount);
    }
  }

  return Object.freeze({
    ok: true,
    baseCommit: BANCARD_CONFIRM_SOURCE_BINDINGS.baseCommit,
    verifiedBindingCount,
    errorCode: null,
    path: null,
  });
}
