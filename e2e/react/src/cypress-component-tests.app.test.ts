import {
  checkFilesExist,
  cleanupProject,
  ensureCypressInstallation,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
  createFile,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('React Cypress Component Tests - app', () => {
  let projectName;
  const appName = uniq('cy-react-app');
  const usedInAppLibName = uniq('cy-react-lib');
  const buildableLibName = uniq('cy-react-buildable-lib');

  beforeAll(async () => {
    process.env.NX_ADD_PLUGINS = 'false';
    projectName = newProject({
      name: uniq('cy-react'),
      packages: ['@nx/react'],
    });
    ensureCypressInstallation();

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
    updateFile(
      `apps/${appName}/src/app/app.tsx`,
      `\nimport styles from './app.module.css';\nimport logo from '../assets/demo.svg';\nimport { Btn } from '@${projectName}/${usedInAppLibName}';\n\nexport function App() {\n  return (\n    <>\n      <Btn  text={'I am the app'}/>\n      <img src={logo} alt="logo" />\n    </>\n  );\n}\n\nexport default App;`
    );
  });

  afterAll(() => {
    cleanupProject();
    delete process.env.NX_ADD_PLUGINS;
  });

  it('should test app', () => {
    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${appName} --generate-tests`
    );
    if (runE2ETests()) {
      expect(runCLI(`component-test ${appName} --no-watch`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});


