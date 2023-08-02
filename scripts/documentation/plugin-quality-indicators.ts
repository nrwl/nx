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

const packagesJson = require('../../nx-dev/nx-dev/public/documentation/generated/manifests/packages.json');
const officialPlugins = Object.keys(packagesJson)
  .filter(
    (m: any) =>
      packagesJson[m].name !== 'add-nx-to-monorepo' &&
      packagesJson[m].name !== 'cra-to-nx' &&
      packagesJson[m].name !== 'create-nx-plugin' &&
      packagesJson[m].name !== 'create-nx-workspace' &&
      packagesJson[m].name !== 'make-angular-cli-faster' &&
      packagesJson[m].name !== 'tao'
  )
  .map((k) => ({
    name: packagesJson[k].name === 'nx' ? 'nx' : '@nx/' + packagesJson[k].name,
    description: packagesJson[k].description,
    url: packagesJson[k].githubRoot,
  }));

const plugins =
  require('../../community/approved-plugins.json') as PluginRegistry[];

async function main() {
  const qualityIndicators: any = {};
  const { data } = await axios.get(`https://api.github.com/repos/nrwl/nx`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_PAT}`,
    },
  });
  const nxGithubStars = data.stargazers_count;
  for (let i = 0; i < officialPlugins.length; i++) {
    const plugin = officialPlugins[i];
    console.log(`Fetching data for ${plugin.name}`);
    const npmData = await getNpmData(plugin, true);
    const npmDownloads = await getNpmDownloads(plugin);
    qualityIndicators[plugin.name] = {
      lastPublishedDate: npmData.lastPublishedDate,
      npmDownloads,
      githubStars: nxGithubStars,
    };
  }
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i];
    console.log(`Fetching data for ${plugin.name}`);
    const npmData = await getNpmData(plugin);
    const npmDownloads = await getNpmDownloads(plugin);
    const githubStars = await getGithubStars(npmData.githubRepo);
    qualityIndicators[plugin.name] = {
      lastPublishedDate: npmData.lastPublishedDate,
      npmDownloads,
      githubStars,
      nxVersion: npmData.nxVersion,
    };
  }

  writeFileSync(
    './nx-dev/nx-dev/pages/extending-nx/quality-indicators.json',
    JSON.stringify(qualityIndicators, null, 2)
  );
}
main();

// Publish date (and github directory, readme content)
// i.e. https://registry.npmjs.org/@nxkit/playwright
async function getNpmData(plugin: PluginRegistry, skipNxVersion = false) {
  try {
    const { data } = await axios.get(
      `https://registry.npmjs.org/${plugin.name}`
    );
    const lastPublishedDate = data.time[data['dist-tags'].latest];
    const nxVersion = skipNxVersion || (await getNxVersion(data));
    if (!data.repository) {
      console.warn('- No repository defined in package.json!');
      return { lastPublishedDate, nxVersion, githubRepo: '' };
    }
    const url: String = data.repository.url;
    const githubRepo = url
      .slice(url.indexOf('github.com/') + 11)
      .replace('.git', '');
    return {
      lastPublishedDate,
      githubRepo,
      nxVersion,
      // readmeContent: plugin.name
    };
  } catch (ex) {
    return { lastPublishedDate: '', githubRepo: '' };
  }
}

// Download count
// i.e. https://api.npmjs.org/downloads/point/2023-06-01:2023-07-01/@nxkit/playwright
async function getNpmDownloads(plugin: PluginRegistry) {
  const lastMonth = getLastMonth();
  try {
    const { data } = await axios.get(
      `https://api.npmjs.org/downloads/point/${stringifyIntervalForUrl(
        lastMonth
      )}/${plugin.name}`
    );
    return data.downloads;
  } catch (ex) {
    return '';
  }
}

export function getLastMonth() {
  const now = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(now.getMonth() - 1);
  return {
    start: oneMonthAgo,
    end: now,
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
    console.warn('- Could not load GitHub stars!');
    return -1;
  }
}

async function getNxVersion(data: any) {
  const latest = data['dist-tags'].latest;
  const nxPackages = [
    '@nx/devkit',
    '@nrwl/devkit',
    '@nx/workspace',
    '@nrwl/workspace',
  ];
  let devkitVersion = '';
  for (let i = 0; i < nxPackages.length && !devkitVersion; i++) {
    const packageName = nxPackages[i];
    if (data.versions[latest]?.dependencies) {
      devkitVersion = data.versions[latest]?.dependencies[packageName];
      if (devkitVersion) {
        return await findNxRange(packageName, devkitVersion);
      }
    }
    if (!devkitVersion && data.versions[latest]?.peerDependencies) {
      devkitVersion = data.versions[latest]?.peerDependencies[packageName];
      if (devkitVersion) {
        return await findNxRange(packageName, devkitVersion);
      }
    }
  }
  console.warn('- No dependency on @nx/devkit!');
  return devkitVersion;
}

async function findNxRange(packageName: string, devkitVersion: string) {
  devkitVersion = devkitVersion
    .replace('^', '')
    .replace('>=', '')
    .replace('>', '');
  const lookupPackage = packageName.includes('@nx')
    ? '@nx/devkit'
    : '@nrwl/devkit';
  const { data: devkitData } = await axios.get(
    `https://registry.npmjs.org/${lookupPackage}`
  );
  if (!devkitData.versions[devkitVersion]?.peerDependencies) {
    const dependencies = devkitData.versions[devkitVersion]?.dependencies;
    return dependencies && (dependencies?.nx || dependencies['@nrwl/tao']);
  }
  return devkitData.versions[devkitVersion]?.peerDependencies.nx;
}
