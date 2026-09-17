import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseDocument, YAMLMap } from 'yaml';
import { gte } from 'semver';
import type { Tree } from '../generators/tree';
import type { PackageManager } from './package-manager';
import {
  getPackageManagerVersion,
  packageRegistryView,
  parseVersionFromPackageManagerField,
} from './package-manager';
import { readJsonFile } from './fileutils';
import { parseJson } from './json';
import { output } from './output';

const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';

/**
 * Records build-script decisions for dependencies that are about to be
 * installed, in whatever form the given package manager understands.
 *
 * Only pnpm needs this today: pnpm 11+ refuses to install a dependency whose
 * build scripts are neither allowed nor denied, so the generator or command
 * that introduces such a dependency records the decision up front. Other
 * package managers run build scripts unconditionally, so this is a no-op for
 * them.
 *
 * @param treeOrRoot The workspace tree, or its root on disk.
 * @param packageManager The workspace package manager.
 * @param entries Package name to decision: `true` runs the package's build
 * scripts, `false` skips them. Entries the user already decided are kept.
 * @param directory Workspace root relative to the tree root, for generators
 * that scaffold a workspace into a subdirectory.
 *
 * @example
 * ```typescript
 * acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
 *   esbuild: false,
 *   cypress: true,
 * });
 * ```
 */
export function acknowledgeBuildScripts(
  treeOrRoot: Tree | string,
  packageManager: PackageManager,
  entries: Record<string, boolean>,
  directory: string = ''
): void {
  if (packageManager !== 'pnpm') {
    return;
  }
  const host = createHost(treeOrRoot, directory);
  const pnpmVersion = getPnpmVersion(host);
  if (!pnpmVersion || !gte(pnpmVersion, '11.0.0')) {
    return;
  }
  acknowledgePnpmBuildScripts(host, entries);
}

/**
 * Records the build-script decisions a package declares for its own
 * dependency tree, so the install that first pulls the package in can stay
 * strict. A package declares them in the `pnpm.allowBuilds` field of its
 * package.json, the same shape pnpm reads from a workspace root; pnpm ignores
 * the field on dependencies, so it is read from the registry here.
 *
 * A `true` entry lets pnpm run that package's install scripts on every later
 * install, so the entries recorded here are printed for the user to see.
 *
 * Resolves to whether the package declared any decision. Nothing is recorded
 * for package managers other than pnpm, pnpm < 11, packages that declare
 * nothing, and specs the registry cannot answer, such as a tarball path.
 */
export async function acknowledgeDeclaredBuildScripts(
  treeOrRoot: Tree | string,
  packageManager: PackageManager,
  packageName: string,
  version: string,
  directory: string = ''
): Promise<boolean> {
  if (packageManager !== 'pnpm') {
    return false;
  }
  const host = createHost(treeOrRoot, directory);
  const pnpmVersion = getPnpmVersion(host);
  if (!pnpmVersion || !gte(pnpmVersion, '11.0.0')) {
    return false;
  }
  const entries = await readDeclaredBuildScripts(packageName, version);
  if (Object.keys(entries).length === 0) {
    return false;
  }
  const recorded = acknowledgePnpmBuildScripts(host, entries);
  if (Object.keys(recorded).length > 0) {
    output.note({
      title: `Recorded the build-script decisions ${packageName}@${version} declares in ${PNPM_WORKSPACE_FILE}`,
      bodyLines: Object.entries(recorded).map(
        ([pkg, allowed]) => `${pkg}: ${allowed}`
      ),
    });
  }
  return true;
}

async function readDeclaredBuildScripts(
  packageName: string,
  version: string
): Promise<Record<string, boolean>> {
  let declared: unknown;
  try {
    const output = await packageRegistryView(packageName, version, [
      'pnpm.allowBuilds',
      '--json',
    ]);
    declared = output ? JSON.parse(output) : undefined;
  } catch {
    return {};
  }
  // A range matches several versions; the view lists them lowest first.
  if (Array.isArray(declared)) {
    declared = declared[declared.length - 1];
  }
  if (declared == null || typeof declared !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(declared).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
    )
  );
}

