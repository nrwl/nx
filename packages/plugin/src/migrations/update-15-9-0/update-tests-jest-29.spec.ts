import {
  ProjectGraph,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { libraryGenerator } from '@nx/js';
import { updateTestsJest29 } from './jest-29-tests';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));
describe('Nx Plugin Migration - jest 29 mocked usage in tests', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should not update anything if there are no tests', async () => {
    await setup(tree, 'my-lib');
    const expected = tree.read('libs/my-lib/src/lib/my-lib.spec.ts', 'utf-8');
    await updateTestsJest29(tree);
    expect(
      tree.read('libs/my-lib/src/file-one.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/my-lib/src/file-two.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('libs/my-lib/src/lib/my-lib.spec.ts', 'utf-8')).toEqual(
      expected
    );
  });
  it('should be idempotent', async () => {
    await setup(tree, 'my-lib');

    const expected = tree.read('libs/my-lib/src/lib/my-lib.spec.ts', 'utf-8');

    await updateTestsJest29(tree);

    expect(
      tree.read('libs/my-lib/src/file-one.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/my-lib/src/file-two.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('libs/my-lib/src/lib/my-lib.spec.ts', 'utf-8')).toEqual(
      expected
    );

    await updateTestsJest29(tree);

    expect(
      tree.read('libs/my-lib/src/file-one.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/my-lib/src/file-two.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('libs/my-lib/src/lib/my-lib.spec.ts', 'utf-8')).toEqual(
      expected
    );
  });
});

async function setup(tree: Tree, name: string) {
  await libraryGenerator(tree, {
    name,
  });
  const projectConfig = readProjectConfiguration(tree, name);
  projectConfig.targets['test'] = {
    ...projectConfig.targets['test'],
    configurations: {
      ci: {
        ci: true,
      },
      other: {
        jestConfig: `libs/${name}/jest.config.js`,
      },
    },
  };

  updateProjectConfiguration(tree, name, projectConfig);

  tree.write(
    `libs/${name}/jest.config.js`,
    `module.exports = {
transform: {
  '^.+\\\\.[tj]sx?$': 'ts-jest'
},
moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
globals: {
    'ts-jest': {
        tsconfig: '<rootDir>/tsconfig.spec.json'
    }
  },
displayName: 'jest',
testEnvironment: 'node',
preset: '../../jest.preset.js'
};

`
  );
  tree.write(
    `libs/${name}/src/file-one.spec.ts`,
    `
import{ MaybeMockedDeep, MaybeMocked } from 'jest-mock';
import {expect, jest, test} from '@jest/globals';
import {song} from './song';

jest.mock('./song');
jest.spyOn(console, 'log');

const mockedSong = jest.mocked(song, true);
// or through \`jest.Mocked<Source>\`
// const mockedSong = song as jest.Mocked<typeof song>;

test('deep method is typed correctly', () => {
  mockedSong.one.more.time.mockReturnValue(12);

  expect(mockedSong.one.more.time(10)).toBe(12);
  expect(mockedSong.one.more.time.mock.calls).toHaveLength(1);
});

test('direct usage', () => {
  jest.mocked(console.log).mockImplementation(() => {
    return;
  });

  console.log('one more time');

  expect(jest.mocked(console.log, false).mock.calls).toHaveLength(1);
});
  `
  );
  tree.write(
    `libs/${name}/src/file-two.spec.ts`,
    `
const { MaybeMockedDeep, MaybeMocked } = require('jest-mock');
const {expect, jest, test} = require('@jest/globals');
const {song} = require('./song');

jest.mock('./song');
jest.spyOn(console, 'log');

const mockedSong = jest.mocked(song, true);
// or through \`jest.Mocked<Source>\`
// const mockedSong = song as jest.Mocked<typeof song>;

test('deep method is typed correctly', () => {
  mockedSong.one.more.time.mockReturnValue(12);

  expect(mockedSong.one.more.time(10)).toBe(12);
  expect(mockedSong.one.more.time.mock.calls).toHaveLength(1);
});

test('direct usage', () => {
  jest.mocked(console.log).mockImplementation(() => {
    return;
  });

  console.log('one more time');

  expect(jest.mocked(console.log, false).mock.calls).toHaveLength(1);
});
`
  );
  projectGraph = {
    dependencies: {},
    nodes: {
      [name]: {
        name,
        type: 'lib',
        data: projectConfig,
      } as any,
    },
  };
}
