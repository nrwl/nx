import type { PlaywrightTestConfig } from '@playwright/test';

// Channels that launch the Chromium build `playwright install chromium`
// downloads. `chrome-for-testing` is Playwright's alias for it.
const downloadedChromiumChannels = new Set([
  'chromium',
  'chromium-headless-shell',
  'chrome-for-testing',
]);

/**
 * `PW_TEST_CONNECT_WS_ENDPOINT` as a config evaluation left it, which is the
 * value Playwright's fixtures read, and whether the config changed it.
 */
export interface ConnectEndpoint {
  value: string | undefined;
  changedByConfig: boolean;
}

export function readConnectEndpoint(
  beforeConfig: string | undefined,
  afterConfig: NodeJS.ProcessEnv
): ConnectEndpoint {
  const value = afterConfig.PW_TEST_CONNECT_WS_ENDPOINT;
  return { value, changedByConfig: value !== beforeConfig };
}

// Resolves each project's browser the way Playwright's fixtures do, so the
// install matches what the tests launch.
export function getConfigBrowsers(config: PlaywrightTestConfig): string[] {
  const browsers = new Set<string>();
  // Without `projects`, Playwright runs the config itself as the one project.
  for (const project of config.projects ?? [config]) {
    const browser = getDownloadedBrowser(mergeUse(config.use, project.use));
    if (browser) {
      browsers.add(browser);
    }
  }
  return [...browsers].sort();
}

// Mirrors Playwright's `mergeObjects`: shallow, and an `undefined` value keeps
// the config's.
function mergeUse(
  configUse: PlaywrightTestConfig['use'],
  projectUse: PlaywrightTestConfig['use']
): PlaywrightTestConfig['use'] {
  const use = { ...configUse };
  for (const [key, value] of Object.entries(projectUse ?? {})) {
    if (value !== undefined) {
      use[key] = value;
    }
  }
  return use;
}

function getDownloadedBrowser(use: PlaywrightTestConfig['use']): string | null {
  // A remote browser or a custom executable needs no download.
  if (use.connectOptions || use.launchOptions?.executablePath) {
    return null;
  }
  // Other channels are left to the user: a branded browser such as `chrome`
  // needs admin rights to install, and `webkit-wsl` provisions a WSL distribution.
  const channel = use.channel ?? use.launchOptions?.channel;
  if (channel && !downloadedChromiumChannels.has(channel)) {
    return null;
  }
  const browserName = use.browserName ?? use.defaultBrowserType ?? 'chromium';
  switch (browserName) {
    case 'chromium':
    case 'firefox':
    case 'webkit':
      return browserName;
    default:
      return null;
  }
}
