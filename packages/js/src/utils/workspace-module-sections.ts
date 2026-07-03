/**
 * App-level dependency sections a full `pnpm install` resolves workspace modules
 * from. The pruned manifest rewrite (prune-lockfile) and the module copy
 * (copy-workspace-modules) must both cover all three: a `workspace:*` spec left
 * in any of them fails `pnpm install --frozen-lockfile` (#35425). Transitive
 * copies recurse over production sections only, since pnpm never installs a
 * dependency's devDependencies.
 */
export const WORKSPACE_MODULE_INSTALL_SECTIONS = [
  'dependencies',
  'optionalDependencies',
  'devDependencies',
] as const;
