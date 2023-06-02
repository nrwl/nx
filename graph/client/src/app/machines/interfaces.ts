/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectFileMap,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from '@nx/devkit';
/* eslint-enable @nx/enforce-module-boundaries */
import { TracingAlgorithmType } from '../feature-projects/machines/interfaces';

// The events that the graph actor handles
export type GraphRenderEvents =
  | {
      type: 'notifyGraphInitGraph';
      projects: ProjectGraphProjectNode[];
      fileMap: ProjectFileMap;
      dependencies: Record<string, ProjectGraphDependency[]>;
      affectedProjects: string[];
      workspaceLayout: {
        libsDir: string;
        appsDir: string;
      };
      groupByFolder: boolean;
      collapseEdges: boolean;
    }
  | {
      type: 'notifyGraphUpdateGraph';
      projects: ProjectGraphProjectNode[];
      fileMap: ProjectFileMap;
      dependencies: Record<string, ProjectGraphDependency[]>;
      affectedProjects: string[];
      workspaceLayout: {
        libsDir: string;
        appsDir: string;
      };
      groupByFolder: boolean;
      collapseEdges: boolean;
      selectedProjects: string[];
    }
  | {
      type: 'notifyGraphFocusProject';
      projectName: string;
      searchDepth: number;
    }
  | {
      type: 'notifyGraphShowProject';
      projectName: string;
    }
  | {
      type: 'notifyGraphHideProject';
      projectName: string;
    }
  | {
      type: 'notifyGraphShowAllProjects';
    }
  | {
      type: 'notifyGraphHideAllProjects';
    }
  | {
      type: 'notifyGraphShowAffectedProjects';
    }
  | {
      type: 'notifyGraphFilterProjectsByText';
      search: string;
      includeProjectsByPath: boolean;
      searchDepth: number;
    }
  | {
      type: 'notifyGraphTracing';
      start: string;
      end: string;
      algorithm: TracingAlgorithmType;
    };
