import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Resolves `nx` and `@nx/*` specifiers to this repo's TypeScript source, the
 * job `scripts/patched-jest-resolver.js` does for the jest suites.
 *
 * A bare `resolve.conditions: ['@nx/nx-source']` is not enough: the installed
 * `node_modules/@nx/*` are the *published* tarballs (dist only, no source), so
 * the condition points at files that are not there. Only a package's own
 * manifest under `packages/` names the source entry.
 */

const repoRoot = resolve(import.meta.dirname, '..', '..');
const packagesDir = join(repoRoot, 'packages');
const SOURCE_CONDITION = '@nx/nx-source';
const EXTENSIONS = ['.ts', '.tsx', '.js', '.json'];

const packageDirsByName = new Map<string, string>();
for (const entry of readdirSync(packagesDir)) {
  const manifest = join(packagesDir, entry, 'package.json');
  if (!existsSync(manifest)) continue;
  const { name } = JSON.parse(readFileSync(manifest, 'utf8'));
  if (name) packageDirsByName.set(name, join(packagesDir, entry));
}

const isFile = (p: string) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

const resolveFile = (base: string) => {
  for (const candidate of [
    base,
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ]) {
    if (isFile(candidate)) return candidate;
  }
  return null;
};

/** The `@nx/nx-source` target for `subpath`, or null when unexported. */
function sourceTargetFor(pkgDir: string, subpath: string): string | null {
  const { exports } = JSON.parse(
    readFileSync(join(pkgDir, 'package.json'), 'utf8')
  );
  if (!exports) return null;

  const pick = (target: unknown): string | null => {
    if (typeof target === 'string') return target;
    if (target && typeof target === 'object') {
      return (target as Record<string, string>)[SOURCE_CONDITION] ?? null;
    }
    return null;
  };

  if (exports[subpath]) return pick(exports[subpath]);

  // Wildcard entries, e.g. "./presets/*": { "@nx/nx-source": "./presets/*.json" }
  for (const [pattern, target] of Object.entries(exports)) {
    const star = pattern.indexOf('*');
    if (star === -1) continue;
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) continue;
    const match = subpath.slice(prefix.length, subpath.length - suffix.length);
    const picked = pick(target);
    if (picked) return picked.replace('*', match);
  }
  return null;
}

/**
 * The source file `specifier` names, or null when it is not a workspace
 * package. Used for vite's module graph and for node's `require`, which must
 * agree: a module loaded through both channels twice is two instances, and
 * only one of them carries a spec's mocks.
 */
export function resolveNxSourceSpecifier(specifier: string): string | null {
  const match = /^(nx|@nx\/[^/]+)(\/.*)?$/.exec(specifier);
  if (!match) return null;
  const pkgDir = packageDirsByName.get(match[1]);
  if (!pkgDir) return null;

  const subpath = match[2] ? `.${match[2]}` : '.';
  const target = sourceTargetFor(pkgDir, subpath);
  if (target) return resolveFile(join(pkgDir, target));

  // Deep imports the exports map does not cover (`@nx/workspace/src/...`,
  // `nx/src/...`). The published package ships no `src`, so tests can only
  // mean the source tree.
  return match[2] ? resolveFile(join(pkgDir, match[2])) : null;
}

export function nxSourceResolver(): Plugin {
  return {
    name: 'nx-source-resolver',
    enforce: 'pre',
    resolveId(source) {
      return resolveNxSourceSpecifier(source);
    },
  };
}
