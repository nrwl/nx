import { join, resolve } from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { Configuration, RuleSetRule } from 'webpack';
import { FileReplacement } from './types';
import { createCopyPlugin } from './create-copy-plugin';
import {
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/js/src/utils/buildable-libs-utils';

export function createWebpackConfig(
  workspaceRoot: string,
  projectRoot: string,
  fileReplacements: FileReplacement[] = [],
  assets: any = null,
  dependencies: DependentBuildableProjectNode[] = [],
  libsDir = ''
): (a, b) => Configuration {
  return function webpackConfig(
    config: Configuration,
    {
      isServer,
    }: {
      buildId: string;
      dev: boolean;
      isServer: boolean;
    }
  ): Configuration {
    const mainFields = ['es2015', 'module', 'main'];
    const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
    let tsConfigPath = join(projectRoot, 'tsconfig.json');
    if (dependencies.length > 0) {
      tsConfigPath = createTmpTsConfig(
        join(workspaceRoot, tsConfigPath),
        workspaceRoot,
        projectRoot,
        dependencies
      );
    }

    config.resolve.plugins = [
      new TsconfigPathsPlugin({
        configFile: tsConfigPath,
        extensions,
        mainFields,
      }) as never, // TODO: Remove never type when 'tsconfig-paths-webpack-plugin' types fixed
    ];

    fileReplacements
      .map((fileReplacement) => ({
        replace: resolve(workspaceRoot, fileReplacement.replace),
        with: resolve(workspaceRoot, fileReplacement.with),
      }))
      .reduce((alias, replacement) => {
        alias[replacement.replace] = replacement.with;
        return alias;
      }, config.resolve.alias);

    // Apply any rules that work on ts files to the libsDir as well
    const rulesToAdd = [];
    for (const r of config.module.rules) {
      if (typeof r === 'string') {
        continue;
      }
      if (isTsRule(r)) {
        rulesToAdd.push({ ...r, include: [libsDir] });
      } else if (r.oneOf && r.oneOf.find(isTsRule)) {
        rulesToAdd.push({
          ...r,
          oneOf: r.oneOf
            .filter(isTsRule)
            .map((subRule) => ({ ...subRule, include: [libsDir] })),
        });
      }
    }
    config.module.rules.push(...rulesToAdd);

    // Copy (shared) assets to `public` folder during client-side compilation
    if (!isServer && Array.isArray(assets) && assets.length > 0) {
      config.plugins.push(createCopyPlugin(assets, workspaceRoot, projectRoot));
    }

    return config;
  };
}

function isTsRule(r: RuleSetRule): boolean {
  if (typeof r === 'string') {
    return false;
  }
  if (!(r.test instanceof RegExp)) {
    return false;
  }

  return r.test.test('a.ts');
}
