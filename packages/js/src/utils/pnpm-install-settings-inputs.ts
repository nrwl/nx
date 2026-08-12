import type { JsonInput } from '@nx/devkit/internal';

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
 * package.json). The manifest's `packageManager` field pins it when present;
 * the runtime probe covers the ambient binary that decides it otherwise,
 * printing only the major so pnpm patch and minor releases do not move the
 * hash, and a sentinel when the binary is missing (the hasher records the
 * probe's output without checking its exit status, so a missing binary does
 * not fail the hash).
 *
 * The contents of vendored non-workspace local-path dependencies also ship in
 * the deploy output but are not covered: their set is derived from the
 * lockfile at build time, so no static input list stays correct as
 * dependencies change. Covering them needs content hashing at the graph level
 * (the pnpm parser's directory/link external nodes hash only name and path).
 */
export const PNPM_INSTALL_SETTINGS_INPUTS: (
  | string
  | JsonInput
  | { runtime: string }
)[] = [
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
  {
    runtime: `node -e "try{console.log('pnpm major '+require('child_process').execSync('pnpm --version',{stdio:['ignore','pipe','ignore']}).toString().trim().split('.')[0])}catch{console.log('pnpm major unavailable')}"`,
  },
];
