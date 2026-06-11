import { FileChange } from '../file-utils';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
export declare function filterAffected(graph: ProjectGraph, touchedFiles: FileChange[], nxJson?: NxJsonConfiguration, packageJson?: any): Promise<ProjectGraph>;
