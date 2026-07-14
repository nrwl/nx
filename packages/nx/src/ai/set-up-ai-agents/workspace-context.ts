import {
  getPackageManagerCommand,
  type PackageManager,
} from '../../utils/package-manager';

/**
 * The schema the skill templates in `nrwl/nx-ai-agents-config` are written against.
 *
 * Bumping this means reading a different `templates/<version>` directory. Adding a fact is
 * backwards-compatible — templates guard every fact, so an older nx simply renders the
 * fallback branch. Removing or reshaping one is not, and needs a new version there first.
 */
export const TEMPLATES_SCHEMA_VERSION = 'v1';

/** A workspace fact the skills would otherwise tell the agent to go and determine. */
export interface PackageManagerContext {
  name: PackageManager;
  /** How to invoke nx here, e.g. `npm exec nx`. */
  nx: string;
  exec: string;
  dlx: string;
  add: string;
  addDev: string;
  install: string;
  workspaceGlobFile: string;
  supportsWorkspaceProtocol: boolean;
}

export interface WorkspaceContext {
  pm: PackageManagerContext | null;
}

/**
 * How nx is invoked under each package manager.
 *
 * This is deliberately not `getPackageManagerCommand().exec` — `exec` answers "run a local
 * binary" (`npx`), which is a different question than "run nx in this workspace"
 * (`npm exec nx`). Using one for the other is what produces docs that prefix nx two
 * different ways on the same page.
 */
const NX_INVOCATION: Record<PackageManager, string> = {
  npm: 'npm exec nx',
  yarn: 'yarn nx',
  pnpm: 'pnpm nx',
  bun: 'bunx nx',
};

const WORKSPACE_GLOB_FILE: Record<PackageManager, string> = {
  npm: 'the `workspaces` field in the root `package.json`',
  yarn: 'the `workspaces` field in the root `package.json`',
  pnpm: '`pnpm-workspace.yaml`',
  bun: 'the `workspaces` field in the root `package.json`',
};

export function getWorkspaceContext(
  packageManager: PackageManager | undefined,
  root: string
): WorkspaceContext {
  if (!packageManager) {
    return { pm: null };
  }

  const commands = getPackageManagerCommand(packageManager, root);

  return {
    pm: {
      name: packageManager,
      nx: NX_INVOCATION[packageManager],
      exec: commands.exec,
      dlx: commands.dlx,
      add: commands.add,
      addDev: commands.addDev,
      install: commands.install,
      workspaceGlobFile: WORKSPACE_GLOB_FILE[packageManager],
      supportsWorkspaceProtocol: packageManager !== 'npm',
    },
  };
}
