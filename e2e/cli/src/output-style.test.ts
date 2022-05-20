import {
  isNotWindows,
  newProject,
  readFile,
  readJson,
  runCLI,
  runCLIAsync,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import { renameSync } from 'fs';
import { packagesWeCareAbout } from 'nx/src/command-line/report';

describe('Output Style', () => {
  beforeEach(() => newProject());

  it('should stream output', async () => {
    const myapp = uniq('myapp');
    runCLI(`generate @nrwl/web:app ${myapp}`);
    updateProjectConfig(myapp, (c) => {
      c.targets['counter'] = {
        executor: '@nrwl/workspace:counter',
        options: {
          to: 2,
        },
      };
      return c;
    });

    const withPrefixes = runCLI(
      `counter ${myapp} --result=true --output-style=stream`
    );
    expect(withPrefixes).toContain(`[${myapp}`);

    const noPrefixes = runCLI(
      `counter ${myapp} --result=true --output-style=stream-without-prefixes`
    );
    expect(noPrefixes).not.toContain(`[${myapp}`);
  });
});
