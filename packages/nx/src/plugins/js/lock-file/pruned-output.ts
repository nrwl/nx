import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'fs';
import { isAbsolute, join, posix, relative, sep } from 'path';
import { getCatalogManager } from '../../../utils/catalog';
import {
  fileExists,
  readJsonFile,
  readYamlFile,
} from '../../../utils/fileutils';
import { logger } from '../../../utils/logger';
import { output } from '../../../utils/output';
import type { Lockfile } from '@pnpm/lockfile-types';
import type {
  PackageJson,
  PackageJsonDependencySection,
} from '../../../utils/package-json';
import { getPackageManagerVersion } from '../../../utils/package-manager';
import { normalizePath } from '../../../utils/path';
import { workspaceRoot } from '../../../utils/workspace-root';
import { extractMainLockfileDocument } from './utils/pnpm-normalizer';

type PnpmManifestConfigField = keyof NonNullable<PackageJson['pnpm']>;
export type PnpmLockfileConfigField = keyof Lockfile | 'catalogs';

/**
 * The resolution-time pnpm config a pruned standalone output must not carry,
 * with the name each emitted file gives it: `manifest` is the `pnpm.*` key in
 * `package.json`, `lockfile` the top-level lockfile key, and `null` means that
 * file never declares the field. The two names differ often enough
 * (`packageExtensions` against `packageExtensionsChecksum`) that pairing them
 * in one table is what keeps the manifest strip and the lockfile strip from
 * drifting apart when pnpm adds a field.
 *
 * `patchedDependencies` is deliberately absent: it is filtered and re-declared
 * against the shipped patch files rather than dropped.
 */
const PNPM_RESOLUTION_CONFIG: readonly {
  manifest: PnpmManifestConfigField | null;
  lockfile: PnpmLockfileConfigField;
}[] = [
  { manifest: 'overrides', lockfile: 'overrides' },
  {
    manifest: 'ignoredOptionalDependencies',
    lockfile: 'ignoredOptionalDependencies',
  },
  { manifest: 'packageExtensions', lockfile: 'packageExtensionsChecksum' },
  { manifest: null, lockfile: 'pnpmfileChecksum' },
  { manifest: null, lockfile: 'settings' },
  { manifest: null, lockfile: 'catalogs' },
];

/** The `pnpm.*` manifest keys a pruned output drops. */
const PNPM_MANIFEST_RESOLUTION_CONFIG_FIELDS = PNPM_RESOLUTION_CONFIG.flatMap(
  (field) => (field.manifest === null ? [] : [field.manifest])
);

/** The top-level lockfile keys a pruned output drops. */
export const PNPM_LOCKFILE_RESOLUTION_CONFIG_FIELDS =
  PNPM_RESOLUTION_CONFIG.map((field) => field.lockfile);

/**
 * Drops the resolution-time pnpm config a pruned standalone lockfile already
 * resolves into its snapshots, then drops an emptied `pnpm` block. Re-declaring
 * it next to a pruned lockfile makes pnpm <=10 fail with
 * ERR_PNPM_LOCKFILE_CONFIG_MISMATCH. Only for an actually pruned lockfile: the
 * root-lockfile fallback keeps the config, which that lockfile still declares.
 *
 * Counterpart to `stripStandaloneLockfileConfig` in the pnpm lock-file parser,
 * which drops the same fields from the generated lockfile.
 */
export function stripPrunedLockfilePnpmConfig(packageJson: PackageJson): void {
  if (!packageJson.pnpm) {
    return;
  }
  for (const field of PNPM_MANIFEST_RESOLUTION_CONFIG_FIELDS) {
    delete packageJson.pnpm[field];
  }
  if (Object.keys(packageJson.pnpm).length === 0) {
    delete packageJson.pnpm;
  }
}

/**
 * Drops the `pnpm.patchedDependencies` the emitted manifest inherited from the
 * project it was built from. The declaration a pruned output needs is the one
 * `getPrunedPnpmPatchArtifacts` derives from the lockfile shipping beside it; an
 * inherited one names the workspace's patch paths rather than the output's, and
 * survives even when the output ships no patch file at all, which fails the
 * install as pnpm hashes every declared patch. pnpm reads the field from the
 * workspace root alone, so a project-level block was inert at home and cannot be
 * trusted here either.
 */
export function dropInheritedPnpmPatchedDependencies(
  packageJson: PackageJson
): void {
  if (!packageJson.pnpm?.patchedDependencies) {
    return;
  }
  delete packageJson.pnpm.patchedDependencies;
  if (Object.keys(packageJson.pnpm).length === 0) {
    delete packageJson.pnpm;
  }
}

/**
 * pnpm config resolved once per prune and threaded into the settings-yaml and
 * patch-artifact builders, so neither repeats the pnpm version probe or the
 * patched-dependency resolution.
 */
type PrunedPnpmConfig = {
  pnpmMajor: number | null;
  patchedDependencies: Record<string, string>;
};

/**
 * Builds the settings-only pnpm-workspace.yaml a standalone pruned output ships.
 *
 * Emitted for every pnpm output, including the ones with no settings to carry.
 * A conditional artifact cannot be retracted once shipped: a cache replay
 * restores only the files the replayed entry holds, and a bundler that leaves
 * its output directory uncleaned overwrites nothing, so an earlier build's copy
 * would survive and pnpm would read its `patchedDependencies` as a lockfile
 * mismatch. Shipping it unconditionally makes every build overwrite the last.
 * A `packages: []`-only file is inert: verified installable with identical
 * module resolution on pnpm 9, 10 and 11, and on pnpm 10 it leaves the
 * package.json build approvals in force.
 *
 * pnpm 11 was the first major to read these settings only from
 * pnpm-workspace.yaml, never the package.json `pnpm` field, and the rest of the
 * pruned output ships no workspace file. So on pnpm 11+ the build-script
 * approvals (`allowBuilds`) and `supportedArchitectures` the workspace declares
 * would be dropped, and native production deps would never run their build
 * scripts. Carry those from the workspace root, plus an empty `packages` list:
 * pnpm 9 rejects a pnpm-workspace.yaml without a `packages` field ("packages
 * field missing or empty"), and `packages: []` is accepted by pnpm 9, 10 and 11
 * alike without pulling any importer into the install, so the emitted file
 * installs on any of those majors.
 *
 * The major comes from the build machine's pnpm, which is all that is knowable
 * at build time: an output built on pnpm <=10 declares the settings in its
 * emitted package.json instead, so a pnpm 11+ deploy of that output would not
 * pick them up.
 *
 * pnpm 10 and below read the same settings from the emitted package.json, so the
 * file carries only `packages: []` there, as it does when the workspace declares
 * no settings at all. Resolution-time
 * config stays out: it is already baked into the pruned lockfile (see
 * `stripPrunedLockfilePnpmConfig`). `patchedDependencies` are carried too, scoped
 * to the patches the pruned lockfile keeps (see `getPrunedPnpmPatchArtifacts`).
 *
 * Returns the YAML string so both the file-writing prune paths and the webpack
 * asset pipeline (which emits assets rather than writing to disk) can carry it.
 *
 * Pass `prunedLockfileContent` to narrow `allowBuilds` to the packages the pruned
 * output actually installs; entries for packages the prune dropped are left out.
 * Omit it to carry the root allowlist verbatim (pnpm ignores approvals for absent
 * packages either way, so this only keeps the emitted file accurate).
 * `precomputed` lets a caller pass the pnpm major and pruned patchedDependencies
 * it already resolved instead of recomputing them here.
 */
export function getPrunedPnpmInstallSettingsYaml(
  workspaceRootPath: string = workspaceRoot,
  prunedLockfileContent?: string,
  precomputed?: PrunedPnpmConfig
): string {
  const settings =
    getPrunedPnpmWorkspaceSettings(
      workspaceRootPath,
      prunedLockfileContent,
      precomputed
    ) ?? {};
  const { dump } = require('@zkochan/js-yaml');
  // pnpm 9 rejects a pnpm-workspace.yaml without a `packages` field; an empty
  // list is accepted by pnpm 9-11 without pulling any importer into the install.
  return dump({ packages: [], ...settings });
}

/**
 * The settings `getPrunedPnpmInstallSettingsYaml` emits, before serialization,
 * so a caller can tell which of them the workspace actually declares. Null when
 * the workspace declares none, or on a pnpm major that reads them from the
 * emitted package.json instead.
 */
