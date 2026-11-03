import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Configuration } from '@rspack/core';
import { getBrowserslistTargets } from './get-browserslist-targets';

describe('getBrowserslistTargets', () => {
  const root = mkdtempSync(join(tmpdir(), 'nx-browserslist-targets-'));

  beforeAll(() => {
    writeFileSync(
      join(root, '.browserslistrc'),
      'chrome 110\n\n[modern]\nchrome 120\n'
    );
    mkdirSync(join(root, 'config'));
    writeFileSync(
      join(root, 'config/.browserslistrc'),
      'firefox 110\n\n[modern]\nfirefox 120\n'
    );
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it.each<{
    name: string;
    target: Configuration['target'];
    browser: string;
    version: string;
  }>([
    {
      name: 'a query',
      target: 'browserslist:chrome 100',
      browser: 'chrome',
      version: '100',
    },
    {
      name: 'an environment of the project config',
      target: 'browserslist:modern',
      browser: 'chrome',
      version: '120',
    },
    {
      name: 'an environment the project config does not define',
      target: 'browserslist:production',
      browser: 'chrome',
      version: '110',
    },
    {
      name: 'a config path with an environment',
      target: `browserslist:${join(root, 'config/.browserslistrc')}:modern`,
      browser: 'firefox',
      version: '120',
    },
    {
      name: 'a browserslist entry in a target array',
      target: ['web', 'browserslist:chrome 100'],
      browser: 'chrome',
      version: '100',
    },
  ])('reads the browsers of $name', ({ target, browser, version }) => {
    expect(getBrowserslistTargets(target, root)).toEqual({
      queries: [`${browser} >= ${version}`],
      swc: { [browser]: `${version}.0.0` },
    });
  });
});
