import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('cross-workspace implicit dependencies', () => {
  beforeAll(() =>
    newProject({
      packages: ['@nx/js'],
    })
  );

  afterAll(() => cleanupProject());

  it('should successfully build a project graph when cross-workspace implicit dependencies are present', () => {
    const npmPackage = uniq('npm-package');
    runCLI(`generate @nx/workspace:npm-package ${npmPackage}`);

    function setImplicitDependencies(deps: string[]) {
      updateFile(join(npmPackage, 'package.json'), (content) => {
        const json = JSON.parse(content);
        json.nx = {
          ...json.nx,
          implicitDependencies: deps,
        };
        return JSON.stringify(json, null, 2);
      });
    }

    // First set the implicit dependencies to an intentionally invalid value to prove the command fails during project graph construction
    setImplicitDependencies(['this-project-does-not-exist']);
    expect(
      runCLI(`test ${npmPackage}`, {
        silenceError: true,
      })
    ).toContain('Failed to process project graph');

    // Now set the implicit dependencies to a cross-workspace reference to prove that it is valid, despite not being resolvable in the current workspace
    setImplicitDependencies(['nx-cloud:another-workspace']);
    expect(
      runCLI(`test ${npmPackage}`, {
        silenceError: true,
      })
    ).toContain('Successfully ran target test');
  });
});
