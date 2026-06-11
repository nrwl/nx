import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { NxPluginV2 } from '../../../project-graph/plugins';
export declare const ProjectJsonProjectsPlugin: NxPluginV2;
export default ProjectJsonProjectsPlugin;
export declare function buildProjectFromProjectJson(json: Partial<ProjectConfiguration>, path: string): ProjectConfiguration;
