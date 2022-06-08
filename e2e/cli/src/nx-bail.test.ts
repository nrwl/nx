import { newProject, runCLI, uniq, updateProjectConfig } from '@nrwl/e2e/utils';

describe('Nx Bail', () => {
  beforeEach(() => newProject());

  it('should stop executing all tasks when one of the tasks fails', async () => {
    const myapp1 = uniq('a');
    const myapp2 = uniq('b');
    runCLI(`generate @nrwl/web:app ${myapp1}`);
    runCLI(`generate @nrwl/web:app ${myapp2}`);
    updateProjectConfig(myapp1, (c) => {
      c.targets['error'] = {
        executor: 'nx:run-commands',
        options: {
          command: 'echo boom1 && exit 1',
        },
      };
      return c;
    });
    updateProjectConfig(myapp2, (c) => {
      c.targets['error'] = {
        executor: 'nx:run-commands',
        options: {
          command: 'echo boom2 && exit 1',
        },
      };
      return c;
    });

    let withoutBail = runCLI(`run-many --target=error --all --parallel=1`, {
      silenceError: true,
    })
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r);

    withoutBail = withoutBail.slice(withoutBail.indexOf('Failed tasks:'));
    expect(withoutBail).toContain(`- ${myapp1}:error`);
    expect(withoutBail).toContain(`- ${myapp2}:error`);

    let withBail = runCLI(
      `run-many --target=error --all --parallel=1 --nx-bail`,
      {
        silenceError: true,
      }
    )
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r);
    withBail = withBail.slice(withBail.indexOf('Failed tasks:'));
    expect(withBail).toContain(`- ${myapp1}:error`);
    expect(withBail).not.toContain(`- ${myapp2}:error`);
  });
});
