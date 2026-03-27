import {
  cleanupProject,
  createFile,
  newProject,
  packageInstall,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('NextJs Component Testing', () => {
  beforeAll(() => {
    newProject({
      name: uniq('next-ct'),
      packages: ['@nx/next'],
    });
  });

  afterAll(() => cleanupProject());

  // TODO(nicholas): this is erroring out due to useState error when serving the app in CI. It passes for me locally.
  xit('should test a NextJs app', () => {
    const appName = uniq('next-app');
    createAppWithCt(appName);
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
  });

  it('should test a NextJs buildable lib', async () => {
    const buildableLibName = uniq('next-buildable-lib');
    createLibWithCt(buildableLibName, true);
    if (runE2ETests()) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }
  });

  it('should test a NextJs server component that uses router', async () => {
    const lib = uniq('next-lib');
    createLibWithCtCypress(lib);
    if (runE2ETests()) {
      expect(runCLI(`component-test ${lib}`)).toContain('All specs passed!');
    }
  }, 600_000);
});

function addBabelSupport(path: string) {
  updateFile(`${path}/cypress.config.ts`, (content) => {
    // apply babel compiler
    return content.replace(
      'nxComponentTestingPreset(__filename)',
      'nxComponentTestingPreset(__filename, {compiler: "babel"})'
    );
  });

  // Install babel-plugin-istanbul needed for code coverage
  packageInstall('babel-plugin-istanbul', null, '7.0.0');

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

function createLibWithCtCypress(libName: string) {
  runCLI(`generate @nx/next:lib ${libName} --no-interactive`);

  runCLI(
    `generate @nx/next:cypress-component-configuration --project=${libName} --no-interactive`
  );

  updateFile(`${libName}/src/lib/hello-server.tsx`, () => {
    return `import { useRouter } from 'next/router';

    export function HelloServer() {
      useRouter();
    
      return <h1>Hello Server</h1>;
    }
    `;
  });
  // Add cypress component test
  createFile(
    `${libName}/src/lib/hello-server.cy.tsx`,
    `import * as Router from 'next/router';
    import { HelloServer } from './hello-server';
    
    describe('HelloServer', () => {
      context('stubbing out \`useRouter\` hook', () => {
        let router;
        beforeEach(() => {
          router = cy.stub();
      
          cy.stub(Router, 'useRouter').returns(router);
        });
      it('should work', () => {
        cy.mount(<HelloServer />);
      });
      });
    });
    
    `
  );
}