function getPrunedPnpmWorkspaceSettings(
  workspaceRootPath: string,
  prunedLockfileContent?: string,
  precomputed?: PrunedPnpmConfig
): Record<string, unknown> | null {
  // pnpm 11 was the first major to read these settings only from
  // pnpm-workspace.yaml; later majors keep that behavior. pnpm 10 and below
  // still read them from the emitted package.json, so nothing to carry.
  const pnpmMajor = resolvePnpmMajor(precomputed, workspaceRootPath);
  if (pnpmMajor === null || pnpmMajor < 11) {
    return null;
  }
  let rootSettings: {
    allowBuilds?: Record<string, boolean>;
    supportedArchitectures?: unknown;
  };
  try {
    const rootWorkspaceYaml = join(workspaceRootPath, 'pnpm-workspace.yaml');
    if (!existsSync(rootWorkspaceYaml)) {
      return null;
    }
    // An empty or comment-only file parses to null/undefined; treat it as no
    // settings rather than dereferencing it below.
    rootSettings = readYamlFile(rootWorkspaceYaml) ?? {};
  } catch {
    // Unreadable or malformed pnpm-workspace.yaml: skip rather than guess.
    logger.warn(
      'Could not read the workspace root pnpm-workspace.yaml; the pruned output will not declare pnpm install settings (build-script approvals, supportedArchitectures, patchedDependencies).'
    );
    return null;
  }
  const settings: Record<string, unknown> = {};
  if (rootSettings.allowBuilds) {
    const allowBuilds = prunedLockfileContent
      ? filterAllowBuildsToLockfile(
          rootSettings.allowBuilds,
          prunedLockfileContent
        )
      : rootSettings.allowBuilds;
    if (Object.keys(allowBuilds).length > 0) {
      settings.allowBuilds = allowBuilds;
    }
  }
  if (rootSettings.supportedArchitectures) {
    settings.supportedArchitectures = rootSettings.supportedArchitectures;
  }
  const patchedDependencies =
    precomputed?.patchedDependencies ??
    (prunedLockfileContent
      ? getPrunedPatchedDependencies(workspaceRootPath, prunedLockfileContent)
      : {});
  if (Object.keys(patchedDependencies).length > 0) {
    settings.patchedDependencies =
      normalizePrunedPatchedDependencies(patchedDependencies);
  }
  return Object.keys(settings).length > 0 ? settings : null;
}

const pnpmMajorByWorkspaceRoot = new Map<string, number | null>();

/**
 * The pnpm major of the workspace's package manager, or null when it cannot be
 * determined (unknown or unparseable version). Memoized per workspace root:
 * `getPackageManagerVersion` re-reads the root manifest on every call and shells
 * out to `pnpm --version` when it declares no `packageManager`, while the
 * bundler plugins reach this once per compilation, so a watched build would pay
 * it on every rebuild.
 */
function getPnpmMajor(workspaceRootPath: string): number | null {
  if (pnpmMajorByWorkspaceRoot.has(workspaceRootPath)) {
    return pnpmMajorByWorkspaceRoot.get(workspaceRootPath);
  }
  let major: number | null;
  try {
    const parsed = Number.parseInt(
      getPackageManagerVersion('pnpm', workspaceRootPath).split('.')[0],
      10
    );
    major = Number.isNaN(parsed) ? null : parsed;
  } catch {
    major = null;
  }
  // Only a successful detection is remembered: `getPackageManagerVersion`
  // shells out when the root declares no `packageManager`, and caching one
  // failed spawn would disable the pnpm settings for the rest of the process.
  if (major !== null) {
    pnpmMajorByWorkspaceRoot.set(workspaceRootPath, major);
  }
  return major;
}

/**
 * `getPnpmMajor` for the prune orchestrators: warns on an undeterminable
 * version, since every version-gated install setting is skipped in that case.
 */
function getPnpmMajorOrWarn(workspaceRootPath: string): number | null {
  const pnpmMajor = getPnpmMajor(workspaceRootPath);
  if (pnpmMajor === null) {
    logger.warn(
      'Could not determine the pnpm version. The pruned output will not carry pnpm build-script approvals, supportedArchitectures, or patchedDependencies declarations; patch files still ship.'
    );
  }
  return pnpmMajor;
}

/**
 * The pnpm major each install-settings builder works from. Probing is skipped
 * whenever an orchestrator passed its own config, on the presence of that config
 * rather than on the value: a precomputed `null` means the probe already failed
 * and warned, and re-probing it here could disagree with what the sibling
 * builders decided from that same `null`.
 */
function resolvePnpmMajor(
  precomputed: PrunedPnpmConfig | undefined,
  workspaceRootPath: string
): number | null {
  return precomputed ? precomputed.pnpmMajor : getPnpmMajor(workspaceRootPath);
}

/**
 * Keeps only the `allowBuilds` entries whose package is present in the pruned
 * lockfile. Build-script approvals for packages the prune dropped are inert, so
 * dropping them keeps the emitted pnpm-workspace.yaml scoped to the deployment.
 * Carries the approvals verbatim when `getBuildApprovalScopeNames` cannot
 * determine that scope.
 */
function filterAllowBuildsToLockfile(
  allowBuilds: Record<string, boolean>,
  prunedLockfileContent: string
): Record<string, boolean> {
  const present = getBuildApprovalScopeNames(prunedLockfileContent);
  if (present === null) {
    return allowBuilds;
  }
  const filtered: Record<string, boolean> = {};
  for (const [name, allowed] of Object.entries(allowBuilds)) {
    if (present.has(name)) {
      filtered[name] = allowed;
    }
  }
  return filtered;
}

let lastParsedPnpmLockfile: {
  content: string;
  parsed: object | null;
} | null = null;

/**
 * Parses pnpm lockfile content, memoizing the last result: one prune run reads
 * the same content for the patch scope, the build-script approvals, the
 * local-path artifacts, and the link-closure validation, and a watch-mode
 * rebuild re-reads an unchanged lockfile. The fallback path passes the root
 * lockfile in, which pnpm 11 writes as two YAML documents for a package manager
 * it persists (see `shouldPersistLockfile`), so the workspace document is
 * extracted the way the pnpm lockfile parser does. Returns null when the content is not
 * valid YAML or does not parse to an object. Consumers must not mutate the
 * returned document.
 */
function parsePnpmLockfileYaml(content: string): object | null {
  if (lastParsedPnpmLockfile?.content !== content) {
    // One failure disables three independent output-correctness steps at once,
    // and the result is memoized, so it would stay invisible for the rest of
    // the process.
    const warnUnusable = (cause: string): void => {
      logger.warn(
        `Could not parse the pnpm lockfile (${cause}); the pruned output will not carry patch declarations, local-path artifacts, or a validated link closure.`
      );
    };
    let parsed: unknown;
    // A lockfile that opens a YAML document and never separates a second one
    // extracts to nothing, which would otherwise read as an empty lockfile.
    const document = extractMainLockfileDocument(content);
    if (document.trim() === '' && content.trim() !== '') {
      warnUnusable('it carries no lockfile document');
      parsed = null;
    } else {
      try {
        parsed = require('@zkochan/js-yaml').load(document) ?? {};
      } catch (e) {
        warnUnusable(e instanceof Error ? e.message : String(e));
        parsed = null;
      }
    }
    if (
      parsed !== null &&
      (typeof parsed !== 'object' || Array.isArray(parsed))
    ) {
      warnUnusable('it does not parse to a YAML mapping');
      parsed = null;
    }
    lastParsedPnpmLockfile = { content, parsed: parsed as object | null };
  }
  return lastParsedPnpmLockfile.parsed;
}

/**
 * The package names a build approval can apply to in the output, read from a
 * pnpm v9 lockfile's `packages` keys (`name@version`, `@scope/name@version`,
 * optionally with a `(peer@ver)` suffix). Returns null when that scope cannot be
 * determined, which callers treat as "carry approvals verbatim", the inert
 * direction: an approval for an absent package does nothing, a dropped one
 * silently skips a needed build script. Three cases yield null:
 * - unparseable content;
 * - a pre-v9 lockfile, whose `/name@version` (v6) and `/name/version` (v5) keys
 *   this parse would mangle;
 * - a lockfile with an importer other than the output itself, which is
 *   the root-lockfile fallback. It lists the workspace's projects
 *   under `importers` and never `packages`, so a workspace module the output
 *   ships as a `file:` directory dependency, which pnpm does gate on the
 *   approval list, has no name here to match.
 */
function getBuildApprovalScopeNames(
  lockfileContent: string
): Set<string> | null {
  const parsed = parsePnpmLockfileYaml(lockfileContent) as {
    lockfileVersion?: string | number;
    importers?: Record<string, unknown>;
    packages?: Record<string, unknown>;
  } | null;
  const lockfileVersion = Number.parseFloat(String(parsed?.lockfileVersion));
  if (!parsed || Number.isNaN(lockfileVersion) || lockfileVersion < 9) {
    return null;
  }
  if (
    Object.keys(parsed.importers ?? {}).some((importer) => importer !== '.')
  ) {
    return null;
  }
  const names = new Set<string>();
  for (const key of Object.keys(parsed.packages ?? {})) {
    // Skip index 0 so a scoped key's leading `@` is not read as the separator.
    const versionSeparator = key.indexOf('@', 1);
    names.add(versionSeparator === -1 ? key : key.slice(0, versionSeparator));
  }
  return names;
}

/**
 * The workspace root's `patchedDependencies` (package key -> patch file path),
 * scoped to the patches the pruned lockfile keeps. pnpm 11 declares them in
 * pnpm-workspace.yaml; pnpm 10 and below in the package.json `pnpm` field, so
 * read both root sources. A patch entry for a package the prune dropped would
 * fail `pnpm install --frozen-lockfile` with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH,
 * so the pruned lockfile's kept `patchedDependencies` keys are the scope.
 */
function getPrunedPatchedDependencies(
  workspaceRootPath: string,
  prunedLockfileContent: string | undefined
): Record<string, string> {
  if (!prunedLockfileContent) {
    return {};
  }
  const survivingKeys = getPrunedLockfilePatchedKeys(prunedLockfileContent);
  if (survivingKeys.size === 0) {
    return {};
  }
  const rootPatches = readRootPatchedDependencies(workspaceRootPath);
  const scoped: Record<string, string> = {};
  for (const key of survivingKeys) {
    if (rootPatches[key]) {
      scoped[key] = rootPatches[key];
    }
  }
  return scoped;
}

