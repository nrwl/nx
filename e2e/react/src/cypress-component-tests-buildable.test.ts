import {
  checkFilesExist,
  cleanupProject,
  createFile,
  ensureCypressInstallation,
  killPort,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('React Cypress Component Tests - buildable lib', () => {
  let projectName;
  let appName;
  const usedInAppLibName = uniq('cy-react-lib');
  const buildableLibName = uniq('cy-react-buildable-lib');

  beforeAll(async () => {
    process.env.NX_ADD_PLUGINS = 'false';
    const appNameTemp = uniq('cy-react-app');
    appName = appNameTemp;

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
    // makes sure custom webpack is loading
    createFile(
      `apps/${appName}/src/assets/demo.svg`,
      `
<svg version="1.1"
     width="300" height="200"
     xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="aliceblue" />
  <circle cx="150" cy="100" r="80" fill="blue" />
  <text x="150" y="125" font-size="60" text-anchor="middle" fill="white">nrwl</text>
</svg>
`
    );
    updateFile(
      `libs/${usedInAppLibName}/src/lib/btn/btn.tsx`,
      `
import styles from './btn.module.css';

/* eslint-disable-next-line */
export interface BtnProps {
    text: string
}

export function Btn(props: BtnProps) {
  return (
    <div className={styles['container']}>
      <h1>Welcome to Btn!</h1>
      <button className="text-green-500">{props.text}</button>
    </div>
  );
}

export default Btn;
`
    );

    updateFile(
      `apps/${appName}/src/app/app.tsx`,
      `
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import styles from './app.module.css';
import logo from '../assets/demo.svg';
import { Btn } from '@${projectName}/${usedInAppLibName}';

export function App() {
  return (
    <>
      <Btn  text={'I am the app'}/>
      <img src={logo} alt="logo" />
    </>
  );
}

export default App;`
    );

    runCLI(
      `generate @nx/react:lib libs/${buildableLibName} --buildable --no-interactive --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/react:component libs/${buildableLibName}/src/lib/input/input --export --no-interactive`
    );

    checkFilesExist(`libs/${buildableLibName}/src/lib/input/input.tsx`);
    updateFile(
      `libs/${buildableLibName}/src/lib/input/input.tsx`,
      `
    import styles from './input.module.css';

/* eslint-disable-next-line */
export interface InputProps {
    readOnly: boolean
}

export function Input(props: InputProps) {
  return (
      <label className="text-green-500">Email:
        <input className="border-blue-500" type="email" readOnly={props.readOnly}/>
      </label>
  );
}

export default Input;
`
    );
    createFile('libs/assets/data.json', JSON.stringify({ data: 'data' }));
    updateJson(join('apps', appName, 'project.json'), (config) => {
      config.targets['build'].options.assets.push({
        glob: '**/*',
        input: 'libs/assets',
        output: 'assets',
      });
      return config;
    });
  });

  afterAll(() => {
    cleanupProject();
    delete process.env.NX_ADD_PLUGINS;
  });

  it('should test buildable lib not being used in app', async () => {
    createFile(
      `libs/${buildableLibName}/src/lib/input/input.cy.tsx`,
      `
import * as React from 'react'
import Input from './input'


describe(Input.name, () => {
  it('renders', () => {
    cy.mount(<Input readOnly={false} />)
    cy.get('label').should('have.css', 'color', 'rgb(0, 0, 0)');
  })
  it('should be read only', () => {
    cy.mount(<Input readOnly={true}/>)
    cy.get('input').should('have.attr', 'readonly');
  })
});
`
    );

    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${buildableLibName} --generate-tests --build-target=${appName}:build`
    );

    if (runE2ETests()) {
      expect(runCLI(`component-test ${buildableLibName} --no-watch`)).toContain(
        'All specs passed!'
      );
      // Kill the dev server port to prevent EADDRINUSE errors
      await killPort(8080);
    }

    // add tailwind
    runCLI(`generate @nx/react:setup-tailwind --project=${buildableLibName}`);
    updateFile(
      `libs/${buildableLibName}/src/styles.css`,
      `
@tailwind components;
@tailwind base;
@tailwind utilities;
`
    );
    updateFile(
      `libs/${buildableLibName}/src/lib/input/input.cy.tsx`,
      (content) => {
        // text-green-500 should now apply
        return content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)');
      }
    );
    updateFile(
      `libs/${buildableLibName}/src/lib/input/input.tsx`,
      (content) => {
        return `import '../../styles.css';
${content}`;
      }
    );

    if (runE2ETests()) {
      expect(runCLI(`component-test ${buildableLibName} --no-watch`)).toContain(
        'All specs passed!'
      );
      // Kill the dev server port to clean up
      await killPort(8080);
    }
  }, 300_000);
});
