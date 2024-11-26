import { flushChanges, FsTree } from '../../generators/tree';
import { combineOptionsForGenerator } from '../../utils/params';
import { handleErrors } from '../../utils/handle-errors';
import { getGeneratorInformation } from '../generate/generator-utils';

function removeSpecialFlags(generatorOptions: { [p: string]: any }): void {
  delete generatorOptions.interactive;
  delete generatorOptions.help;
  delete generatorOptions.verbose;
  delete generatorOptions['--'];
  delete generatorOptions['$0'];
}

export async function newWorkspace(cwd: string, args: { [k: string]: any }) {
  return handleErrors(
    process.env.NX_VERBOSE_LOGGING === 'true' || args.verbose,
    async () => {
      const isInteractive = args.interactive;
      const { normalizedGeneratorName, schema, implementationFactory } =
        getGeneratorInformation(
          '@nx/workspace/generators.json',
          'new',
          null,
          {}
        );
      removeSpecialFlags(args);
      const combinedOpts = await combineOptionsForGenerator(
        args,
        '@nx/workspace/generators.json',
        normalizedGeneratorName,
        null,
        null,
        schema,
        isInteractive,
        null,
        null,
        false
      );

      const host = new FsTree(cwd, false, 'nx new');
      const implementation = implementationFactory();
      const task = await implementation(host, combinedOpts);
      flushChanges(cwd, host.listChanges());
      host.lock();
      if (task) {
        await task();
      }
    }
  );
}
