import {
  cleanupProject,
  readJson,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e-utils';
import { setupRunTests } from './run-setup';

describe('Nx Bail', () => {
  let proj: string;
  beforeAll(() => (proj = setupRunTests()));
  afterAll(() => cleanupProject());

  // Ensures that nx.json is restored to its original state after each test
  let existingNxJson;
  beforeEach(() => {
    existingNxJson = readJson('nx.json');
  });
  afterEach(() => {
    updateJson('nx.json', () => existingNxJson);
  });

  it('should stop executing all tasks when one of the tasks fails', async () => {
    const myapp1 = uniq('a');
    const myapp2 = uniq('b');
    runCLI(`generate @nx/web:app apps/${myapp1}`);
    runCLI(`generate @nx/web:app apps/${myapp2}`);
    updateJson(`apps/${myapp1}/project.json`, (c) => {
      c.targets['error'] = {
        command: 'echo boom1 && exit 1',
      };
      return c;
    });
    updateJson(`apps/${myapp2}/project.json`, (c) => {
      c.targets['error'] = {
        executor: 'nx:run-commands',
        options: {
          command: 'echo boom2 && exit 1',
        },
      };
      return c;
    });

    let withoutBail = runCLI(`run-many --target=error --parallel=1`, {
      silenceError: true,
    })
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r);

    withoutBail = withoutBail.slice(withoutBail.indexOf('Failed tasks:'));
    expect(withoutBail).toContain(`- ${myapp1}:error`);
    expect(withoutBail).toContain(`- ${myapp2}:error`);

    let withBail = runCLI(`run-many --target=error --parallel=1 --nx-bail`, {
      silenceError: true,
    })
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r);
    withBail = withBail.slice(withBail.indexOf('Failed tasks:'));

    if (withBail[1] === `- ${myapp1}:error`) {
      expect(withBail).not.toContain(`- ${myapp2}:error`);
    } else {
      expect(withBail[1]).toEqual(`- ${myapp2}:error`);
      expect(withBail).not.toContain(`- ${myapp1}:error`);
    }
  });
});
