import {
  cleanupProject,
  runCLI,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

describe('create-nx-workspace --template', () => {
  afterEach(() => cleanupProject());

  const templates = ['nrwl/react-template'] as const;

  describe.each(['npm', 'pnpm'] as const)('with %s', (packageManager) => {
    it.each(templates)(
      'should clone %s and run lint,test,build',
      (template) => {
        const wsName = uniq('template');

        runCreateWorkspace(wsName, {
          template,
          packageManager,
        });

        expect(() => runCLI('run-many -t lint,test,build')).not.toThrow();
      },
      600_000
    );
  });
});