/**
 * The path a `.patch` file takes inside the pruned output. Patches must ship
 * under the output's declared `patches/` directory: a source path outside it (a
 * custom directory, or a parent-relative `../` path) would fall outside the
 * prune target's cached `patches` output and be dropped on a cache replay, and a
 * `..` asset name is not one a bundler can emit. The whole source sub-structure
 * is kept under `patches/`, including a source `patches/` segment, so two
 * patches that share a file name in different directories keep separate
 * destinations. The path is collapsed first, the way pnpm collapses it before
 * recording it in the lockfile (`./x` and `a/../x` are both stored as `x`), so
 * the declared path this reads and the recorded path the lockfile side reads
 * produce the same destination. Any `..` left after collapsing escapes the
 * workspace and is dropped so the result cannot resolve outside `patches/`,
 * which is the one way two sources can still meet on one destination:
 * `getPrunedPnpmPatchArtifacts` rejects that pair rather than shipping one file
 * for both.
 * `filterPatchedDependenciesToPrunedPackages` in the pnpm lock-file parser calls
 * this same helper for the lockfile's object-form path (pnpm 9-10), which pnpm
 * --frozen-lockfile cross-checks against this config path, so the two agree.
 */
export function normalizePrunedPatchPath(patchPath: string): string {
  const segments = posix
    .normalize(patchPath.replace(/\\/g, '/'))
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..');
  return `patches/${segments.join('/')}`;
}

function normalizePrunedPatchedDependencies(
  patchedDependencies: Record<string, string>
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, patchPath] of Object.entries(patchedDependencies)) {
    normalized[key] = normalizePrunedPatchPath(patchPath);
  }
  return normalized;
}

function readRootPatchedDependencies(
  workspaceRootPath: string
): Record<string, string> {
  const merged: Record<string, string> = {};
  // pnpm <=10 reads patchedDependencies from the package.json `pnpm` field,
  // pnpm 11 only from pnpm-workspace.yaml. When both declare the same key the
  // pnpm-workspace.yaml value is the authoritative one on pnpm 11 (pnpm
  // migrates the config there), so read package.json first and let the
  // pnpm-workspace.yaml value win on conflict. Each source is read in its own
  // try so a broken one does not discard the other's patches.
  try {
    const rootPackageJsonPath = join(workspaceRootPath, 'package.json');
    if (existsSync(rootPackageJsonPath)) {
      const rootPackageJson = readJsonFile<PackageJson>(rootPackageJsonPath);
      Object.assign(merged, rootPackageJson.pnpm?.patchedDependencies ?? {});
    }
  } catch {
    logger.warn(
      'Could not read patchedDependencies from the workspace root package.json; the pruned output will not carry the patches it declares.'
    );
  }
  try {
    const rootWorkspaceYaml = join(workspaceRootPath, 'pnpm-workspace.yaml');
    if (existsSync(rootWorkspaceYaml)) {
      const yaml = readYamlFile<{
        patchedDependencies?: Record<string, string>;
      }>(rootWorkspaceYaml);
      Object.assign(merged, yaml?.patchedDependencies ?? {});
    }
  } catch {
    logger.warn(
      'Could not read patchedDependencies from the workspace root pnpm-workspace.yaml; the pruned output will not carry the patches it declares.'
    );
  }
  return merged;
}

/**
 * The build-script subset of the root `pnpm` config, taken from `PackageJson`
 * so the two cannot describe the same fields differently. `pnpm-workspace.yaml`
 * declares them at the top level, which is why this is read from both.
 */
type RootPnpmBuildSettings = Pick<
  NonNullable<PackageJson['pnpm']>,
  | 'onlyBuiltDependencies'
  | 'neverBuiltDependencies'
  | 'allowBuilds'
  | 'supportedArchitectures'
>;

/** Copies `key` from `source` to `target` unless the source leaves it unset. */
function assignDefined<T, K extends keyof T>(target: T, source: T, key: K) {
  if (source[key] !== undefined) {
    target[key] = source[key];
  }
}

/**
 * The workspace root's pnpm build-script settings, read from both the
 * pnpm-workspace.yaml and the root package.json `pnpm` field, with the
 * pnpm-workspace.yaml value winning per field (pnpm migrates config there, and
 * pnpm 10 reads both). Mirrors `readRootPatchedDependencies`.
 */
function readRootPnpmBuildSettings(
  workspaceRootPath: string
): RootPnpmBuildSettings {
  const fields = [
    'onlyBuiltDependencies',
    'neverBuiltDependencies',
    'allowBuilds',
    'supportedArchitectures',
  ] as const satisfies readonly (keyof RootPnpmBuildSettings)[];
  const merged: RootPnpmBuildSettings = {};
  const sources: RootPnpmBuildSettings[] = [];
  // Each source is read in its own try so a broken one does not discard the
  // other's settings.
  try {
    const rootPackageJsonPath = join(workspaceRootPath, 'package.json');
    if (existsSync(rootPackageJsonPath)) {
      sources.push(readJsonFile<PackageJson>(rootPackageJsonPath).pnpm ?? {});
    }
  } catch {
    logger.warn(
      'Could not read the pnpm build-script settings from the workspace root package.json; the pruned output will not carry the settings it declares.'
    );
  }
  try {
    const rootWorkspaceYaml = join(workspaceRootPath, 'pnpm-workspace.yaml');
    if (existsSync(rootWorkspaceYaml)) {
      sources.push(
        readYamlFile<RootPnpmBuildSettings>(rootWorkspaceYaml) ?? {}
      );
    }
  } catch {
    logger.warn(
      'Could not read the pnpm build-script settings from the workspace root pnpm-workspace.yaml; the pruned output will not carry the settings it declares.'
    );
  }
  // Later source (pnpm-workspace.yaml) wins per field.
  for (const source of sources) {
    for (const field of fields) {
      assignDefined(merged, source, field);
    }
  }
  return merged;
}

type PrunedPnpmPackageJsonBuildSettings = Pick<
  NonNullable<PackageJson['pnpm']>,
  'onlyBuiltDependencies' | 'neverBuiltDependencies' | 'supportedArchitectures'
>;

/**
 * The pnpm build-script approvals a standalone pruned output must declare in its
 * emitted package.json so native production deps still run their build scripts on
 * pnpm <=10, or null when there is nothing to carry.
 *
 * pnpm <=10 reads `onlyBuiltDependencies`/`neverBuiltDependencies` (and
 * `supportedArchitectures`) from the package.json `pnpm` field; pnpm 11 removed
 * those keys and reads `allowBuilds` only from pnpm-workspace.yaml (carried there
 * by `getPrunedPnpmInstallSettingsYaml`), so this returns null on pnpm 11+. The
 * root may declare the approvals in pnpm-workspace.yaml (pnpm 10) or the
 * package.json `pnpm` field (pnpm 9), and pnpm 10.26+ uses the `allowBuilds` map,
 * so read both root sources and fold a root `allowBuilds` map into the
 * on/never-built lists pnpm <=10 understands. Approvals are scoped to the
 * packages the pruned lockfile keeps; one for a dropped package is inert. When
 * the lockfile's names cannot be extracted (a pre-v9 lockfile, unparseable
 * content), they are carried verbatim instead of scoped to nothing.
 *
 * Counterpart to the pnpm 11 `getPrunedPnpmInstallSettingsYaml`; keep the two in
 * sync when pnpm changes where build approvals are read from.
 */
export function getPrunedPnpmPackageJsonBuildSettings(
  workspaceRootPath: string = workspaceRoot,
  prunedLockfileContent?: string,
  precomputed?: PrunedPnpmConfig
): PrunedPnpmPackageJsonBuildSettings | null {
  const pnpmMajor = resolvePnpmMajor(precomputed, workspaceRootPath);
  if (pnpmMajor === null || pnpmMajor >= 11) {
    return null;
  }
  const root = readRootPnpmBuildSettings(workspaceRootPath);
  const present = prunedLockfileContent
    ? getBuildApprovalScopeNames(prunedLockfileContent)
    : null;
  const scopeToLockfile = (names: Iterable<string>): string[] => {
    const scoped = [...names];
    return present ? scoped.filter((name) => present.has(name)) : scoped;
  };

  // pnpm 10.26+ declares approvals as an allowBuilds map; fold it into the
  // on/never-built lists pnpm <=10 reads from package.json.
  const onlyBuilt = new Set(root.onlyBuiltDependencies ?? []);
  const neverBuilt = new Set(root.neverBuiltDependencies ?? []);
  for (const [name, allowed] of Object.entries(root.allowBuilds ?? {})) {
    (allowed ? onlyBuilt : neverBuilt).add(name);
  }

  const settings: PrunedPnpmPackageJsonBuildSettings = {};
  const scopedOnlyBuilt = scopeToLockfile(onlyBuilt);
  if (scopedOnlyBuilt.length > 0) {
    settings.onlyBuiltDependencies = scopedOnlyBuilt;
  }
  const scopedNeverBuilt = scopeToLockfile(neverBuilt);
  if (scopedNeverBuilt.length > 0) {
    settings.neverBuiltDependencies = scopedNeverBuilt;
  }
  if (root.supportedArchitectures) {
    settings.supportedArchitectures = root.supportedArchitectures;
  }
  return Object.keys(settings).length > 0 ? settings : null;
}

/**
 * Folds the pnpm <=10 package.json additions a standalone pruned output needs
 * (build approvals from `getPrunedPnpmPackageJsonBuildSettings`, plus the
 * `patchedDependencies` declaration) onto `packageJson` in place. Build-approval
 * lists union the manifest's own entries with the carried ones so a project-level
 * approval is never dropped. Does nothing when there is nothing to add.
 */
