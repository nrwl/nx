import {
  ProjectGraph,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import {
  generateTestApplication,
  generateTestLibrary,
} from '../../generators/utils/testing';
import { updateTestingTsconfigForJest } from './update-testing-tsconfig';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));
describe('Jest+Ng - 15.9.0 - tsconfig updates', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '');
  });

  it('should update tsconfig.spec.json with target es2016', async () => {
    await setup(tree, 'proj');
    await updateTestingTsconfigForJest(tree);
    expect(
      readJson(tree, 'proj/tsconfig.spec.json').compilerOptions.target
    ).toEqual('es2016');
    expect(
      readJson(tree, 'proj-lib/tsconfig.spec.json').compilerOptions.target
    ).toEqual('es2016');
  });

  it('should not change tsconfig.spec.json target if already set', async () => {
    await setup(tree, 'proj');
    updateJson(tree, 'proj/tsconfig.spec.json', (json) => {
      json.compilerOptions.target = 'es2015';
      return json;
    });
    await updateTestingTsconfigForJest(tree);
    expect(
      readJson(tree, 'proj/tsconfig.spec.json').compilerOptions.target
    ).toEqual('es2015');
    expect(
      readJson(tree, 'proj-lib/tsconfig.spec.json').compilerOptions.target
    ).toEqual('es2016');
  });

  it('should not change tsconfig.spec.json target if not jest-preset-angular', async () => {
    await setup(tree, 'proj');
    const updated = tree
      .read('proj/jest.config.ts', 'utf-8')
      .replace(/jest-preset-angular/g, '');
    tree.write('proj/jest.config.ts', updated);

    await updateTestingTsconfigForJest(tree);
    expect(
      readJson(tree, 'proj/tsconfig.spec.json').compilerOptions.target
    ).toBeUndefined();
    expect(
      readJson(tree, 'proj-lib/tsconfig.spec.json').compilerOptions.target
    ).toEqual('es2016');
  });
});

async function setup(tree: Tree, name: string) {
  await generateTestApplication(tree, {
    name,
    skipPackageJson: true,
  });

  const projectConfig = readProjectConfiguration(tree, name);
  updateProjectConfiguration(tree, name, {
    ...projectConfig,
    targets: {
      ...projectConfig.targets,
      test: {
        ...projectConfig.targets.test,
        executor: '@nrwl/jest:jest',
      },
    },
  });

  updateJson(tree, `${name}/tsconfig.spec.json`, (json) => {
    // revert to before jest-preset-angular v13
    delete json.compilerOptions.target;
    return json;
  });

  await generateTestLibrary(tree, {
    name: `${name}-lib`,
  });

  const libConfig = readProjectConfiguration(tree, `${name}-lib`);
  updateProjectConfiguration(tree, `${name}-lib`, {
    ...libConfig,
    targets: {
      ...libConfig.targets,
      test: {
        ...libConfig.targets.test,
        executor: '@nrwl/jest:jest',
      },
    },
  });

  updateJson(tree, `${name}/tsconfig.spec.json`, (json) => {
    // revert to before jest-preset-angular v13
    delete json.compilerOptions.target;
    return json;
  });
  projectGraph = {
    dependencies: {},
    nodes: {
      [name]: {
        name,
        type: 'app',
        data: readProjectConfiguration(tree, name),
      } as any,
      [`${name}-lib`]: {
        name: `${name}-lib`,
        type: 'lib',
        data: readProjectConfiguration(tree, `${name}-lib`),
      } as any,
    },
  };
}
