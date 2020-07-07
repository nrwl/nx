import { EventEmitter } from 'events';
import { join } from 'path';
import { getMockContext } from '../../utils/testing';
import { MockBuilderContext } from '@nrwl/workspace/testing';
jest.mock('@nrwl/workspace/src/core/project-graph');
let projectGraph = require('@nrwl/workspace/src/core/project-graph');
import {
  ProjectGraph,
  ProjectType,
} from '@nrwl/workspace/src/core/project-graph';

import {
  NodePackageBuilderOptions,
  runNodePackageBuilder,
} from './package.impl';
import * as fsMock from 'fs';

jest.mock('glob');
let glob = require('glob');
jest.mock('fs-extra');
let fs = require('fs-extra');
jest.mock('@nrwl/workspace/src/utils/fileutils');
let fsUtility = require('@nrwl/workspace/src/utils/fileutils');
jest.mock('child_process');
let { fork } = require('child_process');
jest.mock('tree-kill');
let treeKill = require('tree-kill');

describe('NodePackageBuilder', () => {
  let testOptions: NodePackageBuilderOptions;
  let context: MockBuilderContext;
  let fakeEventEmitter: EventEmitter;

  beforeEach(async () => {
    fakeEventEmitter = new EventEmitter();
    (fakeEventEmitter as any).pid = 123;
    fork.mockReturnValue(fakeEventEmitter);
    treeKill.mockImplementation((pid, signal, callback) => {
      callback();
    });

    fsUtility.readJsonFile.mockImplementation((arg: string) => {
      if (arg.endsWith('tsconfig.lib.json')) {
        return {
          extends: './tsconfig.json',
          compilerOptions: {
            outDir: '../../dist/out-tsc',
            declaration: true,
            rootDir: './src',
            types: ['node'],
          },
          exclude: ['**/*.spec.ts'],
          include: ['**/*.ts'],
        };
      } else {
        return {
          name: 'nodelib',
        };
      }
    });
    fsUtility.writeJsonFile.mockImplementation(() => {});
    context = await getMockContext();
    context.target.target = 'build';
    context.target.project = 'nodelib';
    testOptions = {
      assets: [],
      main: 'libs/nodelib/src/index.ts',
      outputPath: 'dist/libs/nodelib',
      packageJson: 'libs/nodelib/package.json',
      tsConfig: 'libs/nodelib/tsconfig.lib.json',
      watch: false,
      sourceMap: false,
    };
  });

  describe('Without library dependencies', () => {
    beforeEach(() => {
      // mock createProjectGraph without deps
      spyOn(projectGraph, 'createProjectGraph').and.callFake(() => {
        return {
          nodes: {},
          dependencies: {},
        } as ProjectGraph;
      });
    });

    it('should call tsc to compile', (done) => {
      runNodePackageBuilder(testOptions, context).subscribe({
        complete: () => {
          expect(
            fork
          ).toHaveBeenCalledWith(
            `${context.workspaceRoot}/node_modules/typescript/bin/tsc`,
            [
              '-p',
              join(context.workspaceRoot, testOptions.tsConfig),
              '--outDir',
              join(context.workspaceRoot, testOptions.outputPath),
            ],
            { stdio: [0, 1, 2, 'ipc'] }
          );

          done();
        },
      });
      fakeEventEmitter.emit('exit', 0);
    });

    it('should update the package.json after compiling typescript', (done) => {
      runNodePackageBuilder(testOptions, context).subscribe({
        complete: () => {
          expect(fork).toHaveBeenCalled();
          expect(fsUtility.writeJsonFile).toHaveBeenCalledWith(
            `${testOptions.outputPath}/package.json`,
            {
              name: 'nodelib',
              main: 'index.js',
              typings: 'index.d.ts',
            }
          );

          done();
        },
      });
      fakeEventEmitter.emit('exit', 0);
    });

    it('should have the output path in the BuilderOutput', (done) => {
      runNodePackageBuilder(testOptions, context).subscribe({
        next: (value) => {
          expect(value.outputPath).toEqual(testOptions.outputPath);
        },
        complete: () => {
          done();
        },
      });
      fakeEventEmitter.emit('exit', 0);
    });

    describe('Asset copying', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should be able to copy assets using the glob object', (done) => {
        glob.sync.mockReturnValue(['logo.png']);
        runNodePackageBuilder(
          {
            ...testOptions,
            assets: [
              {
                glob: '**.*',
                input: 'lib/nodelib/src/assets',
                output: './newfolder',
                ignore: [],
              },
            ],
          },
          context
        ).subscribe({
          complete: () => {
            expect(fs.copy).toHaveBeenCalledTimes(1);
            expect(fs.copy).toHaveBeenCalledWith(
              `${context.workspaceRoot}/lib/nodelib/src/assets/logo.png`,
              `${context.workspaceRoot}/${testOptions.outputPath}/newfolder/logo.png`
            );

            done();
          },
        });
        fakeEventEmitter.emit('exit', 0);
      });
      it('should be able to copy assets with a regular string', (done) => {
        glob.sync.mockReturnValue(['lib/nodelib/src/LICENSE']);

        runNodePackageBuilder(
          {
            ...testOptions,
            assets: ['lib/nodelib/src/LICENSE'],
          },
          context
        ).subscribe({
          complete: () => {
            expect(fs.copy).toHaveBeenCalledTimes(1);
            expect(fs.copy).toHaveBeenCalledWith(
              `${context.workspaceRoot}/lib/nodelib/src/LICENSE`,
              `${context.workspaceRoot}/${testOptions.outputPath}/LICENSE`
            );
            done();
          },
        });
        fakeEventEmitter.emit('exit', 0);
      });

      it('should be able to copy assets with a glob string', (done) => {
        glob.sync.mockReturnValue([
          'lib/nodelib/src/README.md',
          'lib/nodelib/src/CONTRIBUTING.md',
        ]);
        runNodePackageBuilder(
          {
            ...testOptions,
            assets: ['lib/nodelib/src/*.MD'],
          },
          context
        ).subscribe({
          complete: () => {
            expect(fs.copy).toHaveBeenCalledTimes(2);
            expect(fs.copy).toHaveBeenCalledWith(
              `${context.workspaceRoot}/lib/nodelib/src/README.md`,
              `${context.workspaceRoot}/${testOptions.outputPath}/README.md`
            );
            expect(fs.copy).toHaveBeenCalledWith(
              `${context.workspaceRoot}/lib/nodelib/src/CONTRIBUTING.md`,
              `${context.workspaceRoot}/${testOptions.outputPath}/CONTRIBUTING.md`
            );
            done();
          },
        });
        fakeEventEmitter.emit('exit', 0);
      });
    });
  });

  describe('building with dependencies', () => {
    beforeEach(() => {
      spyOn(projectGraph, 'createProjectGraph').and.callFake(() => {
        return {
          nodes: {
            nodelib: {
              type: ProjectType.lib,
              name: 'nodelib',
              data: {
                files: [],
                root: 'libs/nodelib',
                architect: { build: { builder: 'any builder' } },
              },
            },
            'nodelib-child': {
              type: ProjectType.lib,
              name: 'nodelib-child',
              data: {
                files: [],
                root: 'libs/nodelib-child',
                prefix: 'proj',
                architect: {
                  build: {
                    builder: 'any builder',
                    options: {
                      assets: [],
                      main: 'libs/nodelib-child/src/index.ts',
                      outputPath: 'dist/libs/nodelib-child',
                      packageJson: 'libs/nodelib-child/package.json',
                      tsConfig: 'libs/nodelib-child/tsconfig.lib.json',
                    },
                  },
                },
              },
            },
          },
          dependencies: {
            nodelib: [
              {
                type: ProjectType.lib,
                target: 'nodelib-child',
                source: null,
              },
            ],
            'nodelib-child': [],
          },
        } as ProjectGraph;
      });

      // fake that dep project has been built
      // dist/libs/nodelib-child/package.json
      fsUtility.fileExists.mockImplementation((arg: string) => {
        if (arg.endsWith('dist/libs/nodelib-child/package.json')) {
          return true;
        } else {
          return false;
        }
      });

      // fsMock.unlinkSync.mockImplementation(() => {});

      spyOn(fsMock, 'unlinkSync');
    });

    it('should call the tsc compiler with the modified tsconfig.json', (done) => {
      let tmpTsConfigPath = join(
        '/root',
        'tmp',
        'libs/nodelib',
        'tsconfig.generated.json'
      );

      runNodePackageBuilder(testOptions, context).subscribe({
        complete: () => {
          expect(fork).toHaveBeenCalledWith(
            `${context.workspaceRoot}/node_modules/typescript/bin/tsc`,
            [
              '-p',
              tmpTsConfigPath,
              // join(context.workspaceRoot, testOptions.tsConfig),
              '--outDir',
              join(context.workspaceRoot, testOptions.outputPath),
            ],
            { stdio: [0, 1, 2, 'ipc'] }
          );

          done();
        },
      });
      fakeEventEmitter.emit('exit', 0);
    });
  });
});
