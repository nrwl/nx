import * as fg from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs';
import * as octokit from 'octokit';
import { output } from '@nx/devkit';
import { Octokit } from 'octokit';

async function main() {
  const codeowners = fs.readFileSync(
    path.join(__dirname, '../CODEOWNERS'),
    'utf-8'
  );
  const codeownersLines = codeowners
    .split('\n')
    .filter((line) => line.trim().length > 0 && !line.startsWith('#'));

  const mismatchedPatterns: string[] = [];
  const mismatchedOwners: string[] = [];

  const gh = new octokit.Octokit({
    auth: process.env.GITHUB_TOKEN,
  }).rest;
  const cache: Map<string, boolean> = new Map();

  for (const line of codeownersLines) {
    // This is perhaps a bit naive, but it should
    // work for all paths and patterns that do not
    // contain spaces.
    const [specifiedPattern, ...owners] = line.split(' ');
    let foundMatchingFiles = false;

    const patternsToCheck = specifiedPattern.startsWith('/')
      ? [`.${specifiedPattern}`]
      : [`./${specifiedPattern}`, `**/${specifiedPattern}`];

    for (const pattern of patternsToCheck) {
      foundMatchingFiles ||=
        fg.sync(pattern, {
          ignore: ['node_modules', 'dist', 'build', '.git'],
          cwd: path.join(__dirname, '..'),
          onlyFiles: false,
        }).length > 0;
    }
    if (!foundMatchingFiles) {
      mismatchedPatterns.push(specifiedPattern);
    }

    if (process.env.GITHUB_TOKEN) {
      for (let owner of owners) {
        owner = owner.substring(1); // Remove the @
        if (owner.includes('/')) {
          // Its a team.
          const [org, team] = owner.split('/');
          let res = cache.get(owner);
          if (res === undefined) {
            res = await validateTeam(gh, org, team);
            cache.set(owner, res);
          }
          if (res === false) {
            mismatchedOwners.push(`${specifiedPattern}: ${owner}`);
          }
        } else {
          let res = cache.get(owner);
          if (res === undefined) {
            res = await validateUser(gh, owner);
            cache.set(owner, res);
          }
          if (res === false) {
            mismatchedOwners.push(`${specifiedPattern}: ${owner}`);
          }
        }
      }
    } else {
      output.warn({
        title: `Skipping owner validation because GITHUB_TOKEN is not set.`,
      });
    }
  }
  if (mismatchedPatterns.length > 0) {
    output.error({
      title: `The following patterns in CODEOWNERS do not match any files:`,
      bodyLines: mismatchedPatterns.map((e) => `- ${e}`),
    });
  }

  if (mismatchedOwners.length > 0) {
    output.error({
      title: `The following owners in CODEOWNERS do not exist:`,
      bodyLines: mismatchedOwners.map((e) => `- ${e}`),
    });
  }

  process.exit(mismatchedPatterns.length + mismatchedOwners.length > 0 ? 1 : 0);
}

main();

async function validateTeam(
  gh: Octokit['rest'],
  org: string,
  team: string
): Promise<boolean> {
  try {
    await gh.teams.getByName({
      org,
      team_slug: team,
    });
    return true;
  } catch {
    return false;
  }
}

async function validateUser(
  gh: Octokit['rest'],
  username: string
): Promise<boolean> {
  try {
    await gh.users.getByUsername({
      username,
    });
    return true;
  } catch {
    return false;
  }
}
