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

const packagesJson = require('../../nx-dev/nx-dev/public/documentation/generated/manifests/nx-api.json');
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
  try {
    const qualityIndicators: any = {};
    for (let i = 0; i < officialPlugins.length; i++) {
      const plugin = officialPlugins[i];
      console.log(`Fetching data for ${plugin.name}`);
      const npmData = await getNpmData(plugin, true);
      const npmDownloads = await getNpmDownloads(plugin);
      qualityIndicators[plugin.name] = {
        lastPublishedDate: npmData.lastPublishedDate,
        npmDownloads,
        githubRepo: `nrwl/nx`,
      };
    }
    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      console.log(`Fetching data for ${plugin.name}`);
      const npmData = await getNpmData(plugin);
      const npmDownloads = await getNpmDownloads(plugin);
      qualityIndicators[plugin.name] = {
        lastPublishedDate: npmData.lastPublishedDate,
        npmDownloads,
        githubRepo: npmData.githubRepo,
        nxVersion: npmData.nxVersion,
      };
    }
    const repos = Object.keys(qualityIndicators).map((pluginName) => {
      const [owner, repo] =
        qualityIndicators[pluginName].githubRepo?.split('/');
      return {
        owner,
        repo,
      };
    });
    const starData = await getGithubStars(repos);
    Object.keys(qualityIndicators).forEach((key) => {
      qualityIndicators[key].githubStars =
        starData[qualityIndicators[key].githubRepo.replace(/[\-\/#]/g, '')]
          ?.stargazers?.totalCount || -1;
      delete qualityIndicators[key].githubRepo;
    });

    writeFileSync(
      './nx-dev/nx-dev/pages/quality-indicators.json',
      JSON.stringify(qualityIndicators, null, 2)
    );
  } catch (ex) {
    console.warn('Failed to load quality indicators!');
    console.warn(ex);
    // Don't overwrite quality-indicators.json if the script fails
  }
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
    const indexOfTree = url.indexOf('/tree/');
    const githubRepo = url
      .slice(0, indexOfTree === -1 ? undefined : indexOfTree)
      .slice(0, url.indexOf('#') === -1 ? undefined : url.indexOf('#'))
      .slice(url.indexOf('github.com/') + 11)
      .replace('.git', '');
    return {
      lastPublishedDate,
      githubRepo,
      nxVersion,
      // readmeContent: plugin.name
    };
  } catch (ex) {
    console.warn('Failed to load npm data for ' + plugin.name, ex);
    return {
      lastPublishedData: '',
      githubRepo: '',
      nxVersion: '',
    };
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
    console.warn('Failed to load npm downloads for ' + plugin.name, ex);
    return 0;
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
// i.e. https://api.github.com/graphql
async function getGithubStars(repos: { owner: string; repo: string }[]) {
  const query = `
  fragment repoProperties on Repository {
    nameWithOwner
    stargazers {
      totalCount
    }
  }
  
  {
    ${repos
      .filter(({ owner, repo }) => owner && repo && !owner.includes('.'))
      .map(
        ({ owner, repo }, index) =>
          `${owner.replace(/[\-#]/g, '')}${repo.replace(
            /[\-#]/g,
            ''
          )}: repository(owner: "${owner}", name: "${repo}") {
      ...repoProperties
    }`
      )
      .join('\n')}
  }`;

  const result = await axios.post(
    'https://api.github.com/graphql',
    {
      query,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    }
  );

  return result.data.data;
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
