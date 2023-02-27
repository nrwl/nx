import yargs = require('yargs');
import { readNxJson } from '../config/configuration';
import { NxJsonConfiguration } from '../devkit-exports';
import { NX_PREFIX } from '../utils/logger';
import { output } from '../utils/output';

/**
 * Wraps `workspace-generator` to invoke `generate`.
 *
 * @deprecated(v17): Remove `workspace-generator in v17. Use local plugins.
 */
export async function workspaceGenerators(args: yargs.Arguments) {
  const generator = process.argv.slice(3);

  output.warn({
    title: `${NX_PREFIX} Workspace Generators are no longer supported`,
    bodyLines: [
      'Instead, Nx now supports executing generators or executors from ',
      'local plugins. To run a generator from a local plugin, ',
      'use `nx generate` like you would with any other generator.',
      '',
      'For more information, see: https://nx.dev/deprecated/workspace-generators',
    ],
  });

  const nxJson: NxJsonConfiguration = readNxJson();
  const collection = nxJson.npmScope
    ? `@${nxJson.npmScope}/workspace-plugin`
    : 'workspace-plugin';

  args._ = args._.slice(1);
  args.generator = `${collection}:${generator}`;

  return (await import('./generate')).generate(process.cwd(), args);
}
