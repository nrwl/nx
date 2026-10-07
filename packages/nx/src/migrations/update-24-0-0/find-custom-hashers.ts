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

      const entries = [
        ...Object.entries(executorsJson.executors ?? {}),
        ...Object.entries(executorsJson.builders ?? {}),
      ];
      for (const [name, entry] of entries) {
        if (typeof entry !== 'object' || typeof entry.hasher !== 'string') {
          continue;
        }
        const hasherPath = joinPathFragments(
          posix.dirname(executorsJsonPath),
          entry.hasher
        );
        hits.add(
          `Executor "${packageJson.name}:${name}" declares a custom hasher at "${hasherPath}" in "${executorsJsonPath}".`
        );
      }
    }
  }

  if (hits.size === 0 && unparseable.length === 0) {
    return { skipAgentic: true };
  }

  const unparseableNotes = unparseable.map(
    (path) =>
      `Could not parse "${path}". Check it by hand for executors that declare a "hasher".`
  );
  return {
    nextSteps: [
      `Custom hashers are deprecated and will be removed in Nx 25. Replace each one with target inputs, then remove "hasher" from executors.json. See ${DOCS_URL}`,
      ...hits,
      ...unparseableNotes,
    ],
    agentContext: [...hits, ...unparseableNotes],
  };
}

function tryParse<T extends object>(content: string): T | null {
  try {
    return parseJson<T>(content);
  } catch {
    return null;
  }
}
