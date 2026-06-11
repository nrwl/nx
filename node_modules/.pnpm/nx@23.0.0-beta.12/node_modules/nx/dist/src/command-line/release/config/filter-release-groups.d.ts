import { ProjectGraph } from '../../../config/project-graph';
import { NxReleaseConfig } from './config';
import { GroupVersionPlan, ProjectsVersionPlan } from './version-plans';
import { NxReleaseDockerConfiguration } from '../../../config/nx-json';
export type ReleaseGroupWithName = Omit<NxReleaseConfig['groups'][string], 'docker'> & {
    name: string;
    resolvedVersionPlans: (ProjectsVersionPlan | GroupVersionPlan)[] | false;
    docker?: NxReleaseDockerConfiguration & {
        groupPreVersionCommand?: string;
    };
};
export declare function filterReleaseGroups(projectGraph: ProjectGraph, nxReleaseConfig: NxReleaseConfig, projectsFilter?: string[], groupsFilter?: string[]): {
    error: null | {
        title: string;
        bodyLines?: string[];
    };
    filterLog: {
        title: string;
        bodyLines: string[];
    } | null;
    releaseGroups: ReleaseGroupWithName[];
    releaseGroupToFilteredProjects: Map<ReleaseGroupWithName, Set<string>>;
};
