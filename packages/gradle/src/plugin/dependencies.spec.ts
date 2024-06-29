import { join } from 'path';
import { processGradleDependencies } from './dependencies';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  validateDependency: jest.fn().mockReturnValue(true),
}));

describe('processGradleDependencies', () => {
  it('should process gradle dependencies with composite build', () => {
    const depFilePath = join(
      __dirname,
      '..',
      'utils/__mocks__/gradle-composite-dependencies.txt'
    );
    const dependencies = new Set([]);
    processGradleDependencies(
      depFilePath,
      new Map([
        [':my-utils:number-utils', 'number-utils'],
        [':my-utils:string-utils', 'string-utils'],
      ]),
      'app',
      'app',
      {} as any,
      dependencies
    );
    expect(Array.from(dependencies)).toEqual([
      {
        source: 'app',
        sourceFile: 'app',
        target: 'number-utils',
        type: 'static',
      },
      {
        source: 'app',
        sourceFile: 'app',
        target: 'string-utils',
        type: 'static',
      },
    ]);
  });

  it('should process gradle dependencies with regular build', () => {
    const depFilePath = join(
      __dirname,
      '..',
      'utils/__mocks__/gradle-dependencies.txt'
    );
    const dependencies = new Set([]);
    processGradleDependencies(
      depFilePath,
      new Map([
        [':my-utils:number-utils', 'number-utils'],
        [':my-utils:string-utils', 'string-utils'],
        [':utilities', 'utilities'],
      ]),
      'app',
      'app',
      {} as any,
      dependencies
    );
    expect(Array.from(dependencies)).toEqual([
      {
        source: 'app',
        sourceFile: 'app',
        target: 'utilities',
        type: 'static',
      },
    ]);
  });
});
