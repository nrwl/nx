import { writeFileSync } from 'fs';
import axios from 'axios';

interface Interval {
  start: Date;
  end: Date;
}

interface PluginRegistry {
  name: string;
  description: string;
  url: string;
}

const plugins =
  require('../../community/approved-plugins.json') as PluginRegistry[];

async function main() {
  const qualityIndicators: any = {};
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i];
    const npmData = await getNpmData(plugin);
    const npmDownloads = await getNpmDownloads(plugin);
    const githubStars = await getGithubStars(npmData.githubRepo);
    const nxVersion = await getNxVersion(
      npmData.githubRepo,
      npmData.githubDirectory
    );
    qualityIndicators[plugin.name] = {
      lastPublishedDate: npmData.lastPublishedDate,
      githubDirectory: npmData.githubDirectory,
      npmDownloads,
      githubStars,
      nxVersion,
    };
    console.log(qualityIndicators[plugin.name]);
  }

  writeFileSync(
    '../../nx-dev/nx-dev/pages/extending-nx/quality-indicators.json',
    JSON.stringify(qualityIndicators, null, 2)
  );
}
main();

// Publish date (and github directory, readme content)
// i.e. https://registry.npmjs.org/@nxkit/playwright
async function getNpmData(plugin: PluginRegistry) {
  const { data } = await axios.get(`https://registry.npmjs.org/${plugin.name}`);
  console.log(plugin.name);
  const lastPublishedDate = data.time[data['dist-tags'].latest];
  if (!data.repository) {
    console.log('!!! No repository!');
    return { lastPublishedDate, githubRepo: '' };
  }
  const url: String = data.repository.url;
  const githubRepo = url
    .slice(url.indexOf('github.com/') + 11)
    .replace('.git', '');
  return {
    lastPublishedDate,
    githubDirectory: data.repository.directory,
    githubRepo,
    // readmeContent: plugin.name
  };
}

// Download count
// i.e. https://api.npmjs.org/downloads/point/2023-06-01:2023-07-01/@nxkit/playwright
async function getNpmDownloads(plugin: PluginRegistry) {
  const lastMonth = getLastMonth();
  const { data } = await axios.get(
    `https://api.npmjs.org/downloads/point/${stringifyIntervalForUrl(
      lastMonth
    )}/${plugin.name}`
  );
  return data.downloads;
}

export function getLastMonth() {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  return {
    start: new Date(`${thisYear}-${thisMonth - 1}-01`),
    end: new Date(`${thisYear}-${thisMonth}-01`),
  };
}

export function stringifyIntervalForUrl(interval: Interval): string {
  return `${stringifyDate(interval.start)}:${stringifyDate(interval.end)}`;
}

export function stringifyDate(date: Date) {
  // yyyy-MM-dd
  return date.toISOString().slice(0, 10);
}

// Stars
// i.e. https://api.github.com/repos/nxkit/nxkit
async function getGithubStars(repo: String) {
  try {
    const { data } = await axios.get(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_PAT}`,
      },
    });
    return data.stargazers_count;
  } catch (ex) {
    return -1;
  }
}

// Nx Version
// i.e. https://raw.githubusercontent.com/nxkit/nxkit/HEAD/packages/playwright/package.json
// i.e. https://raw.githubusercontent.com/nxkit/nxkit/HEAD/package.json
async function getNxVersion(githubRepo: String, githubDirectory?: String) {
  if (!githubRepo) {
    return '';
  }
  if (githubDirectory) {
    try {
      const { data } = await axios.get(
        `https://raw.githubusercontent.com/${githubRepo}/HEAD/${githubDirectory}/package.json`
      );
      const nxVersion = findNxVersion(data);
      if (nxVersion) {
        return nxVersion;
      }
    } catch (ex) {}
  }
  try {
    const { data } = await axios.get(
      `https://raw.githubusercontent.com/${githubRepo}/HEAD/package.json`
    );
    return findNxVersion(data);
  } catch (ex) {
    return '';
  }
}

function findNxVersion(packageJsonContent: any): string {
  let nxVersion = '';
  const nxPackages = ['@nrwl/devkit', 'nx', '@nx/devkit'];
  nxPackages.forEach((packageName) => {
    if (
      packageJsonContent.dependencies &&
      packageJsonContent.dependencies[packageName]
    ) {
      nxVersion = packageJsonContent.dependencies[packageName];
    }
    if (
      packageJsonContent.devDependencies &&
      packageJsonContent.devDependencies[packageName]
    ) {
      nxVersion = packageJsonContent.devDependencies[packageName];
    }
  });
  return nxVersion;
}