/**
 * Records `allowBuilds` decisions in pnpm-workspace.yaml, creating the file
 * when missing (mirroring `pnpm approve-builds` in single-package repos).
 * Returns the entries it wrote.
 *
 * Comment-preserving. Existing entries are never overwritten, so user
 * decisions always win. pnpm < 11 warns instead of erroring and does not read
 * `allowBuilds`, so callers gate on the version first.
 */
function acknowledgePnpmBuildScripts(
  host: Host,
  entries: Record<string, boolean>
): Record<string, boolean> {
  const parsed = parseDocument(
    host.exists(PNPM_WORKSPACE_FILE) ? host.read(PNPM_WORKSPACE_FILE) : ''
  );
  // A file that doesn't parse cleanly or whose root isn't a mapping is
  // malformed for pnpm; leave it alone rather than crashing or replacing the
  // user's content. pnpm's own error on the file is the actionable signal.
  // Empty and comment-only files have no contents at all; setIn creates the
  // mapping for them while keeping whatever comments they carry.
  if (
    parsed.errors.length > 0 ||
    (parsed.contents != null && !(parsed.contents instanceof YAMLMap))
  ) {
    return {};
  }

  const recorded: Record<string, boolean> = {};
  for (const [pkg, allowed] of Object.entries(entries)) {
    // Only a real boolean is a user decision. pnpm's non-strict installs stub
    // undecided packages with a placeholder string ("set this to true or
    // false"), which would fail the next strict install if left in place.
    if (typeof parsed.getIn(['allowBuilds', pkg]) !== 'boolean') {
      parsed.setIn(['allowBuilds', pkg], allowed);
      recorded[pkg] = allowed;
    }
  }
  if (Object.keys(recorded).length > 0) {
    host.write(PNPM_WORKSPACE_FILE, parsed.toString());
  }
  return recorded;
}

interface Host {
  root: string;
  exists(path: string): boolean;
  read(path: string): string;
  write(path: string, content: string): void;
  readJson(path: string): any;
}

function createHost(treeOrRoot: Tree | string, directory: string): Host {
  if (typeof treeOrRoot === 'string') {
    const root = join(treeOrRoot, directory);
    return {
      root,
      exists: (p) => existsSync(join(root, p)),
      read: (p) => readFileSync(join(root, p), 'utf-8'),
      write: (p, c) => writeFileSync(join(root, p), c),
      readJson: (p) => readJsonFile(join(root, p)),
    };
  }
  // The directory may not exist on disk yet (a workspace being scaffolded
  // into it), so the package manager is probed from the tree root.
  return {
    root: treeOrRoot.root,
    exists: (p) => treeOrRoot.exists(join(directory, p)),
    read: (p) => treeOrRoot.read(join(directory, p), 'utf-8'),
    write: (p, c) => treeOrRoot.write(join(directory, p), c),
    readJson: (p) => parseJson(treeOrRoot.read(join(directory, p), 'utf-8')),
  };
}

function getPnpmVersion(host: Host): string | null {
  // The host's packageManager field wins: during workspace creation the
  // in-flight package.json only exists in the tree, not on disk.
  if (host.exists('package.json')) {
    const { packageManager } = host.readJson('package.json');
    const version = parseVersionFromPackageManagerField(
      'pnpm',
      typeof packageManager === 'string' ? packageManager : undefined
    );
    if (version) {
      return version;
    }
  }
  try {
    return getPackageManagerVersion('pnpm', host.root);
  } catch {
    // The version cannot be probed (e.g. pnpm is not on PATH). Leave the
    // workspace file untouched; pnpm's own install error remains actionable.
    return null;
  }
}
