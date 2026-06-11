import { NxJsonConfiguration, NxReleaseConfiguration, NxReleaseDockerConfiguration } from '../../../config/nx-json';
import { ProjectFileMap, ProjectGraph } from '../../../config/project-graph';
type DeepRequired<T> = Required<{
    [K in keyof T]: T[K] extends Required<T[K]> ? T[K] : DeepRequired<T[K]>;
}>;
type EnsureDockerOptional<T> = {
    [K in keyof T]: Omit<T[K], 'docker'> & {
        docker: DeepRequired<NxReleaseDockerConfiguration> | undefined;
    };
};
type EnsureProjectsArray<T> = {
    [K in keyof T]: T[K] extends {
        projects: any;
    } ? Omit<T[K], 'projects'> & {
        projects: string[];
    } : T[K];
};
type RemoveTrueFromType<T> = T extends true ? never : T;
type RemoveTrueFromProperties<T, K extends keyof T> = {
    [P in keyof T]: P extends K ? RemoveTrueFromType<T[P]> : T[P];
};
type RemoveTrueFromPropertiesOnEach<T, K extends keyof T[keyof T]> = {
    [U in keyof T]: RemoveTrueFromProperties<T[U], K>;
};
type RemoveBooleanFromType<T> = T extends boolean ? never : T;
type RemoveBooleanFromProperties<T, K extends keyof T> = {
    [P in keyof T]: P extends K ? RemoveBooleanFromType<T[P]> : T[P];
};
type RemoveBooleanFromPropertiesOnEach<T, K extends keyof T[keyof T]> = {
    [U in keyof T]: RemoveBooleanFromProperties<T[U], K>;
};
type RemoveDeprecatedPropertiesFromEach<T> = {
    [K in keyof T]: Omit<T[K], 'releaseTagPattern' | 'releaseTagPatternCheckAllBranchesWhen' | 'releaseTagPatternRequireSemver' | 'releaseTagPatternPreferDockerVersion' | 'releaseTagPatternStrictPreid'>;
};
export declare const IMPLICIT_DEFAULT_RELEASE_GROUP = "__default__";
export declare const DEFAULT_VERSION_ACTIONS_PATH = "@nx/js/src/release/version-actions";
/**
 * Our source of truth is a deeply required variant of the user-facing config interface, so that command
 * implementations can be sure that properties will exist and do not need to repeat the same checks over
 * and over again.
 *
 * We also normalize the projects property on release groups to always be an array of project names to make
 * it easier to work with (the user could be specifying a single string, and they can also use any valid matcher
 * pattern such as directories and globs).
 */
export type NxReleaseConfig = Omit<DeepRequired<NxReleaseConfiguration & {
    groups: RemoveDeprecatedPropertiesFromEach<EnsureDockerOptional<DeepRequired<RemoveTrueFromPropertiesOnEach<EnsureProjectsArray<NxReleaseConfiguration['groups']>, 'changelog' | 'docker'>>>>;
    changelog: RemoveTrueFromProperties<DeepRequired<NxReleaseConfiguration['changelog']>, 'workspaceChangelog' | 'projectChangelogs'>;
    conventionalCommits: {
        types: RemoveBooleanFromPropertiesOnEach<DeepRequired<RemoveBooleanFromProperties<DeepRequired<NxReleaseConfiguration['conventionalCommits']['types']>, string>>, 'changelog'>;
    };
}>, 'projects' | 'docker' | 'releaseTagPattern' | 'releaseTagPatternCheckAllBranchesWhen' | 'releaseTagPatternRequireSemver' | 'releaseTagPatternPreferDockerVersion' | 'releaseTagPatternStrictPreid'> & {
    docker: DeepRequired<NxReleaseDockerConfiguration> | undefined;
    releaseTag: DeepRequired<NonNullable<NxReleaseConfiguration['releaseTag']>>;
};
export interface CreateNxReleaseConfigError {
    code: 'PROJECTS_AND_GROUPS_DEFINED' | 'RELEASE_GROUP_MATCHES_NO_PROJECTS' | 'RELEASE_GROUP_RELEASE_TAG_PATTERN_VERSION_PLACEHOLDER_MISSING_OR_EXCESSIVE' | 'PROJECT_MATCHES_MULTIPLE_GROUPS' | 'CONVENTIONAL_COMMITS_SHORTHAND_MIXED_WITH_OVERLAPPING_OPTIONS' | 'GLOBAL_GIT_CONFIG_MIXED_WITH_GRANULAR_GIT_CONFIG' | 'CANNOT_RESOLVE_CHANGELOG_RENDERER' | 'INVALID_CHANGELOG_CREATE_RELEASE_PROVIDER' | 'INVALID_CHANGELOG_CREATE_RELEASE_HOSTNAME' | 'INVALID_CHANGELOG_CREATE_RELEASE_API_BASE_URL' | 'DOCKER_VERSION_SCHEME_USES_VERSION_ACTIONS_VERSION_WHEN_SKIP_VERSION_ACTIONS' | 'GIT_PUSH_FALSE_WITH_CREATE_RELEASE';
    data: Record<string, string | string[]>;
}
export declare function createNxReleaseConfig(projectGraph: ProjectGraph, projectFileMap: ProjectFileMap, userConfig?: NxJsonConfiguration['release']): Promise<{
    error: null | CreateNxReleaseConfigError;
    nxReleaseConfig: NxReleaseConfig | null;
}>;
export declare function handleNxReleaseConfigError(error: CreateNxReleaseConfigError): Promise<never>;
/**
 * Full form of the createRelease config, with the provider, hostname, and apiBaseUrl resolved.
 */
export interface ResolvedCreateRemoteReleaseProvider {
    provider: string;
    hostname: string;
    apiBaseUrl: string;
}
export {};
