import { ProjectGraphCache } from '@nrwl/workspace';
import { mediumGraph } from './medium';
import { smallGraph } from './small';
import { subAppsGraph } from './sub-apps';

export interface ProjectGraphList {
  id: string;
  label: string;
  graph: ProjectGraphCache;
}

export const projectGraphs: ProjectGraphList[] = [
  {
    id: 'small',
    label: 'Small',
    graph: smallGraph,
  },
  {
    id: 'medium',
    label: 'Medium',
    graph: mediumGraph,
  },
  {
    id: 'sub-apps',
    label: 'Sub Apps',
    graph: subAppsGraph,
  },
];
