import { Rule, chain } from '@angular-devkit/schematics';
import {
  updateWorkspaceInTree,
  readWorkspaceJson,
  readWorkspace,
  updateJsonInTree,
  formatFiles,
} from '@nrwl/workspace';

export default function update(): Rule {
  return chain([
    updateWorkspaceInTree((config) => {
      const filteredProjects: Array<Record<string, any>> = [];
      Object.keys(config.projects).forEach((name) => {
        if (
          config.projects[name].architect &&
          config.projects[name].architect.e2e &&
          config.projects[name].architect.e2e.builder ===
            '@nrwl/cypress:cypress' &&
          config.projects[name].architect.e2e.options.devServerTarget.endsWith(
            ':storybook'
          )
        ) {
          filteredProjects.push(config.projects[name]);
        }
      });
      filteredProjects.forEach((p) => {
        delete p.architect.e2e.options.headless;
        delete p.architect.e2e.options.watch;
        delete p.architect.e2e.configurations;
      });
      return config;
    }),
    (tree, context) => {
      const workspace = readWorkspace(tree);
      const tsconfigUpdateRules: Rule[] = [];
      Object.keys(workspace.projects).forEach((name) => {
        if (
          workspace.projects[name].architect &&
          workspace.projects[name].architect.storybook &&
          workspace.projects[name].architect.storybook.builder ===
            '@nrwl/storybook:storybook' &&
          workspace.projects[name].architect.storybook.options.config
            .configFolder
        ) {
          const storybookFolderPath =
            workspace.projects[name].architect.storybook.options.config
              .configFolder;
          tsconfigUpdateRules.push(
            updateJsonInTree(
              `${storybookFolderPath}/tsconfig.json`,
              (json) => ({
                ...json,
                compilerOptions: {
                  emitDecoratorMetadata: true,
                },
              })
            )
          );
        }
      });
      return chain(tsconfigUpdateRules);
    },
    formatFiles(),
  ]);
}
