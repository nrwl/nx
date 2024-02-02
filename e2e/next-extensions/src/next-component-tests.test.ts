import {
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('NextJs Component Testing', () => {
  beforeAll(() => {
    newProject({
      name: uniq('next-ct'),
      packages: ['@nx/next'],
    });
  });

  afterAll(() => cleanupProject());

  it('should test a NextJs app', () => {
    const appName = uniq('next-app');
    createAppWithCt(appName);
    if (runE2ETests()) {
      expect(runCLI(`component-test ${appName}`)).toContain(
        'All specs passed!'
      );
    }
    addTailwindToApp(appName);
    if (runE2ETests()) {
      expect(runCLI(`component-test ${appName}`)).toContain(
        'All specs passed!'
      );
    }
  });

  it('should test a NextJs app using babel compiler', () => {
    const appName = uniq('next-app');
    createAppWithCt(appName);
    //  add bable compiler to app
    addBabelSupport(`apps/${appName}`);
    if (runE2ETests()) {
      expect(runCLI(`component-test ${appName}`)).toContain(
        'All specs passed!'
      );
    }
  });

  it('should test a NextJs lib using babel compiler', async () => {
    const libName = uniq('next-lib');
    createLibWithCt(libName, false);
    //  add bable compiler to lib
    addBabelSupport(`libs/${libName}`);
    if (runE2ETests()) {
      expect(runCLI(`component-test ${libName}`)).toContain(
        'All specs passed!'
      );
    }
  });

  it('should test a NextJs lib', async () => {
    const libName = uniq('next-lib');
    createLibWithCt(libName, false);
    if (runE2ETests()) {
      expect(runCLI(`component-test ${libName}`)).toContain(
        'All specs passed!'
      );
    }
    addTailwindToLib(libName);
    if (runE2ETests()) {
      expect(runCLI(`component-test ${libName}`)).toContain(
        'All specs passed!'
      );
    }
  });

  it('should test a NextJs buildable lib', async () => {
    const buildableLibName = uniq('next-buildable-lib');
    createLibWithCt(buildableLibName, true);
    if (runE2ETests()) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }

    addTailwindToLib(buildableLibName);
    if (runE2ETests()) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }
  });
});

function addBabelSupport(path: string) {
  updateFile(`${path}/cypress.config.ts`, (content) => {
    // apply babel compiler
    return content.replace(
      'nxComponentTestingPreset(__filename)',
      'nxComponentTestingPreset(__filename, {compiler: "babel"})'
    );
  });

  //  added needed .babelrc file with defaults
  createFile(
    `${path}/.babelrc`,
    JSON.stringify({ presets: ['next/babel'], plugins: ['istanbul'] })
  );
}

function createAppWithCt(appName: string) {
  runCLI(
    `generate @nx/next:app ${appName} --no-interactive --appDir=false --src=false`
  );
  runCLI(
    `generate @nx/next:component button --project=${appName} --directory=components --flat --no-interactive`
  );
  createFile(
    `apps/${appName}/public/data.json`,
    JSON.stringify({ message: 'loaded from app data.json' })
  );

  updateFile(`apps/${appName}/components/button.tsx`, (content) => {
    return `import { useEffect, useState } from 'react';

export interface ButtonProps {
  text: string;
}

const data = fetch('/data.json').then((r) => r.json());
export default function Button(props: ButtonProps) {
  const [state, setState] = useState<Record<string, any>>();
  useEffect(() => {
    data.then(setState);
  }, []);
  return (
    <>
      {state && <pre>{JSON.stringify(state, null, 2)}</pre>}
      <p className="text-blue-600">Button</p>
      <button className="text-white bg-black p-4">{props.text}</button>
    </>
  );
}
`;
  });

  runCLI(
    `generate @nx/next:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`
  );
}

function addTailwindToApp(appName: string) {
  runCLI(
    `generate @nx/react:setup-tailwind --project=${appName} --no-interactive`
  );
  updateFile(`apps/${appName}/cypress/support/component.ts`, (content) => {
    return `${content}
import '../../pages/styles.css'`;
  });

  updateFile(`apps/${appName}/components/button.cy.tsx`, (content) => {
    return `import * as React from 'react';
import Button from './button';

describe(Button.name, () => {
  it('renders', () => {
    cy.mount(<Button text={'test'} />);
  });

  it('should apply tailwind', () => {
    cy.mount(<Button text={'tailwind'} />);
    // should have tailwind styles
    cy.get('p').should('have.css', 'color', 'rgb(37, 99, 235)');
  });
});
`;
  });
}

function createLibWithCt(libName: string, buildable: boolean) {
  runCLI(
    `generate @nx/next:lib ${libName} --buildable=${buildable} --no-interactive`
  );

  runCLI(
    `generate @nx/next:component button --project=${libName} --flat --export --no-interactive`
  );
  updateFile(`libs/${libName}/src/lib/button.tsx`, (content) => {
    return `import { useEffect, useState } from 'react';
export interface ButtonProps {
text: string
}

export function Button(props: ButtonProps) {
return <button className="text-white bg-black p-4">{props.text}</button>
}

export default Button;
`;
  });

  runCLI(
    `generate @nx/next:cypress-component-configuration --project=${libName} --generate-tests --no-interactive`
  );
}
function addTailwindToLib(libName: string) {
  createFile(`libs/${libName}/src/lib/styles.css`, ``);
  runCLI(
    `generate @nx/react:setup-tailwind --project=${libName} --no-interactive`
  );
  updateFile(`libs/${libName}/src/lib/button.cy.tsx`, (content) => {
    return `import * as React from 'react';
import Button from './button';

describe(Button.name, () => {
  it('renders', () => {
    cy.mount(<Button text={'test'} />);
  });

  it('should apply tailwind', () => {
    cy.mount(<Button text={'tailwind'} />);
    // should have tailwind styles
    cy.get('button').should('have.css', 'color', 'rgb(255, 255, 255)');
  });
});
`;
  });
  updateFile(`libs/${libName}/cypress/support/styles.ct.css`, (content) => {
    return `${content}
@tailwind base;
@tailwind components;
@tailwind utilities;
`;
  });
}
