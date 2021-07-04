import { formatFiles, getProjects, updateJson } from '@nrwl/devkit';
import type { Tree } from '@nrwl/devkit';
import type { Linter } from 'eslint';
import { join } from 'path';

function updateRootESLintConfig(host: Tree) {
  if (!host.exists('.eslintrc.json')) {
    return;
  }
  updateJson(host, '.eslintrc.json', (json: Linter.Config) => {
    /**
     * If the user is still using OOTB Nx config, then they will have a "project"
     * parserOption set for TS files in their root config.
     *
     * We remove this to both be consistent with new workspace generation, and
     * to ensure they receive an explicit error if they miss off project level
     * configuration (instead of there being a silent, much slower fallback).
     */
    if (json.overrides) {
      json.overrides = json.overrides.map((o) => {
        if (o.parserOptions && o.parserOptions.project) {
          delete o.parserOptions.project;
          // If the parserOptions object is now empty as a result, delete it too
          if (Object.keys(o.parserOptions).length === 0) {
            delete o.parserOptions;
          }
        }
        return o;
      });
    }
    return json;
  });
}

function updateProjectESLintConfigs(host: Tree) {
  const projects = getProjects(host);
  projects.forEach((p) => {
    const eslintConfigPath = join(p.root, '.eslintrc.json');

    if (!host.exists(eslintConfigPath)) {
      return;
    }

    const isNextJs = p.targets?.build?.executor === '@nrwl/next:build';

    const parserOptionsProjectVal = isNextJs
      ? [`${p.root}/tsconfig(.*)?.json`]
      : [`${p.root}/tsconfig.*?.json`];

    return updateJson(host, eslintConfigPath, (json) => {
      if (!json.overrides) {
        json.overrides = [
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            parserOptions: {
              project: parserOptionsProjectVal,
            },
            /**
             * Having an empty rules object present makes it more obvious to the user where they would
             * extend things from if they needed to
             */
            rules: {},
          },
          {
            files: ['*.ts', '*.tsx'],
            rules: {},
          },
          {
            files: ['*.js', '*.jsx'],
            rules: {},
          },
        ];
      } else {
        if (
          !json.overrides.some(
            (o) => o.parserOptions && o.parserOptions.project
          )
        ) {
          json.overrides.unshift({
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            parserOptions: {
              project: parserOptionsProjectVal,
            },
            rules: {},
          });
        }
      }
      return json;
    });
  });
}

export async function updateTsConfigsWithEslint(host: Tree) {
  updateRootESLintConfig(host);
  updateProjectESLintConfigs(host);
  await formatFiles(host);
}

export default updateTsConfigsWithEslint;
