import {
  cleanupProject,
  getPublishedVersion,
  runCLI,
  tmpProjPath,
  uniq,
} from '@nx/e2e-utils';
import { renameSync } from 'fs';
import { setupMiscTests } from './misc-setup';

describe('Nx Commands - report and list', () => {
  beforeAll(() => setupMiscTests());

  afterAll(() => cleanupProject());

  it(`should report package versions`, async () => {
    const reportOutput = runCLI('report');

    expect(reportOutput).toEqual(
      expect.stringMatching(
        new RegExp(`\@nx\/workspace.*:.*${getPublishedVersion()}`)
      )
    );
    expect(reportOutput).toContain('@nx/workspace');
  }, 120000);

  it(`should list plugins`, async () => {
    let listOutput = runCLI('list');

    expect(listOutput).toContain('NX   Installed plugins');

    // just check for some, not all
    expect(listOutput).toContain('@nx/workspace');

    // temporarily make it look like this isn't installed
    // For pnpm, we need to rename the actual package in .pnpm directory, not just the symlink
    const { readdirSync, statSync } = require('fs');
    const pnpmDir = tmpProjPath('node_modules/.pnpm');
    let renamedPnpmEntry = null;

    if (require('fs').existsSync(pnpmDir)) {
      const entries = readdirSync(pnpmDir);
      const nextEntries = entries.filter((entry) => entry.includes('nx+next@'));

      // Rename all nx+next entries
      const renamedEntries = [];
      for (const entry of nextEntries) {
        const tmpName = entry.replace('@nx+next@', 'tmp_nx_next_');
        renameSync(
          tmpProjPath(`node_modules/.pnpm/${entry}`),
          tmpProjPath(`node_modules/.pnpm/${tmpName}`)
        );
        renamedEntries.push(entry);
      }
      renamedPnpmEntry = renamedEntries;
    }

    // Also rename the symlink
    if (require('fs').existsSync(tmpProjPath('node_modules/@nx/next'))) {
      renameSync(
        tmpProjPath('node_modules/@nx/next'),
        tmpProjPath('node_modules/@nx/next_tmp')
      );
    }

    listOutput = runCLI('list');
    expect(listOutput).toContain('NX   Also available');

    // look for specific plugin
    listOutput = runCLI('list @nx/workspace');

    expect(listOutput).toContain('Capabilities in @nx/workspace');

    // check for schematics
    expect(listOutput).toContain('workspace');
    expect(listOutput).toContain('library');

    // check for builders
    expect(listOutput).toContain('run-commands');

    listOutput = runCLI('list @nx/angular');

    expect(listOutput).toContain('Capabilities in @nx/angular');

    expect(listOutput).toContain('library');
    expect(listOutput).toContain('component');

    // check for builders
    expect(listOutput).toContain('package');

    // look for uninstalled core plugin
    listOutput = runCLI('list @nx/next');

    expect(listOutput).toContain('NX   @nx/next is not currently installed');

    // look for an unknown plugin
    listOutput = runCLI('list @wibble/fish');

    expect(listOutput).toContain(
      'NX   @wibble/fish is not currently installed'
    );

    // put back the @nx/next module (or all the other e2e tests after this will fail)
    if (renamedPnpmEntry && Array.isArray(renamedPnpmEntry)) {
      for (const entry of renamedPnpmEntry) {
        const tmpName = entry.replace('@nx+next@', 'tmp_nx_next_');
        renameSync(
          tmpProjPath(`node_modules/.pnpm/${tmpName}`),
          tmpProjPath(`node_modules/.pnpm/${entry}`)
        );
      }
    }

    if (require('fs').existsSync(tmpProjPath('node_modules/@nx/next_tmp'))) {
      renameSync(
        tmpProjPath('node_modules/@nx/next_tmp'),
        tmpProjPath('node_modules/@nx/next')
      );
    }
  }, 120000);
});
