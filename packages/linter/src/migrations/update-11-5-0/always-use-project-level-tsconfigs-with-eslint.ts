import { join, normalize } from '@angular-devkit/core';
import { chain, noop, Tree } from '@angular-devkit/schematics';
import { formatFiles, readWorkspace, updateJsonInTree } from '@nrwl/workspace';
import type { Linter } from 'eslint';

function updateRootESLintConfig(host: Tree) {
  return host.exists('.eslintrc.json')
    ? updateJsonInTree('.eslintrc.json', (json: Linter.Config) => {
        /**
         * If the user is still using OOTB Nx config, then they will have a "project"
         * parserOption set for TS files in their root config.
         *
         * We remove this to both be consistent with new workspace generation, and
         * to ensure they receive an explicit error if they miss off project level
         * configuration (instead of there being a silent, much slower fallback).
         */
        if (json.overrides) {
          json.overrides = json.overrides.map((override) => {
            if (override.parserOptions && override.parserOptions.project) {
              delete override.parserOptions.project;
              // If the parserOptions object is now empty as a result, delete it too
              if (Object.keys(override.parserOptions).length === 0) {
                delete override.parserOptions;
              }
            }
            return override;
          });
        }
        return json;
      })
    : noop();
}

function updateProjectESLintConfigs(host: Tree) {
  const workspace = readWorkspace(host);
  return chain([
    ...Object.keys(workspace.projects).map((k) => {
      const p = workspace.projects[k];
      const eslintConfigPath = join(normalize(p.root), '.eslintrc.json');

      if (!host.exists(eslintConfigPath)) {
        return noop();
      }

      const parserOptionsProjectVal = [`${p.root}/tsconfig.*?.json`];

      return updateJsonInTree(eslintConfigPath, (json) => {
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
              (override) =>
                override.parserOptions && override.parserOptions.project
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
    }),
  ]);
}

export default function () {
  return chain([
    updateRootESLintConfig,
    updateProjectESLintConfigs,
    formatFiles(),
  ]);
}
