import { Tree, offsetFromRoot } from '@nx/devkit';

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

  const configPath = `${options.projectRoot}/jest.config.${
    options.js ? 'js' : 'ts'
  }`;

  if (!host.exists(configPath)) return;

  const offset = offsetFromRoot(options.projectRoot);
  // Easier to override the whole file rather than replace content since the structure has changed with `next/jest.js` being used.
  const newContent = options.js
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

module.exports = createJestConfig(config);
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

export default createJestConfig(config);
`;

  host.write(configPath, newContent);
}
