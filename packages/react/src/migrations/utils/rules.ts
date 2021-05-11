import { Rule, Tree } from '@angular-devkit/schematics';
import { writeJsonInTree } from '@nrwl/workspace';

export function initRootBabelConfig(): Rule {
  return (host: Tree) => {
    if (host.exists('/babel.config.json') || host.exists('/babel.config.js'))
      return;
    writeJsonInTree(host, '/babel.config.json', {
      presets: ['@nrwl/web/babel'],
      babelrcRoots: ['*'], // Make sure .babelrc files other than root can be loaded in a monorepo
    });
  };
}
