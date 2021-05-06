import { Rule, Tree } from '@angular-devkit/schematics';

export function initRootBabelConfig(): Rule {
  return (host: Tree) => {
    if (host.exists('/babel.config.json') || host.exists('/babel.config.js'))
      return;
    host.create(
      '/babel.config.json',
      JSON.stringify(
        {
          presets: ['@nrwl/web/babel'],
          babelrcRoots: ['*'], // Make sure .babelrc files other than root can be loaded in a monorepo
        },
        null,
        2
      )
    );
  };
}
