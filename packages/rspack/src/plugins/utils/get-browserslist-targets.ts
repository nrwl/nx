import type { Configuration } from '@rspack/core';
import browserslist = require('browserslist');
import { coerce, lt, type SemVer } from 'semver';

// Rspack 2 renames browsers like this before it passes its own targets to swc,
// and drops the ones swc rejects.
const SWC_BROWSER_NAMES: Record<string, string | null> = {
  and_chr: 'chrome',
  and_ff: 'firefox',
  ie_mob: 'ie',
  ios_saf: 'ios',
  op_mob: 'opera',
  and_qq: null,
  and_uc: null,
  baidu: null,
  bb: null,
  kaios: null,
};

export interface BrowserslistTargets {
  queries: string[];
  swc: Record<string, string>;
}

export function getBrowserslistTargets(
  target: Configuration['target'],
  projectRoot: string
): BrowserslistTargets | undefined {
  const browsers = getBrowsers(target, projectRoot)?.map((entry) => {
    const [name, versions] = entry.split(' ');
    return { entry, name, lowestVersion: versions.split('-')[0] };
  });
  if (!browsers) {
    return undefined;
  }

  return {
    // Lightning CSS rejects exact versions newer than its data, so pass numeric versions as `>=`.
    queries: browsers.map(({ entry, name, lowestVersion }) =>
      isVersion(lowestVersion) ? `${name} >= ${lowestVersion}` : entry
    ),
    swc: getSwcTargets(browsers),
  };
}

function getBrowsers(
  target: Configuration['target'],
  projectRoot: string
): string[] | undefined {
  // `web` and `webworker` carry no browser versions, so use the project's config.
  if (target === 'web' || target === 'webworker') {
    return loadBrowserslist(undefined, projectRoot);
  }

  // Autoprefixer never sees these browsers, and rspack 1 passes them to neither swc nor
  // Lightning CSS.
  const lists = (Array.isArray(target) ? target : [target])
    .map((entry) =>
      typeof entry === 'string' ? entry.match(/^browserslist(?::(.+))?$/) : null
    )
    .filter(Boolean)
    .map((match) => loadBrowserslist(match[1]?.trim(), projectRoot))
    .filter(Boolean);
  return lists.length ? lists.flat() : undefined;
}

// Reads `browserslist:<rest>` like rspack: a config path with an optional env, then
// a query, then an env. Resolve in JS so `extends` packages are found from the project.
function loadBrowserslist(
  rest: string | undefined,
  projectRoot: string
): string[] | undefined {
  const [, configPath, env] =
    (rest ?? '').match(/^(?:((?:[A-Z]:)?[/\\].*?))?(?::(.+?))?$/) ?? [];
  if (configPath) {
    return browserslist(undefined, {
      config: configPath,
      env,
      path: projectRoot,
    });
  }
  if (rest) {
    try {
      return browserslist(rest, { path: projectRoot });
    } catch (error) {
      if (!error?.browserslist) {
        throw error;
      }
      return browserslist(undefined, { env: rest, path: projectRoot });
    }
  }

  const config = browserslist.loadConfig({ path: projectRoot });
  return config ? browserslist(config, { path: projectRoot }) : undefined;
}

// swc in rspack 1.7.0 and earlier lowers everything for queries newer than its
// data, but compares minimum versions directly.
function getSwcTargets(
  browsers: { name: string; lowestVersion: string }[]
): Record<string, string> {
  const targets: Record<string, SemVer> = {};
  for (const { name, lowestVersion } of browsers) {
    const swcName = name in SWC_BROWSER_NAMES ? SWC_BROWSER_NAMES[name] : name;
    // Safari Technology Preview supports every feature.
    const version =
      lowestVersion === 'TP'
        ? coerce('999')
        : isVersion(lowestVersion)
          ? coerce(lowestVersion)
          : null;
    if (
      swcName &&
      version &&
      (!targets[swcName] || lt(version, targets[swcName]))
    ) {
      targets[swcName] = version;
    }
  }
  return Object.fromEntries(
    Object.entries(targets).map(([name, version]) => [name, version.version])
  );
}

function isVersion(version: string): boolean {
  return /^\d+(\.\d+)*$/.test(version);
}

export function getUnsupportedEnvironmentFeatures(
  rspackCore: typeof import('@rspack/core'),
  projectRoot: string,
  browserslistQueries: string[]
): Record<string, false> {
  const { config } = rspackCore;
  const options = config.getNormalizedRspackOptions({
    context: projectRoot,
    // Rspack throws when its data has none of these versions. Adding the latest
    // Chrome avoids that without turning off a feature the others support.
    target: [
      'web',
      `browserslist:${[...browserslistQueries, 'last 1 chrome version'].join(', ')}`,
    ],
  });
  config.applyRspackOptionsDefaults(options);
  return Object.fromEntries(
    Object.entries(options.output.environment).filter(
      ([, supported]) => supported === false
    )
  ) as Record<string, false>;
}