function applyPrunedPnpmPackageJsonSettings(
  packageJson: PackageJson,
  buildSettings: PrunedPnpmPackageJsonBuildSettings | null,
  patchedDependencies: Record<string, string> | null
): void {
  if (!buildSettings && !patchedDependencies) {
    return;
  }
  const union = (a: string[] = [], b: string[] = []) => [
    ...new Set([...a, ...b]),
  ];
  packageJson.pnpm ??= {};
  if (buildSettings?.onlyBuiltDependencies) {
    packageJson.pnpm.onlyBuiltDependencies = union(
      packageJson.pnpm.onlyBuiltDependencies,
      buildSettings.onlyBuiltDependencies
    );
  }
  if (buildSettings?.neverBuiltDependencies) {
    packageJson.pnpm.neverBuiltDependencies = union(
      packageJson.pnpm.neverBuiltDependencies,
      buildSettings.neverBuiltDependencies
    );
  }
  if (buildSettings?.supportedArchitectures) {
    packageJson.pnpm.supportedArchitectures = {
      ...buildSettings.supportedArchitectures,
      ...packageJson.pnpm.supportedArchitectures,
    };
  }
  if (patchedDependencies) {
    packageJson.pnpm.patchedDependencies = patchedDependencies;
  }
}

function getPrunedLockfilePatchedKeys(
  prunedLockfileContent: string
): Set<string> {
  const parsed = parsePnpmLockfileYaml(prunedLockfileContent) as {
    patchedDependencies?: Record<string, unknown>;
  } | null;
  return new Set(Object.keys(parsed?.patchedDependencies ?? {}));
}

/**
 * Patch artifacts a standalone pruned output must ship to keep a `pnpm patch`
 * workspace installable: the `.patch` files (path relative to the output root,
 * plus content) and, on pnpm 10 and below, the `patchedDependencies` map to
 * declare in the emitted package.json. On pnpm 11+ that map is carried in
 * pnpm-workspace.yaml (see `getPrunedPnpmInstallSettingsYaml`), so
 * `packageJsonPatchedDependencies` is null there. Both are scoped to the patches
 * the pruned lockfile keeps. Returns the file contents so the file-writing prune
 * paths and the bundler asset pipelines can each ship them their own way.
 */
export function getPrunedPnpmPatchArtifacts(
  workspaceRootPath: string = workspaceRoot,
  prunedLockfileContent?: string,
  precomputed?: PrunedPnpmConfig
): {
  patchFiles: Array<{ path: string; content: string }>;
  packageJsonPatchedDependencies: Record<string, string> | null;
} {
  const patchedDependencies =
    precomputed?.patchedDependencies ??
    getPrunedPatchedDependencies(workspaceRootPath, prunedLockfileContent);
  if (Object.keys(patchedDependencies).length === 0) {
    return { patchFiles: [], packageJsonPatchedDependencies: null };
  }
  const patchFiles: Array<{ path: string; content: string }> = [];
  // normalizePrunedPatchPath collapses the path, so two distinct sources can
  // normalize to one shipped path, which would ship a single file for both
  // entries and apply the wrong patch. Detect the clash and fail loudly rather
  // than silently corrupt the output.
  const shippedFrom = new Map<string, string>();
  for (const patchPath of new Set(Object.values(patchedDependencies))) {
    // The config/lockfile side normalizes an absolute patch path under patches/,
    // so read its source from that absolute location to keep the shipped file in
    // sync; only a relative path resolves against the workspace root.
    const source = isAbsolute(patchPath)
      ? patchPath
      : join(workspaceRootPath, patchPath);
    const destination = normalizePrunedPatchPath(patchPath);
    const existingSource = shippedFrom.get(destination);
    if (existingSource !== undefined && existingSource !== source) {
      throw new Error(
        `Cannot prune pnpm patches: "${existingSource}" and "${source}" both ship to "${destination}" in the standalone output. Rename one so the patches do not collide.`
      );
    }
    shippedFrom.set(destination, source);
    // A file check rather than a mere existence one: a path whose segments all
    // normalize away (``, `.`, `..`) resolves to a directory, which would fail
    // the read below with a raw EISDIR instead of taking the warn path.
    if (fileExists(source)) {
      // Ship the patch under the `patches/<subpath>` path the pruned output
      // declares, reading it from wherever the workspace kept it.
      patchFiles.push({
        path: destination,
        content: readFileSync(source, 'utf-8'),
      });
    } else {
      // The root config declares this patch but no file is there (already a
      // broken workspace, the root install would fail too). Warn rather than
      // drop the declaration: the pruned lockfile still lists the patch, so
      // dropping only the config would trade this for a lockfile config mismatch.
      logger.warn(
        `Patch file "${patchPath}" referenced by patchedDependencies was not found; the pruned output declares the patch but cannot ship the file.`
      );
    }
  }
  const pnpmMajor = resolvePnpmMajor(precomputed, workspaceRootPath);
  return {
    patchFiles,
    packageJsonPatchedDependencies:
      pnpmMajor !== null && pnpmMajor < 11
        ? normalizePrunedPatchedDependencies(patchedDependencies)
        : null,
  };
}

const WORKSPACE_MODULES_DIR = 'workspace_modules';

/**
 * Non-workspace local-path deps (`file:` tarballs/dirs, `link:` targets) ship
 * under this single output directory rather than at their workspace-relative
 * path. A generated `prune-lockfile` target declares dynamic output paths it
 * cannot enumerate at generate time; corralling every vendored artifact under
 * one directory lets `getPruneTargets` declare it, so a cache replay restores it
 * (an artifact shipped outside a declared output is dropped on replay, breaking
 * the standalone deploy). The manifest specifiers and pruned-lockfile refs are
 * relocated into this directory to match; source reads strip it back off.
 */
export const LOCAL_PATH_MODULES_DIR = 'local_path_modules';

/**
 * Relocates a workspace-relative local-path into the shipped output directory.
 * Injective, so `uncontainLocalPath` recovers the source path for every input:
 * a workspace directory literally named `local_path_modules/` relocates like
 * any other rather than being mistaken for an already-relocated path. Callers
 * must therefore relocate each path exactly once.
 */
export function containLocalPath(wsRelativePath: string): string {
  return `${LOCAL_PATH_MODULES_DIR}/${wsRelativePath}`;
}

/**
 * The workspace-relative source path of a shipped local-path artifact, i.e. the
 * inverse of `containLocalPath`. A path that is not under the shipped directory
 * (an unshippable target left at its original spec) is returned unchanged.
 */
export function uncontainLocalPath(shippedPath: string): string {
  if (shippedPath === LOCAL_PATH_MODULES_DIR) {
    return '';
  }
  return shippedPath.startsWith(`${LOCAL_PATH_MODULES_DIR}/`)
    ? shippedPath.slice(LOCAL_PATH_MODULES_DIR.length + 1)
    : shippedPath;
}

/**
 * A `file:`/`link:` specifier with its path separators unified, so specifiers
 * that differ only in how they were authored compare equal. Returns anything
 * that is not a local-path specifier unchanged.
 */
export function normalizeLocalPathSpec(spec: string): string {
  const protocol = spec.startsWith('link:')
    ? 'link:'
    : spec.startsWith('file:')
      ? 'file:'
      : null;
  return protocol
    ? `${protocol}${normalizePath(spec.slice(protocol.length))}`
    : spec;
}

/**
 * A relocated `file:`/`link:` specifier read back as the source path it was
 * relocated from, so it compares equal to the source specifier for the same
 * target (`normalizeLocalPathSpec`). Relocation is injective and strips exactly
 * one level, so only the relocated side of a comparison may go through this: a
 * source path that itself starts with the shipped directory's name relocates
 * like any other, and stripping it too would read it as a different target.
 */
export function uncontainLocalPathSpec(spec: string): string {
  const normalized = normalizeLocalPathSpec(spec);
  const protocol = normalized.startsWith('link:')
    ? 'link:'
    : normalized.startsWith('file:')
      ? 'file:'
      : null;
  return protocol
    ? `${protocol}${uncontainLocalPath(normalized.slice(protocol.length))}`
    : normalized;
}

/**
 * The absolute source of a local-path target, or the reason it cannot ship into
 * the pruned output. The containment check is lexical, so it cannot see where a
 * symlinked source points: resolving it is what separates a link into the
 * workspace, which ships like any other directory, from one that lands on the
 * workspace root or leaves it. A dangling link is reported rather than accepted,
 * which `lstat` would have done. Shared so the artifact collector and the
 * closure validation cannot disagree about what the output actually carries.
 */
function resolveLocalPathSource(
  wsRelativePath: string,
  workspaceRootPath: string,
  workspaceRootRealPath: string
): {
  source: string | null;
  reason?: 'outside-workspace' | 'workspace-root' | 'missing';
  attempted?: string;
  resolved?: string;
} {
  if (localPathEscapesOutput(wsRelativePath)) {
    return { source: null, reason: 'outside-workspace' };
  }
  const attempted = join(workspaceRootPath, wsRelativePath);
  let resolved: string;
  try {
    resolved = realpathSync(attempted);
  } catch {
    return { source: null, reason: 'missing', attempted };
  }
  // Shipping the root itself would copy the whole workspace into the output.
  if (resolved === workspaceRootRealPath) {
    return { source: null, reason: 'workspace-root', attempted, resolved };
  }
  if (!resolved.startsWith(`${workspaceRootRealPath}${sep}`)) {
    return { source: null, reason: 'outside-workspace', attempted, resolved };
  }
  return { source: attempted, attempted, resolved };
}

