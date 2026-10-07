import type {
  ExecutorsJson,
  MigrationReturnObject,
} from '../../config/misc-interfaces';
import { globAsync } from '../../generators/utils/glob';
import type { Tree } from '../../generators/tree';
import { parseJson } from '../../utils/json';
import type { PackageJson } from '../../utils/package-json';
import { joinPathFragments } from '../../utils/path';
import { posix } from 'node:path';

const DOCS_URL = 'https://nx.dev/docs/kb/local-executors#using-custom-hashers';

export default async function findCustomHashers(
  tree: Tree
): Promise<MigrationReturnObject> {
  const hits = new Set<string>();
  const malformed = new Set<string>();
  const unparseable: string[] = [];
  const visited = new Set<string>();

  for (const packageJsonPath of await globAsync(tree, ['**/package.json'])) {
    if (packageJsonPath.split('/').includes('node_modules')) {
      continue;
    }
    const content = tree.read(packageJsonPath, 'utf-8');
    if (!content.includes('"executors"') && !content.includes('"builders"')) {
      continue;
    }
    const packageJson = tryParse<PackageJson>(content);
    if (!packageJson) {
      unparseable.push(packageJsonPath);
      continue;
    }

    const packageRoot = posix.dirname(packageJsonPath);
    for (const field of [packageJson.executors, packageJson.builders]) {
      if (typeof field !== 'string') {
        continue;
      }
      const executorsJsonPath = joinPathFragments(packageRoot, field);
      if (visited.has(executorsJsonPath) || !tree.exists(executorsJsonPath)) {
        continue;
      }
      visited.add(executorsJsonPath);

      const executorsJson = tryParse<ExecutorsJson>(
        tree.read(executorsJsonPath, 'utf-8')
      );
      if (!executorsJson) {
        unparseable.push(executorsJsonPath);
        continue;
      }

      const entries: [string, unknown][] = [];
      for (const map of [executorsJson.executors, executorsJson.builders]) {
        if (map === undefined) {
          continue;
        }
        if (!isPlainObject(map)) {
          unparseable.push(executorsJsonPath);
          break;
        }
        entries.push(...Object.entries(map));
      }
      for (const [name, entry] of entries) {
        if (typeof entry === 'string') {
          continue;
        }
        if (!isPlainObject(entry) || !isValidHasher(entry.hasher)) {
          malformed.add(
            `Entry "${name}" in "${executorsJsonPath}" is not a valid executor entry. Check it by hand for a "hasher".`
          );
          continue;
        }
        if (entry.hasher === undefined) {
          continue;
        }
        const hasherPath = joinPathFragments(
          posix.dirname(executorsJsonPath),
          entry.hasher
        );
        hits.add(
          `Executor "${packageJson.name ?? packageRoot}:${name}" declares a custom hasher at "${hasherPath}" in "${executorsJsonPath}".`
        );
      }
    }
  }

  if (hits.size === 0 && malformed.size === 0 && unparseable.length === 0) {
    return { skipAgentic: true };
  }

  const manualNotes = [
    ...malformed,
    ...unparseable.map(
      (path) =>
        `Could not parse "${path}". Check it by hand for executors that declare a "hasher".`
    ),
  ];
  return {
    nextSteps: [
      `Custom hashers are deprecated and will be removed in Nx 25. Replace each one with target inputs, then remove "hasher" from executors.json. See ${DOCS_URL}`,
      ...hits,
      ...manualNotes,
    ],
    agentContext: [...hits, ...manualNotes],
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidHasher(hasher: unknown): hasher is string | undefined {
  return hasher === undefined || typeof hasher === 'string';
}

function tryParse<T extends object>(content: string): T | null {
  try {
    return parseJson<T>(content);
  } catch {
    return null;
  }
}
