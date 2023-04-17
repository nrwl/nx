import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  ProjectGraph,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { updateConfigsJest29 } from './update-configs-jest-29';
import { libraryGenerator } from '@nx/js';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('Jest Migration - jest 29 update configs', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });
  afterAll(() => {
    jest.resetAllMocks();
  });
  it('should update jest.config.ts', async () => {
    await setup(tree, 'my-lib');

    await updateConfigsJest29(tree);

    const actualJestConfigTs = tree.read('libs/my-lib/jest.config.ts', 'utf-8');
    expect(actualJestConfigTs).toMatchSnapshot();
    const actualJestConfigJs = tree.read('libs/my-lib/jest.config.js', 'utf-8');
    expect(actualJestConfigJs).toMatchSnapshot();
  });

  it('should update root preset', async () => {
    await setup(tree, 'my-lib');
    await updateConfigsJest29(tree);

    const actualPreset = tree.read('jest.preset.js', 'utf-8');
    expect(actualPreset).toMatchSnapshot();
    const actualJestConfigTs = tree.read('libs/my-lib/jest.config.ts', 'utf-8');
    expect(actualJestConfigTs).toMatchSnapshot();
    const actualJestConfigJs = tree.read('libs/my-lib/jest.config.js', 'utf-8');
    expect(actualJestConfigJs).toMatchSnapshot();
  });

  it('should update root preset if ts-jest is preset', async () => {
    await setup(tree, 'my-lib');
    tree.write(
      'jest.preset.js',
      `const nxPreset = require('@nrwl/jest/preset').default;
module.exports = {
  ...nxPreset,
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  globals: {
    'ts-jest': {
        tsconfig: '<rootDir>/tsconfig.spec.json'
    },
    something: 'else',
    abc: [1234, true, {abc: 'yes'}]
  },
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest',
  },
  resolver: '@nrwl/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html'],
};
`
    );

    await updateConfigsJest29(tree);

    const actualPreset = tree.read('jest.preset.js', 'utf-8');
    expect(actualPreset).toMatchSnapshot();
  });

  it('should NOT update ts-jest with no globals are preset', async () => {
    await setup(tree, 'my-lib');
    tree.write(
      'jest.preset.js',
      `const nxPreset = require('@nrwl/jest/preset').default;
module.exports = {
  ...nxPreset,
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest',
  },
  resolver: '@nrwl/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html'],
};
`
    );

    await updateConfigsJest29(tree);

    const actualPreset = tree.read('jest.preset.js', 'utf-8');
    expect(actualPreset).toMatchSnapshot();
  });

  it('should add snapshot config with no root preset', async () => {
    await setup(tree, 'my-lib');

    tree.delete('jest.preset.js');

    await updateConfigsJest29(tree);

    const actualJestConfigTs = tree.read('libs/my-lib/jest.config.ts', 'utf-8');
    expect(actualJestConfigTs).toMatchSnapshot();
    const actualJestConfigJs = tree.read('libs/my-lib/jest.config.js', 'utf-8');
    expect(actualJestConfigJs).toMatchSnapshot();
  });

  it('should work with multiple projects + configs', async () => {
    await setup(tree, 'my-lib');
    await setup(tree, 'another-lib', projectGraph);
    await updateConfigsJest29(tree);

    const actualJestConfigTs1 = tree.read(
      'libs/my-lib/jest.config.ts',
      'utf-8'
    );
    expect(actualJestConfigTs1).toMatchSnapshot();
    const actualJestConfigJs1 = tree.read(
      'libs/my-lib/jest.config.js',
      'utf-8'
    );
    expect(actualJestConfigJs1).toMatchSnapshot();

    const actualJestConfigTs2 = tree.read(
      'libs/another-lib/jest.config.ts',
      'utf-8'
    );
    expect(actualJestConfigTs2).toMatchSnapshot();
    const actualJestConfigJs2 = tree.read(
      'libs/another-lib/jest.config.js',
      'utf-8'
    );
    expect(actualJestConfigJs2).toMatchSnapshot();
  });

  it('should update globalThis.ngJest.teardown to testEnvironmentOptions ', async () => {
    await setup(tree, 'jest-preset-angular');
    tree.write(
      `libs/jest-preset-angular/jest.config.ts`,
      `globalThis.ngJest = {
  teardown: true
}

export default {
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.(html|svg)$',
    }
  },
  transform: {
    '^.+.(ts|mjs|js|html)$': 'jest-preset-angular',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  displayName: 'jest',
  testEnvironment: 'node',
  preset: '../../jest.preset.js',
};`
    );
    tree.write(
      `libs/jest-preset-angular/jest.config.js`,
      `
globalThis.ngJest = {
  ngcc: true,
  teardown: false
}

module.exports = {
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.(html|svg)$',
    }
  },
  transform: {
    '^.+.(ts|mjs|js|html)$': 'jest-preset-angular',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  testEnvironmentOptions: {
   blah: 123,
  },
  displayName: 'jest',
  testEnvironment: 'node',
  preset: '../../jest.preset.js',
};`
    );
    await updateConfigsJest29(tree);
    const jpaJestConfigTs = tree.read(
      `libs/jest-preset-angular/jest.config.ts`,
      'utf-8'
    );
    expect(jpaJestConfigTs).toMatchSnapshot();
    const jpaJestConfigJs = tree.read(
      `libs/jest-preset-angular/jest.config.js`,
      'utf-8'
    );
    expect(jpaJestConfigJs).toMatchSnapshot();
  });

  it('should work with jest-preset-angular', async () => {
    await setup(tree, 'jest-preset-angular');
    tree.write(
      `libs/jest-preset-angular/jest.config.ts`,
      `export default {
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.(html|svg)$',
    }
  },
  transform: {
    '^.+.(ts|mjs|js|html)$': 'jest-preset-angular',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html']
  displayName: 'jest',
  testEnvironment: 'node',
  preset: '../../jest.preset.js',
};`
    );
    tree.write(
      `libs/jest-preset-angular/jest.config.js`,
      `module.exports = {
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.(html|svg)$',
    }
  },
  transform: {
    '^.+.(ts|mjs|js|html)$': 'jest-preset-angular',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html']
  displayName: 'jest',
  testEnvironment: 'node',
  preset: '../../jest.preset.js',
};`
    );
    await updateConfigsJest29(tree);
    const jpaJestConfigTs = tree.read(
      `libs/jest-preset-angular/jest.config.ts`,
      'utf-8'
    );
    expect(jpaJestConfigTs).toMatchSnapshot();
    const jpaJestConfigJs = tree.read(
      `libs/jest-preset-angular/jest.config.js`,
      'utf-8'
    );
    expect(jpaJestConfigJs).toMatchSnapshot();
  });

  it('should work if not using ts-jest transformer', async () => {
    await setup(tree, 'no-ts-jest');
    tree.write(
      `libs/no-ts-jest/jest.config.ts`,
      `export default {
  transform: {
    '^.+\\\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html']
  displayName: 'jest',
  testEnvironment: 'node',
  preset: '../../jest.preset.js',
};`
    );
    tree.write(
      `libs/no-ts-jest/jest.config.js`,
      `module.exports = {
  transform: {
    '^.+\\\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html']
  displayName: 'jest',
  testEnvironment: 'node',
  preset: '../../jest.preset.js',
};`
    );

    await updateConfigsJest29(tree);
    const noTsJestConfigTs = tree.read(
      `libs/no-ts-jest/jest.config.ts`,
      'utf-8'
    );
    expect(noTsJestConfigTs).toMatchSnapshot();
    const noTsJestConfigJs = tree.read(
      `libs/no-ts-jest/jest.config.js`,
      'utf-8'
    );
    expect(noTsJestConfigJs).toMatchSnapshot();
  });

  it('should work snapshotFormat is defined', async () => {
    await setup(tree, 'no-ts-jest');
    tree.write(
      `libs/no-ts-jest/jest.config.ts`,
      `export default {
  transform: {
    '^.+\\\\.[tj]sx?$': 'babel-jest',
  },
  globals: {
      'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.spec.json'
      },
      something: 'else',
      abc: [1234, true, {abc: 'yes'}]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html']
  displayName: 'jest',
  testEnvironment: 'node',
  preset: '../../jest.preset.js',
  snapshotFormat: {escapeString: false, printBasicPrototype: true}
};`
    );
    tree.write(
      `libs/no-ts-jest/jest.config.js`,
      `module.exports = {
  transform: {
    '^.+\\\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html']
  displayName: 'jest',
  testEnvironment: 'node',
  preset: '../../jest.preset.js',
  globals: {
      'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.spec.json'
      },
      something: 'else',
      abc: [1234, true, {abc: 'yes'}]
  },
  snapshotFormat: {escapeString: false, printBasicPrototype: true}
};`
    );

    await updateConfigsJest29(tree);
    const snapshotJestConfigTs = tree.read(
      'libs/no-ts-jest/jest.config.ts',
      'utf-8'
    );
    expect(snapshotJestConfigTs).toMatchSnapshot();
    const snapshotJestConfigJs = tree.read(
      `libs/no-ts-jest/jest.config.js`,
      'utf-8'
    );
    expect(snapshotJestConfigJs).toMatchSnapshot();
  });
  it('should be idempotent', async () => {
    await setup(tree, 'my-lib');

    await updateConfigsJest29(tree);

    const actualJestConfigTs1 = tree.read(
      'libs/my-lib/jest.config.ts',
      'utf-8'
    );
    expect(actualJestConfigTs1).toMatchSnapshot();
    const actualJestConfigJs1 = tree.read(
      'libs/my-lib/jest.config.js',
      'utf-8'
    );
    expect(actualJestConfigJs1).toMatchSnapshot();

    await updateConfigsJest29(tree);

    const actualJestConfigTs2 = tree.read(
      'libs/my-lib/jest.config.ts',
      'utf-8'
    );
    expect(actualJestConfigTs2).toEqual(actualJestConfigTs1);
    const actualJestConfigJs2 = tree.read(
      'libs/my-lib/jest.config.js',
      'utf-8'
    );
    expect(actualJestConfigJs2).toEqual(actualJestConfigJs1);
  });
});

