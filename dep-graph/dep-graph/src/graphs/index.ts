import { ProjectGraphList } from '../app/models';
import { oceanGraph, oceanWorkspaceLayout } from './ocean';
import { nxGraph, nxWorkspaceLayout } from './nx';
import { storybookGraph, storybookWorkspaceLayout } from './storybook';
import { subAppsGraph, subAppsWorkspaceLayout } from './sub-apps';
import { nxExamplesGraph, nxExamplesWorkspaceLayout } from './nx-examples';

export const projectGraphs: ProjectGraphList[] = [
  {
    id: 'nx',
    label: 'Nx',
    graph: nxGraph,
    workspaceLayout: nxWorkspaceLayout,
  },
  {
    id: 'ocean',
    label: 'Ocean',
    graph: oceanGraph,
    workspaceLayout: oceanWorkspaceLayout,
  },
  {
    id: 'nx-examples',
    label: 'Nx Examples',
    graph: nxExamplesGraph,
    workspaceLayout: nxExamplesWorkspaceLayout,
  },
  {
    id: 'sub-apps',
    label: 'Sub Apps',
    graph: subAppsGraph,
    workspaceLayout: subAppsWorkspaceLayout,
  },
  {
    id: 'storybook',
    label: 'Storybook',
    graph: storybookGraph,
    workspaceLayout: storybookWorkspaceLayout,
  },
];
