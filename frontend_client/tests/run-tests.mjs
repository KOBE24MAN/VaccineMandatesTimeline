import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
// Reuse the compiler already provided by Vite; no separate test runtime needed.
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { buildSync } = viteRequire("esbuild");
const directory = mkdtempSync(join(tmpdir(), "mandeval-tests-"));
try {
  const outfile = join(directory, "tests.cjs");
  buildSync({
    entryPoints: ["tests/mandates.test.tsx"],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    logLevel: "warning",
  });
  const result = spawnSync(process.execPath, ["--test", outfile], {
    stdio: "inherit",
  });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
