/* oxlint-disable no-restricted-imports */
export * from 'nx/src/internal-testing-utils/assert-generators-enforce-version-floor';
export * from 'nx/src/internal-testing-utils/assert-valid-migrations';
export * from 'nx/src/internal-testing-utils/run-migration-against-this-workspace';
export * from 'nx/src/internal-testing-utils/with-environment';
export * from 'nx/src/internal-testing-utils/with-pnpm';
export * from 'nx/src/internal-testing-utils/temp-fs';
export * from 'nx/src/internal-testing-utils/cjs-mock';

export { setCwd } from './src/generators/artifact-name-and-directory-utils';

export async function reservePort(start?: number): Promise<number> {
  const { reservePort } =
    await import('nx/src/internal-testing-utils/port-utils');
  return reservePort(start);
}
