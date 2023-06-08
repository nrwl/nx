/* eslint-disable @typescript-eslint/no-unused-vars */
import { Tree, getProjects, updateProjectConfiguration } from '@nx/devkit';

export default function update(host: Tree) {
  const projects = getProjects(host);

  for (const [name, project] of projects) {
    if (project.targets) {
      for (const target of Object.values(project.targets)) {
        if (target.executor === '@nx/vite:test') {
          if (target.options?.testFile) {
            target.options.testFile = [target.options.testFile];
          }

          if (target.configurations) {
            for (const configuration of Object.values(target.configurations)) {
              if (configuration.testFile) {
                configuration.testFile = [configuration.testFile];
              }
            }
          }
        }
      }

      updateProjectConfiguration(host, name, project);
    }
  }
}
