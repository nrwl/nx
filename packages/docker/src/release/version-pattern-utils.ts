import { getLatestCommitSha } from 'nx/src/utils/git-utils';
import { interpolatePattern } from '../utils/interpolate-pattern';

/**
 * Support Tokens in Version Patterns
 * {projectName} - the name of the project
 * {currentDate} - the current date in YY.MM.DD format
 * {currentDate|DATE FORMAT} - the current date with custom format such as YYMM.DD
 * {commitSha} - The full commit sha for the current commit
 * {shortCommitSha} - The seven character commit sha for the current commit
 * {env.VAR_NAME} - The value of the environment variable VAR_NAME
 */
export interface PatternTokens {
  projectName: string;
  currentDate: Date;
  commitSha: string;
  shortCommitSha: string;
}

export function interpolateVersionPattern(
  versionPattern: string,
  data: Partial<PatternTokens>
) {
  const commitSha = getLatestCommitSha();
  const substitutions: PatternTokens = {
    projectName: data.projectName ?? '',
    currentDate: data.currentDate ?? new Date(),
    commitSha: data.commitSha ?? commitSha,
    shortCommitSha: data.shortCommitSha ?? commitSha.slice(0, 7),
  };

  return interpolatePattern(versionPattern, substitutions);
}
