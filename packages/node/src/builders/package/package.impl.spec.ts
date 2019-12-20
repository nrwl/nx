import { Architect } from '@angular-devkit/architect';
import { EventEmitter } from 'events';
import { join } from 'path';
import { getMockContext, getTestArchitect } from '../../utils/testing';
import { MockBuilderContext } from '@nrwl/workspace/testing';

import {
  NodePackageBuilderOptions,
  runNodePackageBuilder
} from './package.impl';
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

describe('NodeCompileBuilder', () => {
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
            types: ['node']
          },
          exclude: ['**/*.spec.ts'],
          include: ['**/*.ts']
        };
      } else {
        return {
          name: 'nodelib'
        };
      }
    });
    fsUtility.writeJsonFile.mockImplementation(() => {});
    context = await getMockContext();
    context.target.project = 'nodelib';
    testOptions = {
      assets: [],
      main: 'libs/nodelib/src/index.ts',
      outputPath: 'dist/libs/nodelib',
      packageJson: 'libs/nodelib/package.json',
      tsConfig: 'libs/nodelib/tsconfig.lib.json',
      watch: false,
      sourceMap: false
    };
  });

  it('should call tsc to compile', done => {
    runNodePackageBuilder(testOptions, context).subscribe({
      complete: () => {
        expect(fork).toHaveBeenCalledWith(
          `${context.workspaceRoot}/node_modules/typescript/bin/tsc`,
          [
            '-p',
            join(context.workspaceRoot, testOptions.tsConfig),
            '--outDir',
            join(context.workspaceRoot, testOptions.outputPath)
          ],
          { stdio: [0, 1, 2, 'ipc'] }
        );

        done();
      }
    });
    fakeEventEmitter.emit('exit', 0);
  });

  it('should update the package.json after compiling typescript', done => {
    runNodePackageBuilder(testOptions, context).subscribe({
      complete: () => {
        expect(fork).toHaveBeenCalled();
        expect(fsUtility.writeJsonFile).toHaveBeenCalledWith(
          `${testOptions.outputPath}/package.json`,
          {
            name: 'nodelib',
            main: 'index.js',
            typings: 'index.d.ts'
          }
        );

        done();
      }
    });
    fakeEventEmitter.emit('exit', 0);
  });

  describe('Asset copying', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should be able to copy assets using the glob object', done => {
      glob.sync.mockReturnValue(['logo.png']);
      runNodePackageBuilder(
        {
          ...testOptions,
          assets: [
            {
              glob: '**.*',
              input: 'lib/nodelib/src/assets',
              output: './newfolder',
              ignore: []
            }
          ]
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
        }
      });
      fakeEventEmitter.emit('exit', 0);
    });
    it('should be able to copy assets with a regular string', done => {
      glob.sync.mockReturnValue(['lib/nodelib/src/LICENSE']);

      runNodePackageBuilder(
        {
          ...testOptions,
          assets: ['lib/nodelib/src/LICENSE']
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
        }
      });
      fakeEventEmitter.emit('exit', 0);
    });

    it('should be able to copy assets with a glob string', done => {
      glob.sync.mockReturnValue([
        'lib/nodelib/src/README.md',
        'lib/nodelib/src/CONTRIBUTING.md'
      ]);
      runNodePackageBuilder(
        {
          ...testOptions,
          assets: ['lib/nodelib/src/*.MD']
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
        }
      });
      fakeEventEmitter.emit('exit', 0);
    });
  });
});
