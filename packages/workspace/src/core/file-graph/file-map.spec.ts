import { createProjectFileMap } from './project-file-map';

describe('createFileMap', () => {
  it('should map files to projects', () => {
    const workspaceJson = {
      projects: {
        demo: {
          root: 'apps/demo',
          sourceRoot: 'apps/demo/src',
          projectType: 'application',
        },
        'demo-e2e': {
          root: 'apps/demo-e2e',
          sourceRoot: 'apps/demo-e2e/src',
          projectType: 'application',
        },
        ui: {
          root: 'libs/ui',
          sourceRoot: 'libs/ui/src',
          projectType: 'library',
        },
      },
    };
    const files = [
      { file: 'apps/demo/src/main.ts', hash: 'some-hash' },
      { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash' },
      { file: 'libs/ui/src/index.ts', hash: 'some-hash' },
    ];

    const result = createProjectFileMap(workspaceJson, files);

    expect(result).toEqual({
      demo: [{ file: 'apps/demo/src/main.ts', hash: 'some-hash' }],
      'demo-e2e': [{ file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash' }],
      ui: [{ file: 'libs/ui/src/index.ts', hash: 'some-hash' }],
    });
  });
});
