import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { ProjectRootMappings } from '../../../project-graph/utils/find-project-for-path';
export declare function hashTsConfig(p: ProjectGraphProjectNode, projectRootMappings: ProjectRootMappings, { selectivelyHashTsConfig }: {
    selectivelyHashTsConfig: boolean;
}): string;
