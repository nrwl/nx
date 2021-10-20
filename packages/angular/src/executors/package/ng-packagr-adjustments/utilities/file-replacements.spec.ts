import { fs, vol } from 'memfs';
import { performFileReplacements } from './file-replacements';

jest.mock('fs', () => require('memfs').fs);

describe('File Replacements', () => {
  beforeEach(() => {
    vol.fromJSON(
      {
        './apps/demo/src/envs/env.ts': 'console.log("env");',
        './apps/demo/src/envs/prod.env.ts': 'console.log("prod");',
        './apps/app2/src/envs/env.ts': 'console.log("env");',
        './apps/app2/src/envs/dev.env.ts': 'console.log("dev");',
      },
      '/root'
    );
  });

  it('should replace the files correctly', () => {
    // ARRANGE
    jest.spyOn(process, 'on');
    const fileReplacements = [
      {
        replace: './apps/demo/src/envs/env.ts',
        with: './apps/demo/src/envs/prod.env.ts',
      },
      {
        replace: './apps/app2/src/envs/env.ts',
        with: './apps/app2/src/envs/dev.env.ts',
      },
    ];

    // ACT
    performFileReplacements(fileReplacements, '/root');

    // ASSERT
    expect(
      fs.readFileSync('/root/apps/demo/src/envs/env.ts', { encoding: 'utf-8' })
    ).toEqual(`console.log("prod");`);
    expect(
      fs.readFileSync('/root/apps/app2/src/envs/env.ts', { encoding: 'utf-8' })
    ).toEqual(`console.log("dev");`);
  });

  it('should undo the replacement of the files correctly', () => {
    // ARRANGE
    let undoFileReplacements;
    jest.spyOn(process, 'on').mockImplementation((event, undoFileFnCall) => {
      undoFileReplacements = undoFileFnCall;
      return process;
    });
    const fileReplacements = [
      {
        replace: './apps/demo/src/envs/env.ts',
        with: './apps/demo/src/envs/prod.env.ts',
      },
      {
        replace: './apps/app2/src/envs/env.ts',
        with: './apps/app2/src/envs/dev.env.ts',
      },
    ];
    performFileReplacements(fileReplacements, '/root');

    // ASSERT
    expect(
      fs.readFileSync('/root/apps/demo/src/envs/env.ts', { encoding: 'utf-8' })
    ).toEqual(`console.log("prod");`);
    expect(
      fs.readFileSync('/root/apps/app2/src/envs/env.ts', { encoding: 'utf-8' })
    ).toEqual(`console.log("dev");`);

    // ACT
    undoFileReplacements();

    // ASSERT
    expect(
      fs.readFileSync('/root/apps/demo/src/envs/env.ts', { encoding: 'utf-8' })
    ).toEqual(`console.log("env");`);
    expect(
      fs.readFileSync('/root/apps/demo/src/envs/prod.env.ts', {
        encoding: 'utf-8',
      })
    ).toEqual(`console.log("prod");`);
    expect(
      fs.readFileSync('/root/apps/app2/src/envs/env.ts', { encoding: 'utf-8' })
    ).toEqual(`console.log("env");`);
    expect(
      fs.readFileSync('/root/apps/app2/src/envs/dev.env.ts', {
        encoding: 'utf-8',
      })
    ).toEqual(`console.log("dev");`);
  });
});
