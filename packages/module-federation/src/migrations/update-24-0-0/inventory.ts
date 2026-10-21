import {
  removeDependenciesFromPackageJson,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { dirname, extname, join } from 'node:path/posix';

export type Framework = 'react' | 'angular';

const SCANNED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
]);

// Name the package without using it.
const SKIPPED_FILES = new Set([
  'migrations.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
]);

const ANGULAR_MARKERS = [
  '@nx/module-federation/angular',
  '@nx/angular/mf',
  '@nx/angular:module-federation-dev-server',
  '@nx/angular:module-federation-dev-ssr',
];

const REACT_MARKERS = [
  '@nx/module-federation/webpack',
  '@nx/module-federation/rspack',
  '@nx/react/mf',
  '@nx/react/module-federation',
  '@nx/rspack/module-federation',
  '@nx/react:module-federation-',
  '@nx/rspack:module-federation-',
];

// Root, `/url-helpers` and `/internal` imports say nothing about the framework.
const SHARED_MARKER =
  /['"]@nx\/module-federation(\/url-helpers|\/internal)?['"]/;

const SSR_MARKERS = [
  'withModuleFederationForSSR',
  'NxModuleFederationSSRDevServerPlugin',
  'module-federation-ssr-dev-server',
  'module-federation-dev-ssr',
];

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

export interface ModuleFederationUsage {
  projectRoot: string;
  files: string[];
  ssr: boolean;
}

export type ModuleFederationInventory = Record<
  Framework,
  ModuleFederationUsage[]
>;

export function inventoryModuleFederation(
  tree: Tree
): ModuleFederationInventory {
  const byProject = new Map<
    string,
    { frameworks: Set<Framework>; files: string[]; ssr: boolean }
  >();

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!SCANNED_EXTENSIONS.has(extname(filePath))) return;
    if (SKIPPED_FILES.has(filePath)) return;

    const content = readScannableContent(tree, filePath);
    if (!content) return;

    const frameworks = new Set<Framework>();
    if (ANGULAR_MARKERS.some((m) => content.includes(m))) {
      frameworks.add('angular');
    }
    if (REACT_MARKERS.some((m) => content.includes(m))) {
      frameworks.add('react');
    }
    if (frameworks.size === 0 && !SHARED_MARKER.test(content)) return;

    const projectRoot = findProjectRoot(tree, filePath);
    const usage = byProject.get(projectRoot) ?? {
      frameworks: new Set<Framework>(),
      files: [],
      ssr: false,
    };
    frameworks.forEach((f) => usage.frameworks.add(f));
    usage.files.push(filePath);
    usage.ssr ||= SSR_MARKERS.some((m) => content.includes(m));
    byProject.set(projectRoot, usage);
  });

  const inventory: ModuleFederationInventory = { react: [], angular: [] };
  for (const [projectRoot, usage] of byProject) {
    // Projects with only shared-entry imports are listed for both prompts to triage.
    const frameworks: Framework[] =
      usage.frameworks.size > 0 ? [...usage.frameworks] : ['react', 'angular'];
    for (const framework of frameworks) {
      inventory[framework].push({
        projectRoot,
        files: usage.files.sort(),
        ssr: usage.ssr,
      });
    }
  }
  return inventory;
}

// Nothing left to migrate, so the dependency can go without an agent.
export function removeUnusedModuleFederationPackage(
  tree: Tree,
  inventory: ModuleFederationInventory
): boolean {
  if (inventory.react.length > 0 || inventory.angular.length > 0) {
    return false;
  }
  if (!tree.exists('package.json')) return false;
  const before = tree.read('package.json', 'utf-8');
  removeDependenciesFromPackageJson(
    tree,
    ['@nx/module-federation'],
    ['@nx/module-federation']
  );
  return tree.read('package.json', 'utf-8') !== before;
}

export function describeUsage(usage: ModuleFederationUsage): string {
  return `${usage.projectRoot || '.'}${usage.ssr ? ' (server-side rendering)' : ''}: ${usage.files.join(', ')}`;
}

function readScannableContent(tree: Tree, filePath: string): string | null {
  const content = tree.read(filePath, 'utf-8');
  if (!content || !content.includes('@nx/')) return null;
  if (!filePath.endsWith('package.json')) return content;

  // A declared dependency is not usage; package.json only counts for its `nx` targets.
  try {
    const packageJson = JSON.parse(content);
    for (const field of DEPENDENCY_FIELDS) delete packageJson[field];
    return JSON.stringify(packageJson);
  } catch {
    return content;
  }
}

function findProjectRoot(tree: Tree, filePath: string): string {
  let dir = dirname(filePath);
  while (dir !== '.' && dir !== '') {
    if (
      tree.exists(join(dir, 'project.json')) ||
      tree.exists(join(dir, 'package.json'))
    ) {
      return dir;
    }
    dir = dirname(dir);
  }
  return '';
}
