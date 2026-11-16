import { readJsonFile, type PackageManager } from '@nx/devkit';
import {
  parseVersionFromPackageManagerField,
  type JsonInput,
} from '@nx/devkit/internal';
import { join } from 'path';

/**
 * Task inputs covering the sources of the pnpm install settings a pruned
 * deploy output carries (build-script approvals, `supportedArchitectures`,
 * `patchedDependencies`). Nothing else in a build target's default hash moves
 * when an approval is revoked, so a target that emits the deploy output must
 * hash these or a cached run replays an output that still grants it. The
 * manifest is narrowed to the fields the output is built from so dependency
 * bumps in the root package.json do not invalidate every build.
 *
 * The pnpm major selects which emitted file carries the settings (pnpm 11+
 * reads them from pnpm-workspace.yaml, pnpm <=10 from the emitted
 * package.json). The manifest's `packageManager` field pins it when it
 * parses to a pnpm version; the runtime probe covers the ambient binary that
 * decides it otherwise, printing only the major so pnpm patch and minor
 * releases do not move the hash, and a sentinel when the binary is missing
 * (the hasher records the probe's output without checking its exit status,
 * so a missing binary does not fail the hash). The full set keeps the probe
 * even under a valid pin: the generator and the migrations write inputs
 * once, and the pin can be removed later. Plugins re-infer on every graph
 * build, so they use {@link pnpmInstallSettingsInputsForInferredTarget} to
 * add the probe only while no valid pin exists.
 *
 * The contents of vendored non-workspace local-path dependencies also ship in
 * the deploy output but are not covered: their set is derived from the
 * lockfile at build time, so no static input list stays correct as
 * dependencies change. Covering them needs content hashing at the graph level
 * (the pnpm parser's directory/link external nodes hash only name and path).
 */
export const PNPM_MAJOR_RUNTIME_INPUT: { runtime: string } = {
  runtime: `node -e "try{console.log('pnpm major '+require('child_process').execSync('pnpm --version',{stdio:['ignore','pipe','ignore']}).toString().trim().split('.')[0])}catch{console.log('pnpm major unavailable')}"`,
};

const PNPM_INSTALL_SETTINGS_FILE_INPUTS: (string | JsonInput)[] = [
  '{workspaceRoot}/pnpm-workspace.yaml',
  {
    json: '{workspaceRoot}/package.json',
    fields: [
      'packageManager',
      'pnpm.onlyBuiltDependencies',
      'pnpm.neverBuiltDependencies',
      'pnpm.allowBuilds',
      'pnpm.supportedArchitectures',
      'pnpm.patchedDependencies',
    ],
  },
];

export const PNPM_INSTALL_SETTINGS_INPUTS: (
  | string
  | JsonInput
  | { runtime: string }
)[] = [...PNPM_INSTALL_SETTINGS_FILE_INPUTS, PNPM_MAJOR_RUNTIME_INPUT];

export function pnpmInstallSettingsInputsForInferredTarget(
  includePnpmMajorRuntimeInput: boolean
): (string | JsonInput | { runtime: string })[] {
  return includePnpmMajorRuntimeInput
    ? [...PNPM_INSTALL_SETTINGS_FILE_INPUTS, PNPM_MAJOR_RUNTIME_INPUT]
    : [...PNPM_INSTALL_SETTINGS_FILE_INPUTS];
}

/**
 * Whether an inferred build target needs the runtime probe: the workspace uses
 * pnpm and the root `packageManager` field does not pin a pnpm version. A
 * missing or unreadable root manifest cannot pin one, so it counts as no pin.
 */
export function shouldIncludePnpmMajorRuntimeInput(
  packageManager: PackageManager,
  workspaceRoot: string
): boolean {
  if (packageManager !== 'pnpm') {
    return false;
  }
  let field: unknown;
  try {
    field = readJsonFile(join(workspaceRoot, 'package.json'))?.packageManager;
  } catch {
    field = undefined;
  }
  return (
    parseVersionFromPackageManagerField(
      'pnpm',
      typeof field === 'string' ? field : undefined
    ) === null
  );
}
