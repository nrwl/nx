import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Node evaluates a CommonJS file imported from ESM with its own internal
// loader once a `module.registerHooks()` hook is installed, and the `require`
// that loader hands the file has no `cache`. Playwright installs such a hook,
// so this is the environment every ESM Playwright config loads nx in.
const hasSyncHooks =
  typeof (require("node:module") as any).registerHooks === "function";

describe("native loader", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nx-native-loader-"));
    // The loader with stubs for everything it requires, so the test needs no
    // compiled TypeScript and no native binary.
    mkdirSync(join(dir, "native"));
    mkdirSync(join(dir, "utils"));
    writeFileSync(
      join(dir, "native", "index.js"),
      readFileSync(join(__dirname, "index.js")),
    );
    writeFileSync(
      join(dir, "native", "native-bindings.js"),
      "module.exports = { loaded: true };",
    );
    writeFileSync(
      join(dir, "native", "native-file-cache-location.js"),
      "module.exports = { ensureSecureNativeFileCacheLocation: () => {} };",
    );
    writeFileSync(
      join(dir, "utils", "versions.js"),
      "module.exports = { nxVersion: '0.0.0' };",
    );
    writeFileSync(
      join(dir, "hook.mjs"),
      [
        "import { registerHooks } from 'node:module';",
        "registerHooks({ load: (url, context, next) => next(url, context) });",
      ].join("\n"),
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function importUnderHook(): string {
    const entry = pathToFileURL(join(dir, "native", "index.js")).href;
    return execFileSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(join(dir, "hook.mjs")).href,
        "--input-type=module",
        "-e",
        `import('${entry}').then((m) => console.log(JSON.stringify(m.default)))`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  }

  (hasSyncHooks ? it : it.skip)(
    "loads when imported from ESM under a module.registerHooks() hook",
    () => {
      expect(importUnderHook().trim()).toBe('{"loaded":true}');
    },
  );
});