async function setup(tree: Tree, name: string, existingGraph?: ProjectGraph) {
  await libraryGenerator(tree, {
    name,
  });
  const projectConfig = readProjectConfiguration(tree, name);
  projectConfig.targets['test'] = {
    ...projectConfig.targets['test'],
    executor: '@nrwl/jest:jest',
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
    `libs/${name}/jest.config.ts`,
    `/* eslint-disable */
export default {
  displayName: '${name}',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    }
  },
  transform: {
    '^.+\\\\.[tj]sx?$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/${name}'
};
`
  );

  tree.write(
    `libs/${name}/jest.config.js`,
    `module.exports = {
transform: {
  '^.+\\\\.[tj]sx?$': 'ts-jest'
},
// I am a comment and shouldn't be removed
moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
globals: {
    'ts-jest': {
        tsconfig: '<rootDir>/tsconfig.spec.json'
    },
    something: 'else',
    abc: [1234, true, {abc: 'yes'}]
  },
/**
 * Multi-line comment shouldn't be removed
 */
displayName: 'jest',
testEnvironment: 'node',
preset: '../../jest.preset.js'
};
`
  );

  tree.write(
    'jest.config.ts',
    tree
      .read('jest.config.ts')
      .toString()
      .replace(new RegExp('@nx/jest', 'g'), '@nrwl/jest')
  );

  tree.write(
    'jest.preset.js',
    tree
      .read('jest.preset.js')
      .toString()
      .replace(new RegExp('@nx/jest', 'g'), '@nrwl/jest')
  );

  projectGraph = {
    dependencies: {
      ...existingGraph?.dependencies,
    },
    nodes: {
      ...existingGraph?.nodes,
      [name]: {
        name,
        type: 'lib',
        data: projectConfig,
      } as any,
    },
  };
}