/**
 * Contains a workspace-relative `file:` path, leaving unshippable ones as-is.
 * `synthesized` holds the copied-workspace-module paths the caller assembled,
 * which are already output paths: they are recognized by identity rather than by
 * their `workspace_modules/` prefix, so a workspace directory that happens to
 * carry that name relocates like any other source.
 */
function containVendoredFilePath(
  wsRelativePath: string,
  synthesized: ReadonlySet<string>
): string {
  if (
    wsRelativePath === '' ||
    wsRelativePath === '.' ||
    synthesized.has(wsRelativePath) ||
    localPathEscapesOutput(wsRelativePath)
  ) {
    return wsRelativePath;
  }
  return containLocalPath(wsRelativePath);
}

/**
 * Contains the `file:` path in a lockfile token, which is either a bare spec
 * (`file:X`) or one carrying the target's real package name (`name@file:X`, the
 * shape pnpm records for an aliased dependency and uses as that package's key).
 * Package keys and the refs that point at them go through this one function, so
 * a renamed key and its refs cannot drift apart; pnpm rejects that mismatch with
 * ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY. A resolved-peer suffix rides along in
 * the sliced path (`name@file:X(peer@1.0.0)`) and survives untouched because
 * containment only prepends.
 */
function containFileToken(
  token: string,
  synthesized: ReadonlySet<string>
): string {
  const marker = token.startsWith('file:') ? 'file:' : '@file:';
  const index = token.startsWith('file:') ? 0 : token.indexOf(marker);
  if (index === -1) {
    return token;
  }
  const pathStart = index + marker.length;
  // Normalize separators first, matching the artifact shipping side
  // (getPrunedPnpmLocalPathArtifacts), so a backslash-authored token contains to
  // the same posix path the artifacts ship to.
  const path = normalizePath(token.slice(pathStart));
  const contained = containVendoredFilePath(path, synthesized);
  return contained === path
    ? token
    : `${token.slice(0, pathStart)}${contained}`;
}

/**
 * Warns when a workspace directory occupies the output path of a copied
 * workspace module. Both spell `workspace_modules/<name>`, so no later pass can
 * tell them apart: the vendored source is read as the copied module and never
 * ships, leaving the lockfile pointing at a path the output does not carry.
 */
export function warnOnWorkspaceModulePathCollision(
  sourcePackages: Record<string, unknown> | undefined,
  synthesizedModulePaths: ReadonlySet<string>
): void {
  for (const snapshot of Object.values(sourcePackages ?? {})) {
    const directory = (snapshot as { resolution?: { directory?: string } })
      ?.resolution?.directory;
    if (
      typeof directory === 'string' &&
      synthesizedModulePaths.has(normalizePath(directory))
    ) {
      logger.warn(
        `Local-path dependency "file:${directory}" sits where the pruned output copies a workspace module of the same name, so it cannot ship separately. Move it out of ${WORKSPACE_MODULES_DIR}/ to deploy it.`
      );
    }
  }
}

/**
 * Relocates every shippable non-workspace `file:` local-path reference in a
 * pruned lockfile (package keys, resolutions, and snapshot/importer dependency
 * refs) under `LOCAL_PATH_MODULES_DIR`, matching where the artifacts ship, so a
 * standalone `pnpm install` resolves them. `link:` refs are relocated upstream
 * (`containShippedLocalLinkRefs` for the source snapshots, the assembly's own
 * synthesis sites for the rest); only `file:` paths, which the source lockfile
 * carries verbatim, are contained here. Workspace-module and escaping paths
 * are left untouched. Mutates `lockfile` in place; the key rename and every ref
 * use the same `file:` path, so they stay in sync.
 *
 * Takes the normalized document rather than a looser shape: dependency refs are
 * rewritten only where they are plain strings, which is what normalization
 * guarantees. A raw v9 file records an importer ref as `{ specifier, version }`
 * and would have its package key renamed while that ref kept pointing at the
 * old path.
 */
export function containShippedLocalFilePaths(
  lockfile: Partial<Pick<Lockfile, 'importers' | 'packages'>>,
  synthesizedModulePaths: ReadonlySet<string> = new Set()
): void {
  const synthesized = synthesizedModulePaths;
  const containSnapshot = (snapshot: unknown): void => {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }
    const record = snapshot as Record<string, unknown>;
    const resolution = record.resolution as
      | { directory?: string; tarball?: string }
      | undefined;
    if (resolution && typeof resolution === 'object') {
      if (typeof resolution.directory === 'string') {
        // Normalize separators first, matching the artifact shipping side
        // (getPrunedPnpmLocalPathArtifacts), so a backslash directory contains
        // to the same posix path the artifacts ship to.
        resolution.directory = containVendoredFilePath(
          normalizePath(resolution.directory),
          synthesized
        );
      }
      if (typeof resolution.tarball === 'string') {
        resolution.tarball = containFileToken(resolution.tarball, synthesized);
      }
    }
    for (const section of LOCKFILE_DEP_SECTIONS) {
      const deps = record[section] as Record<string, unknown> | undefined;
      if (!deps || typeof deps !== 'object') {
        continue;
      }
      for (const [name, ref] of Object.entries(deps)) {
        if (typeof ref === 'string') {
          deps[name] = containFileToken(ref, synthesized);
        }
      }
    }
  };

  if (lockfile.packages) {
    const contained: Lockfile['packages'] = {};
    for (const [key, snapshot] of Object.entries(lockfile.packages)) {
      containSnapshot(snapshot);
      contained[containFileToken(key, synthesized)] = snapshot;
    }
    lockfile.packages = contained;
  }
  for (const importer of Object.values(lockfile.importers ?? {})) {
    containSnapshot(importer);
  }
}

/**
 * Relocates the shippable `link:` refs a source lockfile's package snapshots
 * carry, so they resolve from the pruned output's root. pnpm reads a snapshot
 * `link:` ref against the lockfile directory, which is the workspace root at
 * source and the deploy root in the output, so a ref left verbatim points at a
 * path the standalone output does not carry once the target ships under
 * `LOCAL_PATH_MODULES_DIR`. A target that cannot ship keeps its ref, matching
 * the copied manifest; the artifact collector reports why.
 *
 * Takes the source snapshots alone rather than the assembled document: the
 * assembly relocates its own refs at their synthesis site, and a second pass
 * cannot tell an already-relocated path from a workspace path that starts with
 * the shipped directory's name. Mutates the snapshots in place.
 */
export function containShippedLocalLinkRefs(
  sourceSnapshots: Record<string, unknown> | undefined
): void {
  for (const snapshot of Object.values(sourceSnapshots ?? {})) {
    if (!snapshot || typeof snapshot !== 'object') {
      continue;
    }
    const record = snapshot as Record<string, unknown>;
    for (const section of LOCKFILE_DEP_SECTIONS) {
      const deps = record[section] as Record<string, unknown> | undefined;
      if (!deps || typeof deps !== 'object') {
        continue;
      }
      for (const [name, ref] of Object.entries(deps)) {
        if (typeof ref !== 'string' || !ref.startsWith('link:')) {
          continue;
        }
        deps[name] = relocatePrunedLocalPathSpec(ref, '', '')?.spec ?? ref;
      }
    }
  }
}

const LOCKFILE_DEP_SECTIONS = [
  'dependencies',
  'optionalDependencies',
  'devDependencies',
] as const;

// A pruned lockfile dep ref is a plain ref string (pre-v9 importers, all package
// snapshots) or an inline `{ specifier, version }` object (v9 importers).
type PrunedLockfileDepRef = string | { version?: string };
type PrunedLockfileSnapshot = {
  resolution?: { tarball?: string; directory?: string };
  dependencies?: Record<string, PrunedLockfileDepRef>;
  optionalDependencies?: Record<string, PrunedLockfileDepRef>;
  devDependencies?: Record<string, PrunedLockfileDepRef>;
};

/** True when a workspace-root-relative path escapes the output root. */
function localPathEscapesOutput(wsRelativePath: string): boolean {
  // An absolute path counts as escaping: join(workspaceRoot, target) would
  // silently rebase it under the workspace root instead of resolving it.
  return (
    isAbsolute(wsRelativePath) || wsRelativePath.split(/[\\/]/).includes('..')
  );
}

/** True when a resolution `directory` points at a copied workspace module. */
function isUnderWorkspaceModules(directory: string): boolean {
  return (
    directory === WORKSPACE_MODULES_DIR ||
    directory.startsWith(`${WORKSPACE_MODULES_DIR}/`) ||
    directory.startsWith(`${WORKSPACE_MODULES_DIR}\\`)
  );
}

/**
 * pnpm resolves every pruned-lockfile `link:` ref relative to the lockfile
 * directory: snapshot refs are read against it directly, and the output's only
 * importer is `.`, the lockfile directory itself. Normalize the ref to a
 * workspace-root-relative posix path. An absolute target is returned as-is
 * (join would rebase it) so the escape check can reject it.
 */
function resolveLinkTarget(linkRef: string): string {
  const refPath = linkRef.slice('link:'.length);
  return normalizePath(isAbsolute(refPath) ? refPath : join(refPath));
}

type ParsedPrunedLockfile = {
  packages?: Record<string, PrunedLockfileSnapshot>;
  snapshots?: Record<string, PrunedLockfileSnapshot>;
  importers?: Record<string, PrunedLockfileSnapshot>;
};

