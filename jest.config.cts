import type { Config } from 'jest';
import { getJestProjectsAsync } from '@nx/jest';

module.exports = async (): Promise<Config> => ({
  projects: await getJestProjectsAsync(),
});
