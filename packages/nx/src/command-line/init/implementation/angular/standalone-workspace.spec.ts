import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TempFs } from '../../../../internal-testing-utils/temp-fs';
import { setupStandaloneWorkspace } from './standalone-workspace';

vi.mock('../format', () => ({ recordInitWrite: vi.fn() }));

describe('setupStandaloneWorkspace', () => {
  let tempFs: TempFs;
  let cwd: string;

  beforeEach(() => {
    tempFs = new TempFs('nx-init-angular-standalone');
    // project.json files are written relative to the cwd
    cwd = process.cwd();
    process.chdir(tempFs.tempDir);
  });

  afterEach(() => {
    process.chdir(cwd);
    tempFs.cleanup();
  });

  it('should set the outputs of build targets using the @angular/build:library builder', async () => {
    tempFs.createFilesSync({
      'package.json': JSON.stringify({ name: 'workspace', scripts: {} }),
      'angular.json': JSON.stringify({
        version: 1,
        projects: {
          lib1: {
            root: 'projects/lib1',
            projectType: 'library',
            architect: {
              build: {
                builder: '@angular/build:library',
                options: { tsConfig: 'projects/lib1/tsconfig.lib.json' },
              },
            },
          },
          lib2: {
            root: 'projects/lib2',
            projectType: 'library',
            architect: {
              build: {
                builder: '@angular/build:library',
                options: {
                  tsConfig: 'projects/lib2/tsconfig.lib.json',
                  outputPath: 'dist/my-org/lib2',
                },
              },
            },
          },
        },
      }),
    });

    await setupStandaloneWorkspace(tempFs.tempDir, ['build'], ['build']);

    const readBuildTarget = (projectRoot: string) =>
      JSON.parse(
        readFileSync(join(tempFs.tempDir, projectRoot, 'project.json'), 'utf-8')
      ).targets.build;
    expect(readBuildTarget('projects/lib1')).toMatchObject({
      options: { outputPath: 'dist/lib1' },
      outputs: ['{options.outputPath}'],
    });
    expect(readBuildTarget('projects/lib2')).toMatchObject({
      options: { outputPath: 'dist/my-org/lib2' },
      outputs: ['{options.outputPath}'],
    });
  });
});
