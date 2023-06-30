import { CommandModule } from 'yargs';

/**
 * @deprecated workspace-lint is deprecated, and will be removed in v17. The checks it used to perform are no longer relevant.
 */
export const yargsWorkspaceLintCommand: CommandModule = {
  command: 'workspace-lint [files..]',
  describe: 'Lint nx specific workspace files (nx.json, workspace.json)',
  deprecated:
    'workspace-lint is deprecated, and will be removed in v17. The checks it used to perform are no longer relevant.  See: https://nx.dev/deprecated/workspace-lint',
  handler: async () => {
    await (await import('./workspace-lint')).workspaceLint();
    process.exit(0);
  },
};
