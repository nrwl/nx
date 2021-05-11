import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import {
  addLintFiles,
  getWorkspacePath,
  Linter,
  updateJsonInTree,
} from '@nrwl/workspace';
import {
  createAngularEslintJson,
  createAngularProjectESLintLintTarget,
  extraEslintDependencies,
} from '../../utils/lint';
import { Schema } from './schema';

export default function addLinting(options: Schema): Rule {
  return chain([
    addLintFiles(options.projectRoot, Linter.EsLint, {
      onlyGlobal: false,
      localConfig: createAngularEslintJson(options.projectRoot, options.prefix),
      extraPackageDeps: extraEslintDependencies,
    }),
    updateProject(options),
  ]);
}

function updateProject(options: Schema): Rule {
  return (host: Tree) => {
    return chain([
      updateJsonInTree(getWorkspacePath(host), (json) => {
        const project = json.projects[options.projectName];

        project.architect.lint = createAngularProjectESLintLintTarget(
          options.projectRoot
        );

        json.projects[options.projectName] = project;
        return json;
      }),
    ]);
  };
}

export const addLintingGenerator = wrapAngularDevkitSchematic(
  '@nrwl/angular',
  'add-linting'
);