function parsePrunedLockfile(content: string): ParsedPrunedLockfile | null {
  return parsePnpmLockfileYaml(content) as ParsedPrunedLockfile | null;
}

/**
 * The non-workspace `link:` target directories the pruned lockfile references
 * (root importer versions and package snapshot refs, e.g. from copied
 * workspace modules and vendored `file:` directories), each resolved to a
 * workspace-root-relative posix path paired with the lockfile ref it came from.
 * Targets under `workspace_modules/` are excluded (copy-workspace-modules ships
 * those); a target that escapes the workspace root is included so the caller
 * can report it; a target that is the workspace root itself is skipped with a
 * warning (shipping it would copy the entire workspace).
 */
// The link-closure validator and the local-path artifact collector both walk
// the same parsed lockfile in one prune run; caching per document runs the walk
// (and its warnings) once. Callers must not mutate the returned array.
const collectedPrunedLinkTargets = new WeakMap<
  ParsedPrunedLockfile,
  Array<{ target: string; ref: string }>
>();

function collectPrunedLinkTargetDirs(
  parsed: ParsedPrunedLockfile
): Array<{ target: string; ref: string }> {
  const cached = collectedPrunedLinkTargets.get(parsed);
  if (cached) {
    return cached;
  }
  const targets = new Map<string, string>();
  const addRef = (value: PrunedLockfileDepRef): void => {
    const ref = typeof value === 'string' ? value : value?.version;
    if (typeof ref !== 'string' || !ref.startsWith('link:')) {
      return;
    }
    const target = resolveLinkTarget(ref);
    if (target === '' || target === '.') {
      logger.warn(
        `Local-path dependency "${ref}" resolves to the workspace root itself and cannot be shipped into the pruned output.`
      );
      return;
    }
    if (!isUnderWorkspaceModules(target) && !targets.has(target)) {
      targets.set(target, ref);
    }
  };

  // Every link: ref resolves from the lockfile dir (see resolveLinkTarget), so
  // scan the root importer and both dependency-carrying package sections.
  const rootImporter = parsed.importers?.['.'] ?? {};
  for (const section of LOCKFILE_DEP_SECTIONS) {
    for (const value of Object.values(rootImporter[section] ?? {})) {
      addRef(value);
    }
  }
  for (const section of [parsed.snapshots, parsed.packages]) {
    for (const snapshot of Object.values(section ?? {})) {
      for (const depSection of LOCKFILE_DEP_SECTIONS) {
        for (const value of Object.values(snapshot?.[depSection] ?? {})) {
          addRef(value);
        }
      }
    }
  }
  const result = [...targets].map(([target, ref]) => ({ target, ref }));
  collectedPrunedLinkTargets.set(parsed, result);
  return result;
}

/**
 * The non-workspace local-path packages a standalone pruned output must ship so
 * `pnpm install` can resolve them, each as `{ path, sourcePath }` (path relative
 * to the output root, sourcePath the absolute file to ship there). The pruned
 * lockfile records each such path relocated under `LOCAL_PATH_MODULES_DIR` (see
 * containLocalPath), so `path` ships there while `sourcePath` reads from the
 * original workspace location (uncontainLocalPath). Three shapes are shipped:
 * - a `file:` tarball (`resolution.tarball`) -> the `.tgz` file.
 * - a `file:` directory (`resolution.directory`) not under `workspace_modules/`
 *   -> the directory tree (copied workspace modules carry a `workspace_modules/`
 *   directory resolution and are shipped by copy-workspace-modules, so they are
 *   skipped here).
 * - a `link:` target (a root importer `link:` version, or a package `link:`
 *   snapshot ref) -> the target directory tree.
 * `node_modules` is filtered from every directory copy; a symlink inside a
 * shipped tree is skipped with a warning, while a symlinked root ships when it
 * resolves under the workspace root; entries are deduped by destination. A source
 * that resolves outside the workspace root, or is missing on disk, is skipped
 * with a warning (it is not reproducibly deployable). Returns source paths rather than
 * bytes so the file-writing prune paths can copy without buffering whole trees;
 * the bundler asset pipelines read the bytes as they emit.
 */
