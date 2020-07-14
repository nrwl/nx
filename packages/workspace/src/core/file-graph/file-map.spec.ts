import { createFileMap } from './file-map';

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
      { file: 'apps/demo/src/main.ts', hash: 'some-hash', ext: '.ts' },
      { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash', ext: '.ts' },
      { file: 'libs/ui/src/index.ts', hash: 'some-hash', ext: '.ts' },
    ];

    const result = createFileMap(workspaceJson, files);

    expect(result).toEqual({
      demo: [{ file: 'apps/demo/src/main.ts', hash: 'some-hash', ext: '.ts' }],
      'demo-e2e': [
        { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash', ext: '.ts' },
      ],
      ui: [{ file: 'libs/ui/src/index.ts', hash: 'some-hash', ext: '.ts' }],
    });
  });
});
