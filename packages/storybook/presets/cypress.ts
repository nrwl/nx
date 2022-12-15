import {
  nxE2EPreset,
  getProjectConfigByPath,
} from '@nrwl/cypress/plugins/cypress-preset';
import { ProjectGraph, readCachedProjectGraph } from '@nrwl/devkit';

export function nxE2EStorybookPreset(filePath: string) {
  let graph = readCachedProjectGraph();

  const projectConfig = getProjectConfigByPath(graph, filePath);

  const projectName = projectConfig.name;

  return {
    ...nxE2EPreset(filePath),
    baseUrl: 'http://localhost:4400',
  };
}
