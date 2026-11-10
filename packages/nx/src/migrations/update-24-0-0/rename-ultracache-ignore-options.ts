import type { MigrationReturnObject } from '../../config/misc-interfaces';
import type { TargetDefaultValue } from '../../config/nx-json';
import type { TargetConfiguration } from '../../config/workspace-json-project-json';
import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import type { Tree } from '../../generators/tree';
import {
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';

const RENAMED_ULTRACACHE_KEYS = new Map([
  ['ignoredReads', 'ignoreReads'],
  ['ignoredWrites', 'ignoreWrites'],
]);

const WORKFLOWS_DIR = '.nx/workflows';
const CONFIG_EXTENSIONS = ['yaml', 'yml'] as const;
const OLD_CONFIG_PATH = /(\.nx\/workflows\/)sandboxing-config\.(ya?ml)/g;

// Matches a block-style key at the start of a line or after a sequence dash,
// optionally quoted. Comments and values are left alone.
const OLD_YAML_KEY = /^(\s*(?:-\s+)?)(['"]?)exclude-(reads|writes)\2(\s*:)/gm;

export default async function update(
  tree: Tree
): Promise<MigrationReturnObject> {
  const manual: string[] = [];

  for (const [name, project] of getProjects(tree)) {
    let changed = false;
    for (const target of Object.values(project.targets ?? {})) {
      changed = renameUltracacheKeys(target) || changed;
    }
    const rewritten = rewriteConfigPaths(project);
    if (changed || rewritten !== project) {
      updateProjectConfiguration(tree, name, rewritten);
    }
  }

  const nxJson = readNxJson(tree);
  if (nxJson) {
    let changed = false;
    for (const value of Object.values(nxJson.targetDefaults ?? {})) {
      for (const entry of targetDefaultEntries(value)) {
        changed = renameUltracacheKeys(entry) || changed;
      }
    }
    const rewritten = rewriteConfigPaths(nxJson);
    if (changed || rewritten !== nxJson) {
      updateNxJson(tree, rewritten);
    }
  }

  manual.push(...renameWorkspaceConfig(tree));

  await formatChangedFiles(tree);

  if (manual.length === 0) {
    return { skipAgentic: true };
  }
  return { nextSteps: manual, agentContext: manual };
}

function targetDefaultEntries(
  value: TargetDefaultValue
): Partial<TargetConfiguration>[] {
  return Array.isArray(value) ? value : [value];
}

function renameUltracacheKeys(target: Partial<TargetConfiguration>): boolean {
  const ultracache = target?.ultracache as Record<string, unknown> | undefined;
  if (
    !ultracache ||
    typeof ultracache !== 'object' ||
    !Object.keys(ultracache).some((key) => RENAMED_ULTRACACHE_KEYS.has(key))
  ) {
    return false;
  }

  const renamed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ultracache)) {
    const newKey = RENAMED_ULTRACACHE_KEYS.get(key) ?? key;
    renamed[newKey] = mergePatterns(renamed[newKey], value);
  }
  target.ultracache = renamed as TargetConfiguration['ultracache'];
  return true;
}

// A target may already declare the new key beside the old one; keep both sets.
function mergePatterns(existing: unknown, incoming: unknown): unknown {
  if (existing === undefined) {
    return incoming;
  }
  if (!Array.isArray(existing) || !Array.isArray(incoming)) {
    return incoming;
  }
  return [...existing, ...incoming.filter((p) => !existing.includes(p))];
}

// Returns the same reference when nothing changed.
function rewriteConfigPaths<T>(value: T): T {
  if (typeof value === 'string') {
    const replaced = value.replace(OLD_CONFIG_PATH, '$1ultracache-config.$2');
    return (replaced === value ? value : replaced) as T;
  }
  if (Array.isArray(value)) {
    const mapped = value.map(rewriteConfigPaths);
    return (mapped.some((v, i) => v !== value[i]) ? mapped : value) as T;
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const mapped: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      mapped[key] = rewriteConfigPaths(v);
      changed ||= mapped[key] !== v;
    }
    return (changed ? mapped : value) as T;
  }
  return value;
}

function renameWorkspaceConfig(tree: Tree): string[] {
  const existingNew = CONFIG_EXTENSIONS.map(
    (ext) => `${WORKFLOWS_DIR}/ultracache-config.${ext}`
  ).filter((path) => tree.exists(path));
  const manual: string[] = [];

  for (const ext of CONFIG_EXTENSIONS) {
    const oldPath = `${WORKFLOWS_DIR}/sandboxing-config.${ext}`;
    if (!tree.exists(oldPath)) {
      continue;
    }
    if (existingNew.length > 0) {
      manual.push(
        `Both "${oldPath}" and "${existingNew[0]}" exist. Nx Cloud reads only "${existingNew[0]}", so merge the patterns from "${oldPath}" into it and delete "${oldPath}".`
      );
      continue;
    }
    const newPath = `${WORKFLOWS_DIR}/ultracache-config.${ext}`;
    tree.rename(oldPath, newPath);
    existingNew.push(newPath);
  }

  for (const path of existingNew) {
    const content = tree.read(path, 'utf-8') ?? '';
    const updated = content.replace(OLD_YAML_KEY, '$1$2ignore-$3$2$4');
    if (updated !== content) {
      tree.write(path, updated);
    }
    if (hasOldYamlKey(updated)) {
      manual.push(
        `"${path}" still uses "exclude-reads" or "exclude-writes" in a form the migration could not rewrite. Rename them to "ignore-reads" and "ignore-writes".`
      );
    }
  }

  return manual;
}

function hasOldYamlKey(content: string): boolean {
  return content
    .split('\n')
    .map((line) => line.replace(/#.*$/, ''))
    .some((line) => /['"]?exclude-(reads|writes)['"]?\s*:/.test(line));
}
