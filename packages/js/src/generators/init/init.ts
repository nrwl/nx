import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  stripIndents,
  Tree,
  updateJson,
  writeJson,
} from '@nrwl/devkit';
import { getRootTsConfigFileName } from '../../utils/typescript/ts-config';
import {
  nxVersion,
  prettierVersion,
  typescriptVersion,
} from '../../utils/versions';
import { InitSchema } from './schema';

let formatTaskAdded = false;

export async function initGenerator(
  tree: Tree,
  schema: InitSchema
): Promise<GeneratorCallback> {
  // add tsconfig.base.json
  if (!getRootTsConfigFileName(tree)) {
    generateFiles(tree, joinPathFragments(__dirname, './files'), '.', {
      fileName: schema.tsConfigName ?? 'tsconfig.base.json',
    });
  }
  const devDependencies = {
    '@nrwl/js': nxVersion,
    prettier: prettierVersion,
  };

  if (!schema.js) {
    devDependencies['typescript'] = typescriptVersion;
  }

  if (!tree.exists(`.prettierrc`)) {
    writeJson(tree, '.prettierrc', {
      singleQuote: true,
    });
  }

  if (!tree.exists(`.prettierignore`)) {
    tree.write(
      '.prettierignore',
      stripIndents`
        # Add files here to ignore them from prettier formatting
        /dist
        /coverage
      `
    );
  }
  if (tree.exists('.vscode/extensions.json')) {
    updateJson(tree, '.vscode/extensions.json', (json) => {
      json.recommendations ??= [];
      const extension = 'esbenp.prettier-vscode';
      if (!json.recommendations.includes(extension)) {
        json.recommendations.push(extension);
      }
      return json;
    });
  }

  const installTask = !schema.skipPackageJson
    ? addDependenciesToPackageJson(tree, {}, devDependencies)
    : () => {};

  return async () => {
    await installTask();

    // Run Prettier once on all non-ignored files because some files may not be changed in the tree. e.g. nx.json
    // TODO(jack): Once we create @nrwl/prettier:init we can move this logic there with --formatExistingFiles option.
    if (!formatTaskAdded) {
      formatTaskAdded = true;
      try {
        const prettierCli = await import('prettier/cli');
        await prettierCli.run(['.', '--write']);
      } catch {
        // If --skipPackageJson is passed then prettier is not installed.
      }
    }
  };
}

export default initGenerator;

export const initSchematic = convertNxGenerator(initGenerator);
