import {
  createNodesFromFiles,
  DependencyType,
  readJsonFile,
  validateDependency,
  workspaceRoot,
} from '@nx/devkit';
import type { CreateDependencies, CreateNodes } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';

/**
 * Registers standalone example workspaces in this repo's project graph.
 *
 * Examples like examples/react/basic are standalone Nx + pnpm workspaces
 * (their own nx.json and lockfile, excluded from the root pnpm workspace) so
 * that the local @nx/* packages they link: drive their target inference.
 * That also means this repo's graph cannot see them through the regular
 * plugins; this plugin adds a thin handle for each: a project node with a
 * `validate-example` wrapper target, plus implicit dependencies derived from the
 * example's link: dependencies so `nx affected` runs the example when the
 * packages it consumes change.
 *
 * A nested nx.json is what makes a directory a standalone workspace, so its
 * presence under examples/ is the marker — no extra config file needed. This
 * lives here (rather than a project.json in the example) because the
 * example's own workspace would also read a project.json, and implicit
 * dependencies on projects that only exist in this repo's graph would fail
 * validation there.
 */

const EXAMPLE_WORKSPACES_GLOB = 'examples/**/nx.json';

export const createNodes: CreateNodes = [
  EXAMPLE_WORKSPACES_GLOB,
  (configFiles, _options, context) => {
    return createNodesFromFiles(
      (configFile) => {
        const exampleRoot = dirname(configFile);
        const packageJson = readPackageJson(context.workspaceRoot, exampleRoot);
        if (!packageJson?.name) {
          return {};
        }
        return {
          projects: {
            [exampleRoot]: {
              name: packageJson.name,
              projectType: 'application' as const,
              targets: {
                'validate-example': {
                  // --ignore-scripts: the example's postinstall builds the
                  // linked packages through the repo root, which dependsOn
                  // ^build already guarantees here; skipping it keeps the
                  // sandboxed task from spawning a root-workspace nx run
                  // with unpredictable config reads.
                  command: 'pnpm install --ignore-scripts && pnpm validate',
                  options: {
                    cwd: exampleRoot,
                    env: {
                      // The examples are standalone workspaces with no Nx
                      // Cloud workspace; without this they inherit the repo's
                      // CI access token and abort with a 401.
                      NX_NO_CLOUD: 'true',
                    },
                  },
                  dependsOn: ['^build'],
                  inputs: [
                    'default',
                    '^production',
                    {
                      dependentTasksOutputFiles: '**/*',
                      transitive: true,
                    },
                  ],
                  // The inner build/e2e write dist inside the example
                  // (module-federation members write <member>/dist).
                  outputs: ['{projectRoot}/dist', '{projectRoot}/*/dist'],
                  cache: true,
                },
              },
            },
          },
        };
      },
      configFiles,
      _options,
      context
    );
  },
];

export const createDependencies: CreateDependencies = (_options, context) => {
  const projectsByRoot = new Map<string, string>();
  for (const [name, project] of Object.entries(context.projects)) {
    projectsByRoot.set(project.root, name);
  }

  const deps = [];
  for (const [name, project] of Object.entries(context.projects)) {
    if (
      !project.root.startsWith('examples/') ||
      !existsSync(join(workspaceRoot, project.root, 'nx.json'))
    ) {
      continue;
    }
    const packageJson = readPackageJson(workspaceRoot, project.root);
    if (!packageJson) {
      continue;
    }
    for (const linkedRoot of getLinkedPackageRoots(packageJson, project.root)) {
      const target = projectsByRoot.get(linkedRoot);
      if (!target || target === name) {
        continue;
      }
      const dep = {
        source: name,
        target,
        type: DependencyType.implicit as const,
      };
      validateDependency(dep, context);
      deps.push(dep);
    }
  }
  return deps;
};

function readPackageJson(
  root: string,
  projectRoot: string
): { name?: string; [key: string]: unknown } | null {
  const path = join(root, projectRoot, 'package.json');
  return existsSync(path) ? readJsonFile(path) : null;
}

/**
 * Roots (workspace-relative) of the local packages an example wires in via
 * link: dependencies, e.g. `"@nx/vite": "link:../../../packages/vite"`.
 */
function getLinkedPackageRoots(
  packageJson: Record<string, any>,
  exampleRoot: string
): string[] {
  const roots = [];
  for (const section of [
    packageJson.dependencies,
    packageJson.devDependencies,
  ]) {
    for (const version of Object.values(section ?? {})) {
      if (typeof version === 'string' && version.startsWith('link:')) {
        roots.push(posix.join(exampleRoot, version.slice('link:'.length)));
      }
    }
  }
  return roots;
}
