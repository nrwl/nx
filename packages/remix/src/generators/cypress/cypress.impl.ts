import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { configurationGenerator } from '@nx/cypress';
import { CypressGeneratorSchema } from './schema';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { nxVersion } from '../../utils/versions';

export default async function (
  tree: Tree,
  options: CypressGeneratorSchema
): Promise<GeneratorCallback> {
  const { projectName: e2eProjectName, projectRoot: e2eProjectRoot } =
    await determineProjectNameAndRootOptions(tree, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
      projectNameAndRootFormat: options.projectNameAndRootFormat,
      callingGenerator: '@nx/remix:cypress',
    });
  const rootProject = e2eProjectRoot === '.';
  let projectConfig = readProjectConfiguration(tree, options.project);
  options.baseUrl ??= `http://localhost:${projectConfig.targets['serve'].options.port}`;

  addFileServerTarget(tree, options, 'serve-static');
  addProjectConfiguration(tree, e2eProjectName, {
    projectType: 'application',
    root: e2eProjectRoot,
    sourceRoot: joinPathFragments(e2eProjectRoot, 'src'),
    targets: {},
    tags: [],
    implicitDependencies: [options.name],
  });
  const installTask = await configurationGenerator(tree, {
    project: e2eProjectName,
    directory: 'src',
    linter: options.linter,
    skipPackageJson: false,
    skipFormat: true,
    devServerTarget: `${options.project}:serve:development`,
    baseUrl: options.baseUrl,
    rootProject,
  });

  projectConfig = readProjectConfiguration(tree, e2eProjectName);

  tree.delete(
    joinPathFragments(projectConfig.sourceRoot, 'support', 'app.po.ts')
  );
  tree.write(
    joinPathFragments(projectConfig.sourceRoot, 'e2e', 'app.cy.ts'),
    `describe('webapp', () => {
  beforeEach(() => cy.visit('/'));

  it('should display welcome message', () => {
    cy.get('h1').contains('Welcome to Remix');
  });
});`
  );

  const supportFilePath = joinPathFragments(
    projectConfig.sourceRoot,
    'support',
    'e2e.ts'
  );
  const supportContent = tree.read(supportFilePath, 'utf-8');

  tree.write(
    supportFilePath,
    `${supportContent}

// from https://github.com/remix-run/indie-stack
Cypress.on("uncaught:exception", (err) => {
  // Cypress and React Hydrating the document don't get along
  // for some unknown reason. Hopefully we figure out why eventually
  // so we can remove this.
  if (
    /hydrat/i.test(err.message) ||
    /Minified React error #418/.test(err.message) ||
    /Minified React error #423/.test(err.message)
  ) {
    return false;
  }
});`
  );

  return runTasksInSerial(installTask);
}

function addFileServerTarget(
  tree: Tree,
  options: CypressGeneratorSchema,
  targetName: string
) {
  addDependenciesToPackageJson(tree, {}, { '@nx/web': nxVersion });

  const projectConfig = readProjectConfiguration(tree, options.project);
  projectConfig.targets[targetName] = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.project}:build`,
      port: projectConfig.targets['serve'].options.port,
    },
  };
  updateProjectConfiguration(tree, options.project, projectConfig);
}
