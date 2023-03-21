import { Workspaces } from '../config/workspaces';
import { flushChanges, FsTree } from '../generators/tree';
import { combineOptionsForGenerator, handleErrors } from '../utils/params';

function removeSpecialFlags(generatorOptions: { [p: string]: any }): void {
  delete generatorOptions.interactive;
  delete generatorOptions.help;
  delete generatorOptions.verbose;
  delete generatorOptions['--'];
  delete generatorOptions['$0'];
}

export async function newWorkspace(cwd: string, args: { [k: string]: any }) {
  const ws = new Workspaces(null);

  return handleErrors(false, async () => {
    const isInteractive = args.interactive;
    const { normalizedGeneratorName, schema, implementationFactory } =
      ws.readGenerator('@nrwl/workspace/generators.json', 'new');
    removeSpecialFlags(args);
    const combinedOpts = await combineOptionsForGenerator(
      args,
      '@nrwl/workspace/generators.json',
      normalizedGeneratorName,
      null,
      null,
      schema,
      isInteractive,
      null,
      null,
      false
    );

    const host = new FsTree(cwd, false);
    const implementation = implementationFactory();
    const task = await implementation(host, combinedOpts);
    flushChanges(cwd, host.listChanges());
    host.lock();
    if (task) {
      await task();
    }
  });
}