export function getPrunedPnpmLocalPathArtifacts(
  workspaceRootPath: string = workspaceRoot,
  prunedLockfileContent?: string
): Array<{ path: string; sourcePath: string }> {
  if (!prunedLockfileContent) {
    return [];
  }
  const parsed = parsePrunedLockfile(prunedLockfileContent);
  if (!parsed) {
    return [];
  }

  const artifacts: Array<{ path: string; sourcePath: string }> = [];
  const shippedRoots = new Set<string>();
  const seenDestinations = new Set<string>();

  // Compared against every resolved source below, so the containment check is
  // not defeated by a workspace root that is itself reached through a link
  // (`/tmp` on macOS). Falls back to the declared root when it cannot be
  // resolved; the per-target resolution then reports the failure.
  let workspaceRootRealPath: string;
  try {
    workspaceRootRealPath = realpathSync(workspaceRootPath);
  } catch {
    workspaceRootRealPath = workspaceRootPath;
  }

  // The absolute source for a shippable target, or null (with a warning) when
  // the target escapes the workspace root or is missing on disk.
  const resolveShippableSource = (
    wsRelativePath: string,
    origin: string
  ): string | null => {
    const resolution = resolveLocalPathSource(
      wsRelativePath,
      workspaceRootPath,
      workspaceRootRealPath
    );
    if (resolution.source) {
      return resolution.source;
    }
    if (resolution.reason === 'missing') {
      logger.warn(
        `Local-path dependency "${origin}" was not found at ${resolution.attempted}; the pruned output references it but cannot ship it.`
      );
    } else if (resolution.reason === 'workspace-root') {
      warnUnshippableLocalPathSpec(`"${origin}"`, 'workspace-root');
    } else {
      logger.warn(
        resolution.resolved
          ? `Local-path dependency "${origin}" resolves to ${resolution.resolved}, outside the workspace root, and cannot be shipped into the pruned output. Vendor it inside the workspace to deploy it.`
          : `Local-path dependency "${origin}" resolves outside the workspace root and cannot be shipped into the pruned output. Vendor it inside the workspace to deploy it.`
      );
    }
    return null;
  };

  // Callers pass the shipped path (relocated under LOCAL_PATH_MODULES_DIR, as the
  // pruned lockfile records it); it is the artifact destination, while the source
  // is read from the original workspace location.
  const shipFile = (shippedPath: string, origin: string): void => {
    if (shippedRoots.has(shippedPath)) {
      return;
    }
    shippedRoots.add(shippedPath);
    const source = resolveShippableSource(
      uncontainLocalPath(shippedPath),
      origin
    );
    if (!source || seenDestinations.has(shippedPath)) {
      return;
    }
    seenDestinations.add(shippedPath);
    artifacts.push({ path: shippedPath, sourcePath: source });
  };

  const shipDirectory = (shippedPath: string, origin: string): void => {
    if (shippedRoots.has(shippedPath)) {
      return;
    }
    shippedRoots.add(shippedPath);
    const source = resolveShippableSource(
      uncontainLocalPath(shippedPath),
      origin
    );
    if (!source) {
      return;
    }
    if (!statSync(source).isDirectory()) {
      logger.warn(
        `Local-path dependency "${origin}" is not a directory at ${source}; the pruned output references it but cannot ship it.`
      );
      return;
    }
    // Walk the tree, skipping node_modules, deduping by destination.
    const walk = (absoluteDir: string, destinationDir: string): void => {
      for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') {
          continue;
        }
        const absoluteEntry = join(absoluteDir, entry.name);
        const destinationEntry = `${destinationDir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(absoluteEntry, destinationEntry);
        } else if (entry.isFile()) {
          if (seenDestinations.has(destinationEntry)) {
            continue;
          }
          seenDestinations.add(destinationEntry);
          artifacts.push({ path: destinationEntry, sourcePath: absoluteEntry });
        } else if (entry.isSymbolicLink()) {
          // Following links risks cycles and machine-specific targets, so they
          // are not shipped; surface the gap instead of silently dropping it.
          logger.warn(
            `Local-path dependency "${origin}" contains a symbolic link at ${absoluteEntry}, which is not shipped into the pruned output.`
          );
        }
      }
    };
    walk(source, shippedPath);
  };

  // file: tarball + file: directory resolutions (resolutions live in `packages`).
  for (const snapshot of Object.values(parsed.packages ?? {})) {
    const tarball = snapshot?.resolution?.tarball;
    if (tarball?.startsWith('file:')) {
      shipFile(tarball.slice('file:'.length), tarball);
      continue;
    }
    const directory = snapshot?.resolution?.directory;
    if (directory && !isUnderWorkspaceModules(directory)) {
      shipDirectory(normalizePath(directory), `file:${directory}`);
    }
  }

  // link: targets (root importer versions + directory-package snapshot refs).
  for (const { target, ref } of collectPrunedLinkTargetDirs(parsed)) {
    shipDirectory(target, ref);
  }

  return artifacts;
}

/**
 * Whether the pruned lockfile references a non-workspace local path at all.
 * Reads the same refs as `getPrunedPnpmLocalPathArtifacts` without walking the
 * trees behind them, so a caller that only needs the answer neither lists every
 * shipped file nor repeats that function's per-target warnings.
 */
function prunedLockfileReferencesLocalPaths(
  prunedLockfileContent: string
): boolean {
  const parsed = parsePrunedLockfile(prunedLockfileContent);
  if (!parsed) {
    return false;
  }
  for (const snapshot of Object.values(parsed.packages ?? {})) {
    if (snapshot?.resolution?.tarball?.startsWith('file:')) {
      return true;
    }
    const directory = snapshot?.resolution?.directory;
    if (directory && !isUnderWorkspaceModules(directory)) {
      return true;
    }
  }
  return collectPrunedLinkTargetDirs(parsed).length > 0;
}

/**
 * Fails the pruned build when a shipped local-path target has a required
 * dependency that will not be resolvable in the standalone deploy. Two shapes
 * are validated:
 * - a `link:` target: a symlink, not a packed package, so pnpm never installs
 *   the linked target's own dependency closure.
 * - a `file:` directory package whose lockfile entry carries no dependency
 *   edges (a peer backfilled by the pnpm lock-file parser when
 *   `autoInstallPeers` is off; pnpm never resolved its closure at source).
 * In both cases the target itself installs, `pnpm install --frozen-lockfile`
 * exits 0, and the target resolves its `require`s only from the deploy-root
 * node_modules, i.e. the app's direct dependencies.
 * A required dep of the target that is not a direct (or optional) dependency of
 * the final app manifest would fail at runtime with MODULE_NOT_FOUND, so this
 * throws at build time with the remedy.
 *
 * Only a required dep absent from the app's installed direct deps fails. A peer
 * or optional dep of the target, or a required dep present only in the app's
 * devDependencies (a `--prod` install may omit it), warns instead; these are not
 * provably broken. The app's own peerDependencies count as installed: the pruned
 * lockfile's root importer folds them into `dependencies` (mirroring pnpm's
 * autoInstallPeers), so the deploy install provides them. A backfilled `file:`
 * tarball peer's manifest is inside the archive and is not read, so its closure
 * is not validated. pnpm-only; call sites gate on the package manager.
 */
export function validatePrunedLocalPathClosure(
  packageJson: PackageJson,
  workspaceRootPath: string,
  prunedLockfileContent?: string
): void {
  if (!prunedLockfileContent) {
    return;
  }
  const parsed = parsePrunedLockfile(prunedLockfileContent);
  if (!parsed) {
    return;
  }
  // Targets are keyed by their original workspace source path (the pruned
  // lockfile records them relocated under LOCAL_PATH_MODULES_DIR; strip it back
  // to read the target's manifest from disk).
  const targets = new Map<string, 'link' | 'directory'>();
  // Copied workspace modules and entries with resolved edges install their
  // recorded closure and are skipped; a link: target for the same path wins the
  // kind so the failure message names the sharper cause.
  for (const [key, entry] of Object.entries(parsed.packages ?? {})) {
    const directory = entry?.resolution?.directory;
    if (!directory || isUnderWorkspaceModules(directory)) {
      continue;
    }
    const source = uncontainLocalPath(normalizePath(directory)).replace(
      /\/+$/,
      ''
    );
    // The workspace root is not a shippable target, and validating it would
    // fail the build over the root manifest's own dependencies.
    if (source === '' || source === '.' || localPathEscapesOutput(source)) {
      continue;
    }
    const snapshot = parsed.snapshots?.[key] ?? entry;
    const hasEdges = LOCKFILE_DEP_SECTIONS.some(
      (section) => Object.keys(snapshot?.[section] ?? {}).length > 0
    );
    if (!hasEdges) {
      targets.set(source, 'directory');
    }
  }
  for (const { target } of collectPrunedLinkTargetDirs(parsed)) {
    const source = uncontainLocalPath(target);
    if (!localPathEscapesOutput(source)) {
      targets.set(source, 'link');
    }
  }
  if (targets.size === 0) {
    return;
  }
  const rootInstalled = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ]);
  const rootDev = new Set(Object.keys(packageJson.devDependencies ?? {}));
  const appName = packageJson.name || 'the app';
  let workspaceRootRealPath: string;
  try {
    workspaceRootRealPath = realpathSync(workspaceRootPath);
  } catch {
    workspaceRootRealPath = workspaceRootPath;
  }

  for (const [target, kind] of targets) {
    // A target the output cannot carry has no closure to break in the deploy,
    // and the artifact collector reports why it cannot ship. Resolving it here
    // too is what keeps a symlinked target from failing the build over the
    // manifest of whatever it points at.
    if (
      !resolveLocalPathSource(target, workspaceRootPath, workspaceRootRealPath)
        .source
    ) {
      continue;
    }
    const manifestPath = join(workspaceRootPath, target, 'package.json');
    if (!existsSync(manifestPath)) {
      continue;
    }
    const descriptor = kind === 'link' ? 'linked package' : 'local package';
    let targetManifest: PackageJson;
    try {
      targetManifest = readJsonFile(manifestPath);
    } catch {
      logger.warn(
        `${descriptor} ${target} has an unreadable package.json at ${manifestPath}; its dependency closure was not validated for the standalone deploy.`
      );
      continue;
    }
    const targetName = targetManifest.name || target;

    for (const dep of Object.keys(targetManifest.dependencies ?? {})) {
      if (rootInstalled.has(dep)) {
        continue;
      }
      if (rootDev.has(dep)) {
        logger.warn(
          `${descriptor} ${targetName} requires ${dep}, which is only a devDependency of ${appName}; a production (--prod) install of the standalone deploy would omit it.`
        );
        continue;
      }
      throw new Error(
        kind === 'link'
          ? `linked package ${targetName} requires ${dep}, which won't be resolvable in the standalone deploy (link: cannot provide a self-contained dependency closure). Convert ${targetName} to a file: dependency for a self-contained artifact, or add ${dep} to ${appName}'s dependencies.`
          : `local package ${targetName} requires ${dep}, which won't be resolvable in the standalone deploy (its dependency closure was never resolved into the pruned lockfile). Declare ${targetName} as a regular dependency of the package that peer-depends on it, enable autoInstallPeers, or add ${dep} to ${appName}'s dependencies.`
      );
    }

    for (const dep of [
      ...Object.keys(targetManifest.peerDependencies ?? {}),
      ...Object.keys(targetManifest.optionalDependencies ?? {}),
    ]) {
      if (rootInstalled.has(dep) || rootDev.has(dep)) {
        continue;
      }
      logger.warn(
        `${descriptor} ${targetName} may need ${dep} at runtime, which is not a dependency of ${appName}; add it to ${appName} if it fails to resolve.`
      );
    }
  }
}

/**
 * Relocates a `file:`/`link:` specifier recorded relative to `sourceDir` so it
 * resolves from `destDir` (both workspace-root-relative posix paths, '' meaning
 * the workspace root itself) to the target's shipped location under
 * `LOCAL_PATH_MODULES_DIR`. Returns null for a non-local-path spec. When the
 * target cannot ship into the pruned output, `spec` is returned unchanged with
 * the `reason`: absolute or escaping the workspace root (`outside-workspace`),
 * or the workspace root itself (`workspace-root`).
 * Every layer of the pruned output (app manifest, copied-module manifests,
 * lockfile snapshot refs) relocates through this one function so the layers
 * cannot disagree.
 */
export function relocatePrunedLocalPathSpec(
  spec: string,
  sourceDir: string,
  destDir: string
): { spec: string; reason?: 'outside-workspace' | 'workspace-root' } | null {
  const protocol = spec.startsWith('link:')
    ? 'link:'
    : spec.startsWith('file:')
      ? 'file:'
      : null;
  if (!protocol) {
    return null;
  }
  // Normalize separators before joining, matching the artifact shipping side:
  // a backslash-authored spec is one opaque segment to a posix join(), so its
  // `..` never resolves and an in-workspace target reads as escaping.
  const rawPath = normalizePath(spec.slice(protocol.length));
  // join() does not reset on an absolute segment; it would silently rebase the
  // target under sourceDir, so reject absolutes up front.
  if (isAbsolute(rawPath)) {
    return { spec, reason: 'outside-workspace' };
  }
  // join() keeps a trailing separator, so `../../` arrives as './' rather than
  // '.' and would slip past the workspace-root check below.
  const wsRelativeTarget = normalizePath(join(sourceDir, rawPath)).replace(
    /\/+$/,
    ''
  );
  // A `..` segment escapes the workspace, and so does an absolute result: the
  // absolute-spec check above cannot see an absolute `sourceDir`, which join()
  // carries through and containment would turn into
  // `local_path_modules//abs/...`, a path the output never ships.
  if (
    isAbsolute(wsRelativeTarget) ||
    wsRelativeTarget.split('/').includes('..')
  ) {
    return { spec, reason: 'outside-workspace' };
  }
  if (wsRelativeTarget === '' || wsRelativeTarget === '.') {
    return { spec, reason: 'workspace-root' };
  }
  // The target ships under LOCAL_PATH_MODULES_DIR (see containLocalPath), so
  // resolve the spec against its shipped location, not its workspace path.
  const shippedTarget = containLocalPath(wsRelativeTarget);
  const relocated =
    destDir === '' || destDir === '.'
      ? shippedTarget
      : normalizePath(relative(destDir, shippedTarget));
  return { spec: `${protocol}${relocated}` };
}

/**
 * Warns when a pruned pnpm lockfile needs install-time artifacts that only
 * `generatePrunedDeployOutput` ships, naming the ones this workspace actually
 * needs. For callers of
 * the bare `createLockFile`, which hands back a lockfile and nothing else: the
 * pieces below live outside it, so an output assembled from the lockfile and
 * the manifest alone installs without the workspace's build-script approvals,
 * patches, or vendored local paths. Silent when the workspace needs none of
 * them, which is the common case.
 */
export function warnIncompletePrunedPnpmOutput(
  lockFileContent: string,
  workspaceRootPath: string = workspaceRoot
): void {
  const missing: string[] = [];
  // Keyed on the approvals themselves rather than on the emitted file, which a
  // workspace declaring only patches still gets.
  const workspaceSettings = getPrunedPnpmWorkspaceSettings(
    workspaceRootPath,
    lockFileContent
  );
  if (
    workspaceSettings?.allowBuilds !== undefined ||
    workspaceSettings?.supportedArchitectures !== undefined ||
    getPrunedPnpmPackageJsonBuildSettings(workspaceRootPath, lockFileContent)
  ) {
    missing.push(
      'the build-script approvals and supportedArchitectures the workspace declares'
    );
  }
  if (
    Object.keys(
      getPrunedPatchedDependencies(workspaceRootPath, lockFileContent)
    ).length > 0
  ) {
    missing.push('the patch files its patchedDependencies declare');
  }
  if (prunedLockfileReferencesLocalPaths(lockFileContent)) {
    missing.push('the vendored file:/link: dependencies it references');
  }
  if (missing.length === 0) {
    return;
  }
  output.warn({
    title: 'The pruned pnpm lockfile needs artifacts this call does not return',
    bodyLines: [
      `A standalone install of the output will be missing ${missing.join(
        ', and '
      )}.`,
      'Use generatePrunedDeployOutput to ship them.',
    ],
  });
}

/** Warns that a local-path target cannot ship, with the reason-specific remedy. */
export function warnUnshippableLocalPathSpec(
  description: string,
  reason: 'outside-workspace' | 'workspace-root'
): void {
  logger.warn(
    reason === 'workspace-root'
      ? `Local-path dependency ${description} resolves to the workspace root itself and cannot be shipped into the pruned output.`
      : `Local-path dependency ${description} resolves outside the workspace root and cannot be shipped into the pruned output. Vendor it inside the workspace to deploy it.`
  );
}

/**
 * The manifest shape the peer-dependency helpers below touch. Kept structural so
 * the copied-module manifests the `@nx/js` prune executors carry, which are not
 * full `PackageJson`s, go through the same helpers.
 */
type PeerDependencyManifest = {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, unknown>;
};

/**
 * Moves a peer dependency into `dependencies` under the given specifier: pnpm
 * rejects a `file:`/`link:` spec under peerDependencies outright, so a shipped
 * local path or workspace module declared there would fail the whole install.
 * The `peerDependenciesMeta` entry goes with it, since the optional/required
 * marker is orphaned once the dependency is no longer a peer.
 */
export function movePeerDependencyToDependencies(
  packageJson: PeerDependencyManifest,
  name: string,
  spec: string
): void {
  (packageJson.dependencies ??= {})[name] = spec;
  if (packageJson.peerDependencies) {
    delete packageJson.peerDependencies[name];
  }
  if (packageJson.peerDependenciesMeta) {
    delete packageJson.peerDependenciesMeta[name];
  }
}

/**
 * Drops a `peerDependencies`/`peerDependenciesMeta` section left empty by
 * `movePeerDependencyToDependencies`, so a manifest that declared nothing but
 * moved peers does not ship an empty section.
 */
export function dropEmptyPeerDependencySections(
  packageJson: PeerDependencyManifest
): void {
  if (
    packageJson.peerDependencies &&
    Object.keys(packageJson.peerDependencies).length === 0
  ) {
    delete packageJson.peerDependencies;
  }
  if (
    packageJson.peerDependenciesMeta &&
    Object.keys(packageJson.peerDependenciesMeta).length === 0
  ) {
    delete packageJson.peerDependenciesMeta;
  }
}

/**
 * Rewrites a standalone pruned manifest's non-workspace local-path specifiers
 * (`file:` tarball/dir, `link:` dir) to their shipped location under
 * `LOCAL_PATH_MODULES_DIR`, so a non-frozen `pnpm install` of the deploy output
 * resolves them: pnpm re-resolves a manifest specifier relative to the
 * referencing package, and the deploy root is the workspace root, so the shipped
 * source (see `getPrunedPnpmLocalPathArtifacts`) sits at that relocated path.
 * Mutates `packageJson` in place. pnpm-only; call sites gate on the package
 * manager (the rewrite must not touch npm/yarn/bun manifests).
 *
 * Per specifier, in order: resolve a `catalog:` reference first (the bundler's
 * `createPackageJson` does not), skip a workspace package (copied to
 * `workspace_modules/`), then relocate a non-workspace local path from
 * `projectRoot`-relative to its shipped location. A `file:`/`link:` peer
 * dependency is moved into `dependencies` with its `peerDependenciesMeta` entry
 * dropped even when the target cannot ship (pnpm rejects a `file:`/`link:` spec
 * under peerDependencies outright, so leaving it would fail the whole install),
 * mirroring the workspace-module handling. An unshippable target otherwise keeps
 * its specifier, with a warning (see `getPrunedPnpmLocalPathArtifacts`).
 */
export function rewritePrunedLocalPathSpecifiers(
  packageJson: PackageJson,
  projectRoot: string,
  workspaceRootPath: string,
  workspacePackageNames: Set<string>
): void {
  const catalogManager = getCatalogManager(workspaceRootPath);
  const sections: PackageJsonDependencySection[] = [
    'dependencies',
    'optionalDependencies',
    'devDependencies',
    'peerDependencies',
  ];
  for (const section of sections) {
    const deps = packageJson[section];
    if (!deps) {
      continue;
    }
    for (const [name, specifier] of Object.entries(deps)) {
      let resolved = specifier;
      if (catalogManager?.isCatalogReference(specifier)) {
        const resolvedCatalog = catalogManager.resolveCatalogReference(
          workspaceRootPath,
          name,
          specifier
        );
        if (resolvedCatalog) {
          resolved = resolvedCatalog;
          deps[name] = resolvedCatalog;
        }
      }
      if (workspacePackageNames.has(name)) {
        continue;
      }
      const relocation = relocatePrunedLocalPathSpec(resolved, projectRoot, '');
      if (!relocation) {
        continue;
      }
      if (relocation.reason) {
        warnUnshippableLocalPathSpec(
          `"${name}": "${resolved}"`,
          relocation.reason
        );
      }
      if (section === 'peerDependencies') {
        // Moved even when the target cannot ship: pnpm rejects the spec here
        // either way, so leaving it would fail the whole install.
        movePeerDependencyToDependencies(packageJson, name, relocation.spec);
      } else if (!relocation.reason) {
        deps[name] = relocation.spec;
      }
    }
  }
  dropEmptyPeerDependencySections(packageJson);
}

export type PrunedDeployArtifact =
  | { path: string; content: string | Buffer; sourcePath?: never }
  | { path: string; sourcePath: string; content?: never };

/**
 * The pnpm install-time artifacts a standalone pruned output needs, as data for
 * a caller to write or emit: the settings-only pnpm-workspace.yaml (see
 * `getPrunedPnpmInstallSettingsYaml`), the `pnpm patch` files, and the
 * non-workspace local-path dependencies (`file:` tarballs/dirs and `link:`
 * targets, see `getPrunedPnpmLocalPathArtifacts`). The last are carried as a
 * source path rather than content so a directory sink can copy them straight
 * across. Everything is resolved before returning, so a colliding patch path
 * aborts before the caller ships anything.
 *
 * The pnpm <=10 build-script approvals and `patchedDependencies` declaration are
 * folded onto `packageJson` in place (see
 * `getPrunedPnpmPackageJsonBuildSettings`), so write or emit the manifest after
 * this returns.
 *
 * Pass `includeLocalPathArtifacts: false` when the lockfile is the root-lockfile
 * fallback, which `createPrunedLockfile` reports as `pruned: false`: its importer
 * references the whole workspace, so shipping its local-path trees would copy
 * unrelated sources into the output.
 */
export function getPrunedPnpmInstallArtifacts(
  workspaceRootPath: string,
  prunedLockfileContent: string,
  packageJson: PackageJson,
  options?: { includeLocalPathArtifacts?: boolean }
): PrunedDeployArtifact[] {
  const config: PrunedPnpmConfig = {
    pnpmMajor: getPnpmMajorOrWarn(workspaceRootPath),
    patchedDependencies: getPrunedPatchedDependencies(
      workspaceRootPath,
      prunedLockfileContent
    ),
  };
  const { patchFiles, packageJsonPatchedDependencies } =
    getPrunedPnpmPatchArtifacts(
      workspaceRootPath,
      prunedLockfileContent,
      config
    );
  const yaml = getPrunedPnpmInstallSettingsYaml(
    workspaceRootPath,
    prunedLockfileContent,
    config
  );
  const artifacts: PrunedDeployArtifact[] = [
    { path: 'pnpm-workspace.yaml', content: yaml },
  ];
  artifacts.push(...patchFiles);
  if (options?.includeLocalPathArtifacts !== false) {
    artifacts.push(
      ...getPrunedPnpmLocalPathArtifacts(
        workspaceRootPath,
        prunedLockfileContent
      )
    );
  }
  const buildSettings = getPrunedPnpmPackageJsonBuildSettings(
    workspaceRootPath,
    prunedLockfileContent,
    config
  );
  applyPrunedPnpmPackageJsonSettings(
    packageJson,
    buildSettings,
    packageJsonPatchedDependencies
  );
  return artifacts;
}
