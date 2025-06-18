type MatrixDataProject = {
  name: string,
  codeowners: string,
  is_golden?: boolean, // true if this is a golden project, false otherwise
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

export type MatrixItem = {
  project: string,
  codeowners: string,
  node_version: number | string,
  package_manager: string,
  os: string,
  os_name: string,
  os_timeout: number,
  is_golden?: boolean,
};

// TODO: Extract Slack groups into named groups for easier maintenance
const matrixData: MatrixData = {
  coreProjects: [
    // { name: 'e2e-lerna-smoke-tests', codeowners: 'S04TNCVEETS', is_golden: true },
    // { name: 'e2e-js', codeowners: 'S04SJ6HHP0X', is_golden: true },
    // { name: 'e2e-nx-init', codeowners: 'S04SYHYKGNP', is_golden: true },
    // { name: 'e2e-nx', codeowners: 'S04SYHYKGNP', is_golden: true },
    // { name: 'e2e-release', codeowners: 'S04SYHYKGNP', is_golden: true },
    { name: 'e2e-workspace-create', codeowners: 'S04SYHYKGNP', is_golden: true },
  ],
  projects: [
    // { name: 'e2e-angular', codeowners: 'S04SS457V38' },
    // { name: 'e2e-cypress', codeowners: 'S04T16BTJJY' },
    // { name: 'e2e-detox', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-esbuild', codeowners: 'S04SJ6HHP0X' },
    // { name: 'e2e-expo', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-gradle', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-jest', codeowners: 'S04T16BTJJY' },
    // { name: 'e2e-eslint', codeowners: 'S04SYJGKSCT' },
    // { name: 'e2e-next', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-node', codeowners: 'S04SJ6HHP0X' },
    // { name: 'e2e-plugin', codeowners: 'S04SYHYKGNP' },
    // { name: 'e2e-react', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-react-native', codeowners: 'S04TNCNJG5N' },
    // { name: 'e2e-web', codeowners: 'S04SJ6PL98X' },
    // { name: 'e2e-rollup', codeowners: 'S04SJ6PL98X' },
    // { name: 'e2e-storybook', codeowners: 'S04SVQ8H0G5' },
    // { name: 'e2e-playwright', codeowners: 'S04SVQ8H0G5' },
    // { name: 'e2e-remix', codeowners: 'S04SVQ8H0G5' },
    // { name: 'e2e-rspack', codeowners: 'S04SJ6HHP0X' },
    // { name: 'e2e-vite', codeowners: 'S04SJ6PL98X' },
    // { name: 'e2e-vue', codeowners: 'S04SJ6PL98X' },
    // { name: 'e2e-nuxt', codeowners: 'S04SJ6PL98X' },
    // { name: 'e2e-webpack', codeowners: 'S04SJ6PL98X' }
  ],
  nodeTLS: 20,
  setup: [
    { os: 'ubuntu-latest', os_name: 'Linux', os_timeout: 60, package_managers: ['npm', 'pnpm', 'yarn'], node_versions: ['20.19.0', "22.12.0"], excluded: ['e2e-detox', 'e2e-react-native', 'e2e-expo'] },
    { os: 'macos-latest', os_name: 'MacOS', os_timeout: 90, package_managers: ['npm'], node_versions: ['20.19.0'] },
    // TODO (emily): Fix Windows support as gradle fails when running nx build https://staging.nx.app/runs/LgD4vxGn8w?utm_source=pull-request&utm_medium=comment
    // { os: 'windows-latest', os_name: 'WinOS', os_timeout: 180, package_managers: ['npm'], node_versions: ['20.19.0'], excluded: ['e2e-detox', 'e2e-react-native', 'e2e-expo'] }
  ]
};

const matrix: Array<MatrixItem> = [];

function addMatrixCombo(project: MatrixDataProject, nodeVersion: number | string, pm: number, os: number) {
  matrix.push({
    project: project.name,
    codeowners: project.codeowners,
    node_version: nodeVersion,
    package_manager: matrixData.setup[os].package_managers[pm],
    os: matrixData.setup[os].os,
    os_name: matrixData.setup[os].os_name,
    os_timeout: matrixData.setup[os].os_timeout,
    is_golden: !!project.is_golden, // Mark golden projects as true, others as false
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
