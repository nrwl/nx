/**
 * App-level dependency sections that can declare a workspace module the pruned
 * standalone output must install. copy-workspace-modules copies the module from
 * every one of these sections. prune-lockfile points the module at its copied
 * `file:` directory: in place for dependencies/optionalDependencies/
 * devDependencies, and by moving it into `dependencies` for `peerDependencies`,
 * because pnpm rejects a `file:` spec under peerDependencies (a peer-declared
 * workspace module is installed as a regular dependency instead). A
 * `workspace:*` spec left in any of them fails `pnpm install --frozen-lockfile`
 * (#35425). Transitive copies recurse over dependencies, optionalDependencies,
 * and peerDependencies (TRANSITIVE_INSTALL_SECTIONS in copy-workspace-modules),
 * since pnpm installs a transitive dependency's optional and auto-installed peer
 * deps but never its devDependencies; a transitive workspace-module peer is
 * moved into dependencies the same way.
 */
export const WORKSPACE_MODULE_INSTALL_SECTIONS = [
  'dependencies',
  'optionalDependencies',
  'devDependencies',
  'peerDependencies',
] as const;
