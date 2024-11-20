import {
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('NextJs Component Testing (Babel)', () => {
  beforeAll(() => {
    newProject({
      name: uniq('next-ct'),
      packages: ['@nx/next'],
    });
  });

  afterAll(() => cleanupProject());

  it('should test NextJs apps and libs', () => {
    const appName = uniq('next-app');
    const libName = uniq('next-lib');
    createAppWithCt(appName);
    createLibWithCt(libName, false);
    //  add babel compiler to app
    addBabelSupport(`apps/${appName}`);
    addBabelSupport(`libs/${libName}`);

    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${appName}`)).toContain(
        'All specs passed!'
      );
      expect(runCLI(`component-test ${libName}`)).toContain(
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
    `generate @nx/next:app apps/${appName} --no-interactive --appDir=false --src=false`
  );
  runCLI(
    `generate @nx/next:component apps/${appName}/components/button --no-interactive`
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
    `generate @nx/next:lib ${libName} --directory=libs/${libName} --buildable=${buildable} --no-interactive`
  );

  runCLI(
    `generate @nx/next:component libs/${libName}/src/lib/button --export --no-interactive`
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
