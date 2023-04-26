import { workspaceRoot } from './workspace-root';
import { existsSync } from 'fs';
import { join } from 'path';
import { output } from './output';
import { readJsonFile } from '../utils/fileutils';

//TODO: vsavkin remove after Nx 18
export function workspaceConfigurationCheck() {
  if (existsSync(join(workspaceRoot, 'workspace.json'))) {
    output.warn({
      title: 'workspace.json is ignored',
      bodyLines: [
        'Nx no longer reads configuration from workspace.json.',
        'Run "nx g @nx/workspace:fix-configuration" to split workspace.json into individual project.json files.',
      ],
    });
    return;
  }

  if (existsSync(join(workspaceRoot, 'angular.json'))) {
    const angularJson = readJsonFile(join(workspaceRoot, 'angular.json'));
    const v2Props = Object.values(angularJson.projects).find(
      (p: any) => !!p.targets
    );
    if (angularJson.version === 2 || v2Props) {
      output.error({
        title: 'angular.json format is incorrect',
        bodyLines: [
          'Nx no longer supports the v2 format of angular.json.',
          'Run "nx g @nx/workspace:fix-configuration" to split angular.json into individual project.json files. (Recommended)',
          'If you want to preserve angular.json, run "nx g @nx/workspace:fix-configuration --reformat"',
        ],
      });
      process.exit(1);
    }
  }
}
