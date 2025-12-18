import type { Config } from 'jest';
const { getJestProjectsAsync } = require('@nx/jest');

module.exports = async (): Promise<Config> => ({
  projects: await getJestProjectsAsync(),
});
