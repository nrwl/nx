import { minimatch } from 'minimatch';
import {
  extname,
  isAbsolute,
  normalize,
  relative,
  resolve,
  sep,
} from 'node:path';

import { getOutputsForTargetAndConfiguration } from '../../tasks-runner/utils';
import { isGlobPattern } from '../../utils/globs';

import type { ProjectConfiguration } from '../../config/workspace-json-project-json';

export const TS_SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.cts', '.mts']);

/**
 * Source entries register a source graph and pass tsconfig conditions to
 * isolated workers. A conditioned export the default resolution would not
 * select, or a TypeScript file, is source. A JavaScript file the default
 * resolution also selects is built under a build output, source under
 * `sourceRoot`, else built, so a dist-only package never gets a source graph.
 */
export function isSourceEntry(
  entryPath: string,
  selectedByCondition: boolean,
  project: ProjectConfiguration,
  root: string
): boolean {
  if (selectedByCondition || TS_SOURCE_EXTENSIONS.has(extname(entryPath))) {
    return true;
  }
  if (isBuildOutput(entryPath, project, root)) {
    return false;
  }
  return (
    !!project.sourceRoot &&
    isUnder(entryPath, resolve(root, project.sourceRoot))
  );
}

function isBuildOutput(
  entryPath: string,
  project: ProjectConfiguration,
  root: string
): boolean {
  const entry = toPosix(relative(root, entryPath));
  return getBuildOutputs(project).some((output) => {
    const normalized = normalizeOutput(output, root);
    if (normalized.glob !== undefined) {
      // Outputs expand hidden paths too (native globset has no dot rule).
      return (
        minimatch(entry, normalized.glob, { dot: true }) ||
        minimatch(entry, `${normalized.glob}/**`, { dot: true })
      );
    }
    const inside = relative(normalized.dir, entryPath);
    return (
      inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside)
    );
  });
}

// A plain output is a path, which may lie above the workspace. A glob
// keeps its minimatch tail; only the literal prefix is resolved, so `./`,
// `..`, trailing and Windows separators settle without touching `{a/../b,c}`.
function normalizeOutput(
  output: string,
  root: string
): { dir: string; glob?: undefined } | { glob: string; dir?: undefined } {
  const segments = toPosix(output).split('/');
  const globIndex = segments.findIndex(isOutputGlob);
  const literal = (
    globIndex === -1 ? segments : segments.slice(0, globIndex)
  ).join('/');
  // A glob directly below `/` or `C:/` leaves a literal that `resolve` would
  // anchor to the workspace instead of the filesystem root.
  const anchored =
    literal === '' && segments[0] === ''
      ? '/'
      : /^[A-Za-z]:$/.test(literal)
        ? `${literal}/`
        : literal;
  if (globIndex === -1) {
    return { dir: resolve(root, anchored) };
  }
  const prefix =
    anchored === '' ? '' : toPosix(relative(root, resolve(root, anchored)));
  return {
    glob: [...(prefix ? [prefix] : []), ...segments.slice(globIndex)].join('/'),
  };
}

// `?` is a glob in outputs but not in `isGlobPattern`, which serves project
// name patterns.
function isOutputGlob(pattern: string): boolean {
  return isGlobPattern(pattern) || pattern.includes('?');
}

function getBuildOutputs(project: ProjectConfiguration): string[] {
  const node = {
    name: project.name ?? '',
    type: 'lib' as const,
    data: project,
  };
  const outputs: string[] = [];
  for (const [target, targetConfig] of Object.entries(project.targets ?? {})) {
    // The helper reads only the named configuration, so visit each one.
    for (const configuration of [
      undefined,
      ...Object.keys(targetConfig?.configurations ?? {}),
    ]) {
      let targetOutputs: string[];
      try {
        targetOutputs = getOutputsForTargetAndConfiguration(
          { project: node.name, target, configuration },
          {},
          node
        );
      } catch {
        // Invalid outputs fail the task itself; they must not fail resolution.
        continue;
      }
      // A negated output excludes files from the cache; it places nothing.
      outputs.push(...targetOutputs.filter((o) => !o.startsWith('!')));
    }
  }
  return outputs;
}

function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

function isUnder(entryPath: string, dir: string): boolean {
  const entry = normalize(entryPath);
  const normalizedDir = normalize(dir);
  return entry === normalizedDir || entry.startsWith(normalizedDir + sep);
}
