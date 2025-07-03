import { getLatestCommitSha } from 'nx/src/utils/git-utils';

/**
 * Support Tokens in Version Patterns
 * {projectName} - the name of the project
 * {currentDate} - the current date in YY.MM.DD format
 * {currentDate|DATE FORMAT} - the current date with custom format such as YYMM.DD
 * {commitSha} - The full commit sha for the current commit
 * {shortCommitSha} - The seven character commit sha for the current commit
 */
export interface PatternTokens {
  projectName: string;
  currentDate: Date;
  commitSha: string;
  shortCommitSha: string;
}

const tokenRegex = /\{([^|{}]+)(?:\|([^{}]+))?\}/g;

function formatDate(date: Date, format: string) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace(/YYYY/g, year)
    .replace(/YY/g, year.slice(-2))
    .replace(/MM/g, month)
    .replace(/DD/g, day)
    .replace(/HH/g, hours)
    .replace(/mm/g, minutes)
    .replace(/ss/g, seconds);
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

  return versionPattern.replace(tokenRegex, (match, identifier, format) => {
    const value = substitutions[identifier];

    if (value === undefined) {
      return match; // Keep original token if no data
    }

    // Handle date formatting
    if (identifier === 'currentDate') {
      if (format) {
        return formatDate(value, format);
      } else {
        return (value as Date).toISOString();
      }
    }

    return value;
  });
}
