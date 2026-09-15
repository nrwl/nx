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
import { toRootSpelling } from './built-entry-resolution-hint';

import type { ProjectConfiguration } from '../../config/workspace-json-project-json';

export const TS_SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.cts', '.mts']);

/**
 * Conditioned-only or TypeScript entries are source. Otherwise an entry under
 * a build output is built, under `sourceRoot` is source, and anything else is
 * built.
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
    isUnder(toRootSpelling(entryPath, root), resolve(root, project.sourceRoot))
  );
}

const outputsBySnapshot = new WeakMap<
  Record<string, ProjectConfiguration>,
  Array<[ProjectConfiguration, string[]]>
>();

/**
 * The projects declaring an output that contains the entry. Serves entries
 * whose declaring project is unknown, since output may land in another
 * project's `sourceRoot`.
 */
export function findDeclaredOutputOwners(
  entryPath: string,
  projects: Record<string, ProjectConfiguration>,
  root: string
): ProjectConfiguration[] {
  let outputs = outputsBySnapshot.get(projects);
  if (!outputs) {
    outputs = Object.values(projects).map((project) => [
      project,
      getBuildOutputs(project),
    ]);
    outputsBySnapshot.set(projects, outputs);
  }
  return outputs
    .filter(([, declared]) => containsEntry(entryPath, declared, root))
    .map(([project]) => project);
}

function isBuildOutput(
  entryPath: string,
  project: ProjectConfiguration,
  root: string
): boolean {
  return containsEntry(entryPath, getBuildOutputs(project), root);
}

function containsEntry(
  entryPath: string,
  outputs: string[],
  root: string
): boolean {
  // Root respelling can move an entry outside an absolute ancestor output.
  const candidates = [...new Set([toRootSpelling(entryPath, root), entryPath])];
  const entries = candidates.map((candidate) =>
    toPosix(relative(root, candidate))
  );
  return outputs.some((output) => {
    const normalized = normalizeOutput(output, root);
    if (normalized.glob !== undefined) {
      // Outputs expand hidden paths too (native globset has no dot rule).
      return entries.some(
        (entry) =>
          minimatch(entry, normalized.glob, { dot: true }) ||
          minimatch(entry, `${normalized.glob}/**`, { dot: true })
      );
    }
    return candidates.some((candidate) => {
      const inside = relative(normalized.dir, candidate);
      return (
        inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside)
      );
    });
  });
}

// Outputs may lie above the workspace. Only a glob's literal prefix is
// resolved, so `{a/../b,c}` keeps its brace pattern.
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
  const directory = isAbsolute(anchored)
    ? toRootSpelling(anchored, root)
    : resolve(root, anchored);
  if (globIndex === -1) {
    return { dir: directory };
  }
  const prefix = anchored === '' ? '' : toPosix(relative(root, directory));
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
