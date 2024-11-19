import {
  checkFilesExist,
  cleanupProject,
  createFile,
  ensureCypressInstallation,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from '../../utils';
import { join } from 'path';

describe('React Cypress Component Tests', () => {
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

  it('should successfully component test lib being used in app', () => {
    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${usedInAppLibName} --generate-tests`
    );
    if (runE2ETests()) {
      expect(runCLI(`component-test ${usedInAppLibName} --no-watch`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);

  it('should successfully component test lib being used in app using babel compiler', () => {
    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${usedInAppLibName} --generate-tests`
    );
    updateFile(`libs/${usedInAppLibName}/cypress.config.ts`, (content) => {
      // apply babel compiler
      return content.replace(
        'nxComponentTestingPreset(__filename)',
        'nxComponentTestingPreset(__filename, {compiler: "babel"})'
      );
    });
    if (runE2ETests()) {
      expect(runCLI(`component-test ${usedInAppLibName} --no-watch`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);

  it('should test buildable lib not being used in app', () => {
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
    }
  }, 300_000);

  it('should work with async webpack config', async () => {
    // TODO: (caleb) for whatever reason the MF webpack config + CT is running, but cypress is not starting up?
    // are they overriding some option on top of each other causing cypress to not see it's running?
    createFile(
      `apps/${appName}/webpack.config.js`,
      `
        const { composePlugins, withNx } = require('@nx/webpack');
        const { withReact } = require('@nx/react');

        module.exports = composePlugins(
          withNx(),
          withReact(),
          async function (configuration) {
            await new Promise((res) => {
              setTimeout(() => {
                console.log('I am from the custom async Webpack config');
                res();
              }, 1000);
            });
            return configuration;
          }
        );
      `
    );
    updateJson(join('apps', appName, 'project.json'), (config) => {
      config.targets[
        'build'
      ].options.webpackConfig = `apps/${appName}/webpack.config.js`;

      return config;
    });

    if (runE2ETests()) {
      const results = runCLI(`component-test ${appName}`);
      expect(results).toContain('I am from the custom async Webpack config');
      expect(results).toContain('All specs passed!');
    }
  });

  // flaky bc of upstream issue https://github.com/cypress-io/cypress/issues/25913
  it.skip('should CT vite projects importing other projects', () => {
    const viteLibName = uniq('vite-lib');
    runCLI(
      `generate @nx/react:lib ${viteLibName} --bundler=vite --no-interactive`
    );

    updateFile(`libs/${viteLibName}/src/lib/${viteLibName}.tsx`, () => {
      return `import { Btn } from '@${projectName}/${usedInAppLibName}';

export function MyComponent() {
  return (
    <>
      <Btn text={'I am the app'}/>
      <p>hello</p>
    </>
  );
}
export default MyComponent;`;
    });

    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${viteLibName} --generate-tests --bundler=vite --build-target=${appName}:build`
    );
    if (runE2ETests()) {
      expect(runCLI(`component-test ${viteLibName}`)).toContain(
        'All specs passed!'
      );
    }
  });
});
