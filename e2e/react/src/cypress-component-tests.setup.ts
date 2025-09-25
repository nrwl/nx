import {
  cleanupProject,
  ensureCypressInstallation,
  newProject,
  runCLI,
  uniq,
  updateFile,
  updateJson,
  createFile,
} from '@nx/e2e-utils';

export let projectName: string;
export let appName: string;
export let usedInAppLibName: string;
export let buildableLibName: string;

export function registerReactCypressCTSetup() {
  beforeAll(async () => {
    process.env.NX_ADD_PLUGINS = 'false';
    projectName = newProject({
      name: uniq('cy-react'),
      packages: ['@nx/react'],
    });
    ensureCypressInstallation();

    appName = uniq('cy-react-app');
    usedInAppLibName = uniq('cy-react-lib');
    buildableLibName = uniq('cy-react-buildable-lib');

    runCLI(
      `generate @nx/react:app apps/${appName} --bundler=webpack --no-interactive`
    );

    updateJson('nx.json', (json) => ({
      ...json,
      generators: {
        ...json.generators,
        '@nx/react': {
          library: {
            unitTestRunner: 'jest',
          },
        },
      },
    }));

    runCLI(
      `generate @nx/react:component apps/${appName}/src/app/fancy-cmp/fancy-cmp --no-interactive`
    );
    runCLI(
      `generate @nx/react:lib libs/${usedInAppLibName} --no-interactive --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/react:component libs/${usedInAppLibName}/src/lib/btn/btn --export --no-interactive`
    );
    createFile(
      `apps/${appName}/src/assets/demo.svg`,
      `\n<svg version="1.1"\n     width="300" height="200"\n     xmlns="http://www.w3.org/2000/svg">\n  <rect width="100%" height="100%" fill="aliceblue" />\n  <circle cx="150" cy="100" r="80" fill="blue" />\n  <text x="150" y="125" font-size="60" text-anchor="middle" fill="white">nrwl</text>\n</svg>\n`
    );
    updateFile(
      `libs/${usedInAppLibName}/src/lib/btn/btn.tsx`,
      `\nimport styles from './btn.module.css';\n\nexport interface BtnProps {\n    text: string\n}\n\nexport function Btn(props: BtnProps) {\n  return (\n    <div className={styles['container']}>\n      <h1>Welcome to Btn!</h1>\n      <button className="text-green-500">{props.text}</button>\n    </div>\n  );\n}\n\nexport default Btn;\n`
    );
  });

  afterAll(() => {
    cleanupProject();
    delete process.env.NX_ADD_PLUGINS;
  });
}
