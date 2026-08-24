import { createRequire } from 'node:module';

const Module: any = require('node:module');

const registry = new Map<string, any>();
let installed = false;

function install() {
  if (installed) return;
  installed = true;
  const origLoad = Module._load;
  Module._load = function (request: string, parent: any, isMain: boolean) {
    if (registry.size) {
      try {
        const resolved = Module._resolveFilename(request, parent, isMain);
        if (registry.has(resolved)) {
          return registry.get(resolved);
        }
      } catch {
        // fall through to the real loader for unresolvable specifiers
      }
    }
    return origLoad.apply(this, arguments);
  };
}

/**
 * Replace a module in the CJS require channel (the channel nx source's lazy
 * `require()` calls use), which vi.mock cannot reach. The swc-node require
 * hook emits getter-only exports, so mutation is not an option — this swaps
 * the whole module object, like jest's registry did.
 *
 * Vitest runs each test file in its own forked process, so registrations do
 * not leak across files.
 */
export function mockCjsModule(
  importMetaUrl: string,
  specifier: string,
  exportsObj: any
): void {
  install();
  const req = createRequire(importMetaUrl);
  const resolved = req.resolve(specifier);
  registry.set(resolved, exportsObj);
  delete req.cache[resolved];
}

/**
 * Undo a single `mockCjsModule` registration. `vi.unmock` cannot do this - it
 * knows nothing about this registry - so a spec that swaps a module for one
 * test must call this, or the swap leaks into every later test in the file.
 */
export function unmockCjsModule(
  importMetaUrl: string,
  specifier: string
): void {
  const req = createRequire(importMetaUrl);
  const resolved = req.resolve(specifier);
  registry.delete(resolved);
  // The registry short-circuits before the loader caches anything, so drop any
  // stale entry too and let the next require load the real module.
  delete req.cache[resolved];
}

/** Undo every registration; convenient from an `afterEach`. */
export function resetCjsMocks(): void {
  registry.clear();
}
