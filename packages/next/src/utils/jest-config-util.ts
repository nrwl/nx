import { Tree, offsetFromRoot } from '@nx/devkit';

function findProjectJestConfig(host: Tree, projectRoot: string): string | null {
  const extensions = ['js', 'ts', 'cts'];

  for (const ext of extensions) {
    const configPath = `${projectRoot}/jest.config.${ext}`;
    if (host.exists(configPath)) {
      return configPath;
    }
  }

  return null;
}

export function updateJestConfig(
  host: Tree,
  options: {
    projectRoot: string;
    projectName: string;
    js?: boolean;
    unitTestRunner?: string;
  }
) {
  if (options.unitTestRunner !== 'jest') {
    return;
  }

  const configPath = findProjectJestConfig(host, options.projectRoot);

  if (!configPath) return;

  const offset = offsetFromRoot(options.projectRoot);
  const isCommonJS = configPath.endsWith('.js') || configPath.endsWith('.cts');

  // Easier to override the whole file rather than replace content since the structure has changed with `next/jest.js` being used.
  // The wrapper around createJestConfig disables SWC path alias resolution.
  // Without explicit baseUrl, Next.js resolves aliases from the app root instead
  // of the workspace root, producing wrong paths. The Nx jest resolver handles
  // alias resolution correctly, so we let it take over.
  const newContent = isCommonJS
    ? `const nextJest = require('next/jest.js');

const createJestConfig = nextJest({
  dir: './',
});

const config = {
  displayName: '${options.projectName}',
  preset: '${offset}jest.preset.js',
  transform: {
    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '${offset}coverage/${options.projectRoot}',
  testEnvironment: 'jsdom',
};

const jestConfig = createJestConfig(config);

module.exports = async () => {
  const resolved = await jestConfig();
  // Disable SWC path alias resolution — handled by Nx jest resolver.
  for (const value of Object.values(resolved.transform)) {
    if (Array.isArray(value) && value[1]?.resolvedBaseUrl) {
      value[1] = { ...value[1], resolvedBaseUrl: undefined };
    }
  }
  return resolved;
};
`
    : `import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  displayName: '${options.projectName}',
  preset: '${offset}jest.preset.js',
  transform: {
    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '${offset}coverage/${options.projectRoot}',
  testEnvironment: 'jsdom',
};

const jestConfig = createJestConfig(config);

export default async () => {
  const resolved = await jestConfig();
  // Disable SWC path alias resolution — handled by Nx jest resolver.
  for (const value of Object.values(resolved.transform)) {
    if (Array.isArray(value) && value[1]?.resolvedBaseUrl) {
      value[1] = { ...value[1], resolvedBaseUrl: undefined };
    }
  }
  return resolved;
};
`;

  host.write(configPath, newContent);
}
