import {
  Tree,
  formatFiles,
  getProjects,
  updateJson,
  offsetFromRoot,
  ProjectConfiguration,
  logger,
  stripIndents,
} from '@nrwl/devkit';

/**
 * Add support to display svg in react native:
 * - Add react-native-svg-transform and react-native-svg packages to workspace's package.json.
 * - Add typing to app's tsconfig.json.
 * - Add react-native-svg to app's package.json.
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  projects.forEach((project) => {
    if (project.targets?.start?.executor !== '@nrwl/react-native:start') return;

    addReactNativeSvgToAppPackageJson(tree, project);
    addReactNativeSvgToTsconfig(tree, project);
    mockSvgInJestConfig(tree, project);
  });

  await formatFiles(tree);
}

function addReactNativeSvgToAppPackageJson(
  host: Tree,
  project: ProjectConfiguration
) {
  const packageJSonPath = `${project.root}/package.json`;
  if (!host.exists(packageJSonPath)) return;
  updateJson(host, packageJSonPath, (json) => {
    const dependencies = json.dependencies || {};
    dependencies['react-native-svg'] = '*';
    return json;
  });
}

function addReactNativeSvgToTsconfig(
  host: Tree,
  project: ProjectConfiguration
) {
  const tsconfigPath = `${project.root}/tsconfig.json`;
  if (!host.exists(tsconfigPath)) return;
  const offset = offsetFromRoot(project.root);
  updateJson(host, tsconfigPath, (json) => {
    const files = json.files || [];
    files.push(`${offset}node_modules/@nrwl/react/typings/image.d.ts`);
    json.files = files;
    return json;
  });
}

function mockSvgInJestConfig(host: Tree, project: ProjectConfiguration) {
  const jestConfigPath = project.targets?.test?.options?.jestConfig;
  if (!jestConfigPath || !host.exists(jestConfigPath)) return;
  try {
    const contents = host.read(jestConfigPath, 'utf-8');
    if (contents.includes('moduleNameMapper')) return;
    host.write(
      jestConfigPath,
      contents.replace(
        /,([^,]*)$/,
        `, moduleNameMapper: {'\\.svg': '@nrwl/react-native/plugins/jest/svg-mock'}, $1`
      )
    );
  } catch {
    logger.error(
      stripIndents`Unable to update ${jestConfigPath} for project ${project.root}.`
    );
  }
}
