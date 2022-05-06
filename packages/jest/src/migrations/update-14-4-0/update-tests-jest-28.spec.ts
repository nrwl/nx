import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator as workspaceLib } from '@nrwl/workspace';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from 'nx/src/generators/utils/project-configuration';
import {
  updateJestFnMocks,
  updateJestImports,
  updateJestTimers,
  updateTestsJest28,
} from './update-tests-jest-28';

describe('Jest Migration - jest 28 test files', () => {
  it('should convert test files', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await workspaceLib(tree, {
      name: 'blah',
      linter: undefined,
      unitTestRunner: 'jest',
    });

    await workspaceLib(tree, {
      name: 'blah-again',
      linter: undefined,
      unitTestRunner: 'jest',
      js: true,
    });

    tree.write(
      'libs/blah/src/lib/something/something.spec.ts',
      `
     import expect from 'expect'
     import { something } from './something'
     import { jest } from '@jest/globals'
     describe('my cool test', () => {
        it('should do something', () => {
          jest.useFakeTimers('modern')
          const mock = jest.fn<ReturnType<typeof something>, Parameters<typeof something>>();
          expect(something()).toBe(true)
        })
        it('should do something pt 2', () => {
          jest.useFakeTimers('legacy')
          const mock = jest.fn<boolean, MyType[]>();
          expect(something()).toBe(true)
        })
        it('should do something', () => {
          const mock = jest.fn<Promise<{}>, []>();
          expect(something()).toBe(true)
        })
     })`
    );

    tree.write(
      'libs/blah/src/lib/something/another.spec.ts',
      `
     import expect from 'expect'
     import { something } from './something'
     describe('my cool test', () => {
        it('should do something', () => {
          jest.useFakeTimers('modern')
          const mock = jest.fn<ReturnType<typeof something>, Parameters<typeof something>>();
          expect(something()).toBe(true)
        })
        it('should do something pt 2', () => {
          jest.useFakeTimers('legacy')
          const mock = jest.fn<boolean, MyType[]>();
          expect(something()).toBe(true)
        })
        it('should do something', () => {
          const mock = jest.fn<Promise<{}>, []>();
          expect(something()).toBe(true)
        })
     })`
    );
    const pc = readProjectConfiguration(tree, 'blah');
    pc.targets['test'].configurations = {
      production: {
        ...pc.targets['test'].options,
        ci: true,
      },
    };
    pc.targets['another-config'] = pc.targets['test'];
    updateProjectConfiguration(tree, 'blah', pc);

    updateTestsJest28(tree);

    expect(tree.read('libs/blah/src/lib/something/something.spec.ts', 'utf-8'))
      .toEqual(`
     import { expect } from 'expect'
     import { something } from './something'
     import { jest } from '@jest/globals'
     describe('my cool test', () => {
        it('should do something', () => {
          jest.useFakeTimers()
          const mock = jest.fn<typeof something>();
          expect(something()).toBe(true)
        })
        it('should do something pt 2', () => {
          jest.useFakeTimers({ legacyFakeTimers: true })
          const mock = jest.fn<() => boolean>();
          expect(something()).toBe(true)
        })
        it('should do something', () => {
          const mock = jest.fn<() => Promise<{}>>();
          expect(something()).toBe(true)
        })
     })`);
    expect(tree.read('libs/blah/src/lib/something/another.spec.ts', 'utf-8'))
      .toEqual(`
     import { expect } from 'expect'
     import { something } from './something'
     describe('my cool test', () => {
        it('should do something', () => {
          jest.useFakeTimers()
          const mock = jest.fn<ReturnType<typeof something>, Parameters<typeof something>>();
          expect(something()).toBe(true)
        })
        it('should do something pt 2', () => {
          jest.useFakeTimers({ legacyFakeTimers: true })
          const mock = jest.fn<boolean, MyType[]>();
          expect(something()).toBe(true)
        })
        it('should do something', () => {
          const mock = jest.fn<Promise<{}>, []>();
          expect(something()).toBe(true)
        })
     })`);
  });

  it('should update "expect" default import to named import', () => {
    // import expect from 'expect' => import { expect } from 'expect'
    // const expect = require('expect') => const { expect } = require('expect')
    const actual = updateJestImports(`
    import expect from 'expect'
    const expect = require('expect')
    import somethingExpected from 'my-expect'
    
    describe('something expected', () => {
      it('should do something', () => {
        const actual = somethingExpected('abc'); 
        expect(1 + 1).toBe(2);
      });
    })
    `);

    const expected = `
    import { expect } from 'expect'
    const { expect } = require('expect')
    import somethingExpected from 'my-expect'
    
    describe('something expected', () => {
      it('should do something', () => {
        const actual = somethingExpected('abc'); 
        expect(1 + 1).toBe(2);
      });
    })
    `;
    expect(actual).toEqual(expected);
  });

  it('should update jest.useFakeTimers() to new timer api', () => {
    const actual = updateJestTimers(
      `
    describe('some test', () => {
      it('should do something', () => {
        jest.useFakeTimers('modern')
      })

      it('should do something else', () => {
        jest.useFakeTimers('legacy')
      })
    })
    `,
      false
    );

    expect(actual).not.toContain("jest.useFakeTimers('modern')");
    expect(actual).not.toContain("jest.useFakeTimers('legacy')");
    expect(actual).toContain('jest.useFakeTimers()');
    expect(actual).toContain('jest.useFakeTimers({ legacyFakeTimers: true })');
  });

  it('should update jest timers to new timer api w/legacy timers set in config', () => {
    const actual = updateJestTimers(
      `
    describe('some test', () => {
      it('should do something', () => {
        jest.useFakeTimers('modern')
      })

      it('should do something else', () => {
        jest.useFakeTimers('legacy')
      })
    })
    `,
      true
    );
    // jest.useFakeTimers('modern') -> jest.useFakeTimers()
    // jest.useFakeTimers('legacy') -> jest.useFakeTimers({legacyFakeTimers: true})
    // if legacyFakeTimers is true in config, then
    // jest.useFakeTimers('modern') -> jest.useRealTimers({legacyFakeTimers: false})
    expect(actual).toEqual(`
    describe('some test', () => {
      it('should do something', () => {
        jest.useRealTimers({ legacyFakeTimers: false })
      })

      it('should do something else', () => {
        jest.useFakeTimers({ legacyFakeTimers: true })
      })
    })
    `);
  });

  it('should update jest.fn usage', () => {
    const actual = updateJestFnMocks(`
    import add from './add';
    describe('something', () => {
      it('should do something', () => {
        const noTypedMockAdd = jest.fn();
      })
      it('should do something', () => {
         const asyncMock = jest.fn<Promise<string>, []>()
      })
      it('should do something', () => {
        const mock = jest.fn<number, string[]>()
      })
      it('should do something', () => {
         const mockAdd = jest.fn<ReturnType<typeof add>, Parameters<typeof add>>();
      })
    })
    `);

    expect(actual).not.toContain(
      'jest.fn<ReturnType<typeof add>, Parameters<typeof add>>()'
    );
    expect(actual).toContain('jest.fn<typeof add>()');
    expect(actual).not.toContain('jest.fn<number, []>()');
    expect(actual).toContain('jest.fn<() => number>()');
    expect(actual).not.toContain('jest.fn<Promise<string>, []>()');
    expect(actual).toContain('jest.fn<() => Promise<string>>()');
  });

  it('should leave a TODO comment if it does not know how to upgrade', () => {
    const actual = updateJestFnMocks(`
    import add from './add';
    describe('something', () => {
      it('should do something', () => {
        const noTypedMockAdd = jest.fn<string, MyType>();
      })
    })
    `);

    expect(actual).toContain(
      '/** TODO: Update jest.fn<T>() type args for Jest v28 https://jestjs.io/docs/upgrading-to-jest28#jestfn */ jest.fn<string, MyType>();'
    );
  });

  it('should not touch already migrate jest.fn usage', () => {
    const original = `
    import add from './add';
    describe('something', () => {
      it('should do something', () => {
        const noTypedMockAdd = jest.fn();
      })
      it('should do something', () => {
         const asyncMock = jest.fn<() => number>>()
      })
      it('should do something', () => {
        const mock = jest.fn<() => Promise<string>>()
      })
      it('should do something', () => {
         const mockAdd = jest.fn<typeof add>();
      })
    })
    `;
    const actual = updateJestFnMocks(original);

    expect(actual).toEqual(original);
    expect(actual).not.toContain(
      '/** TODO: Update jest.fn() types for Jest v28 https://jestjs.io/docs/upgrading-to-jest28#jestfn'
    );
  });
});
