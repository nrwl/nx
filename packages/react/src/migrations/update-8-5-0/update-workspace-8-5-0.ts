import { chain, Rule } from '@angular-devkit/schematics';
import { formatFiles, updateWorkspaceInTree } from '@nrwl/workspace';

export default function update(): Rule {
  return chain([
    updateWorkspaceInTree((config) => {
      const a = [];
      const b = [];
      Object.keys(config.schematics).forEach((name) => {
        if (name === '@nrwl/react' && config.schematics[name].application) {
          a.push(config.schematics[name]);
        }
        if (name === '@nrwl/react:application') {
          b.push(config.schematics[name]);
        }
      });
      a.forEach((x) => {
        delete x.application.babel;
      });
      b.forEach((x) => {
        delete x.babel;
      });
      return config;
    }),
    formatFiles(),
  ]);
}
