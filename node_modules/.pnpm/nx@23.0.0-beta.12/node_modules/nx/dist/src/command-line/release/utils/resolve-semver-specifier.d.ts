import { ProjectGraph } from '../../../config/project-graph';
import { NxReleaseConfig } from '../config/config';
import { SemverBumpType } from '../version/version-actions';
import { ReleaseGraph } from './release-graph';
import { SemverSpecifier } from './semver';
export declare function resolveSemverSpecifierFromConventionalCommits(from: string, projectGraph: ProjectGraph, projectNames: string[], releaseConfig: NxReleaseConfig, releaseGraph: ReleaseGraph): Promise<Map<string, SemverSpecifier | null>>;
export declare function resolveSemverSpecifierFromPrompt(selectionMessage: string, customVersionMessage: string): Promise<SemverBumpType | string>;
