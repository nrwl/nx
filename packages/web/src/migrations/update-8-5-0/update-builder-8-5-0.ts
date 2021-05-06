import { chain, Rule } from '@angular-devkit/schematics';
import { formatFiles, updateWorkspaceInTree } from '@nrwl/workspace';

export default function update(): Rule {
  return chain([
    updateWorkspaceInTree((config) => {
      const filteredProjects = [];
      Object.keys(config.projects).forEach((name) => {
        if (
          config.projects[name].architect &&
          config.projects[name].architect.build &&
          config.projects[name].architect.build.builder === '@nrwl/web:build'
        ) {
          filteredProjects.push(config.projects[name]);
        }
      });
      filteredProjects.forEach((p) => {
        delete p.architect.build.options.differentialLoading;
      });
      return config;
    }),
    formatFiles(),
  ]);
}
