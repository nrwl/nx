type MatrixDataProject = {
  name: string,
  codeowners: string,
  directory: string, // The actual directory name without e2e- prefix
};

type MatrixDataOS = {
  os: string, // GH runner machine name: e.g. ubuntu-latest
  os_name: string, // short name that will be printed in the report and on the action
  os_timeout: number, // 60
  package_managers: string[], // package managers to run on this OS
  node_versions: Array<number | string>, // node versions to run on this OS
  excluded?: string[], // projects to exclude from running on this OS
};

type MatrixData = {
  coreProjects: MatrixDataProject[],
  projects: MatrixDataProject[],
  nodeTLS: number,
  setup: MatrixDataOS[],
}

// TODO: Extract Slack groups into named groups for easier maintenance
const matrixData: MatrixData = {
  coreProjects: [
    { name: 'e2e-lerna-smoke-tests', directory: 'lerna-smoke-tests', codeowners: 'S04TNCVEETS' },
    { name: 'e2e-js', directory: 'js', codeowners: 'S04SJ6HHP0X' },
    // { name: 'e2e-nx-init', directory: 'nx-init', codeowners: 'S04SYHYKGNP' },
    // { name: 'e2e-nx', directory: 'nx', codeowners: 'S04SYHYKGNP' },
    // { name: 'e2e-release', directory: 'release', codeowners: 'S04SYHYKGNP' },
    // { name: 'e2e-workspace-create', directory: 'workspace-create', codeowners: 'S04SYHYKGNP' }
  ],
  projects: [
    // { name: 'e2e-angular', directory: 'angular', codeowners: 'S04SS457V38' },
    // { name: 'e2e-cypress', directory: 'cypress', codeowners: 'S04T16BTJJY' },
    // { name: 'e2e-detox', directory: 'detox', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-esbuild', directory: 'esbuild', codeowners: 'S04SJ6HHP0X' },
    // { name: 'e2e-expo', directory: 'expo', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-gradle', directory: 'gradle', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-jest', directory: 'jest', codeowners: 'S04T16BTJJY' },
    // { name: 'e2e-eslint', directory: 'eslint', codeowners: 'S04SYJGKSCT' },
    // { name: 'e2e-next', directory: 'next', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-node', directory: 'node', codeowners: 'S04SJ6HHP0X' },
    // { name: 'e2e-plugin', directory: 'plugin', codeowners: 'S04SYHYKGNP' },
    // { name: 'e2e-react', directory: 'react', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-react-native', directory: 'react-native', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-web', directory: 'web', codeowners: 'S04SJ6PL98X' },
    // { name: 'e2e-rollup', directory: 'rollup', codeowners: 'S04SJ6PL98X' },
    // { name: 'e2e-storybook', directory: 'storybook', codeowners: 'S04SVQ8H0G5' },
    // { name: 'e2e-playwright', directory: 'playwright', codeowners: 'S04SVQ8H0G5' },
    // { name: 'e2e-remix', directory: 'remix', codeowners: 'S04SVQ8H0G5' },
    // { name: 'e2e-rspack', directory: 'rspack', codeowners: 'S04SJ6HHP0X' },
    // { name: 'e2e-vite', directory: 'vite', codeowners: 'S04SJ6PL98X' },
    // { name: 'e2e-vue', directory: 'vue', codeowners: 'S04SJ6PL98X' },
    // { name: 'e2e-nuxt', directory: 'nuxt', codeowners: 'S04SJ6PL98X' },
    // { name: 'e2e-webpack', directory: 'webpack', codeowners: 'S04SJ6PL98X' }
  ],
  nodeTLS: 20,
  setup: [
    { os: 'ubuntu-latest', os_name: 'Linux', os_timeout: 100, package_managers: ['npm', 'pnpm', 'yarn'], node_versions: ['20.19.0', "22.12.0"], excluded: ['e2e-detox', 'e2e-react-native', 'e2e-expo'] },
    { os: 'macos-latest', os_name: 'MacOS', os_timeout: 120, package_managers: ['npm'], node_versions: ['20.19.0'] },
    // { os: 'windows-latest', os_name: 'WinOS', os_timeout: 180, package_managers: ['npm'], node_versions: ['20.19.0'], excluded: ['e2e-detox', 'e2e-react-native', 'e2e-expo', 'e2e-gradle'] }
  ]
};

const matrix: Array<{
  project: string,
  directory: string,
  codeowners: string,
  node_version: number | string,
  package_manager: string,
  os: string,
  os_name: string,
  os_timeout: number
}> = [];

function addMatrixCombo(project: MatrixDataProject, nodeVersion: number | string, pm: number, os: number) {
  matrix.push({
    project: project.name,
    directory: project.directory,
    codeowners: project.codeowners,
    node_version: nodeVersion,
    package_manager: matrixData.setup[os].package_managers[pm],
    os: matrixData.setup[os].os,
    os_name: matrixData.setup[os].os_name,
    os_timeout: matrixData.setup[os].os_timeout,
  });
}

function processProject(project: MatrixDataProject, nodeVersion?: number) {
  for (let os = 0; os < matrixData.setup.length; os++) {
    for (let pm = 0; pm < matrixData.setup[os].package_managers.length; pm++) {
      if (!matrixData.setup[os].excluded || !matrixData.setup[os].excluded?.includes(project.name)) {
        if (nodeVersion) {
          addMatrixCombo(project, nodeVersion, pm, os);
        } else {
          for (let n = 0; n < matrixData.setup[os].node_versions.length; n++) {
            addMatrixCombo(project, matrixData.setup[os].node_versions[n], pm, os);
          }
        }
      }
    }
  }
}

// process core projects
for (let p = 0; p < matrixData.coreProjects.length; p++) {
  processProject(matrixData.coreProjects[p]);
}
// process other projects
for (let p = 0; p < matrixData.projects.length; p++) {
  processProject(matrixData.projects[p], matrixData.nodeTLS);
}

if (matrix.length > 256) {
  throw new Error('You have exceeded the size of the matrix. GitHub allows only 256 jobs in a matrix. Found ${matrix.length} jobs.');
}

// print result to stdout for pipeline to consume
process.stdout.write(JSON.stringify({ include: matrix }, null, 0));
