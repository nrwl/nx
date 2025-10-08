import {
  getAvailablePort,
  killProcessAndPorts,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from "@nx/e2e-utils";
import { stripIndents } from "nx/src/utils/strip-indents";
import { readPort, runCLI } from "./utils";
import {
  setupIndependentDeployabilityTest,
  cleanupIndependentDeployabilityTest,
} from "./independent-deployability-setup";

describe("Independent Deployability", () => {
  let proj: string;
  beforeAll(() => {
    proj = setupIndependentDeployabilityTest();
  });

  afterAll(() => {
    cleanupIndependentDeployabilityTest();
  });

  it("should support different versions workspace libs for host and remote", async () => {
    const shell = uniq("shell");
    const remote = uniq("remote");
    const lib = uniq("lib");

    const shellPort = await getAvailablePort();

    runCLI(
      `generate @nx/react:host ${shell} --remotes=${remote} --devServerPort=${shellPort} --bundler=webpack --e2eTestRunner=cypress --no-interactive --skipFormat`
    );

    runCLI(
      `generate @nx/js:lib ${lib} --importPath=@acme/${lib} --publishable=true --no-interactive --skipFormat`
    );

    const remotePort = readPort(remote);

    updateFile(
      `${lib}/src/lib/${lib}.ts`,
      stripIndents`
      export const version = '0.0.1';
      `
    );

    updateJson(`${lib}/package.json`, (json) => {
      return {
        ...json,
        version: "0.0.1",
      };
    });

    // Update host to use the lib
    updateFile(
      `${shell}/src/app/app.tsx`,
      `
    import * as React from 'react';

    import NxWelcome from './nx-welcome';
    import { version } from '@acme/${lib}';
    import { Link, Route, Routes } from 'react-router-dom';

    const About = React.lazy(() => import('${remote}/Module'));

    export function App() {
      return (
        <React.Suspense fallback={null}>
          <div className="home">
            Lib version: { version }
          </div>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>

            <li>
              <Link to="/About">About</Link>
            </li>
          </ul>
          <Routes>
            <Route path="/" element={<NxWelcome title="home" />} />

            <Route path="/About" element={<About />} />
          </Routes>
        </React.Suspense>
      );
    }

    export default App;`
    );

    // Update remote to use the lib
    updateFile(
      `${remote}/src/app/app.tsx`,
      `// eslint-disable-next-line @typescript-eslint/no-unused-vars

    import styles from './app.module.css';
    import { version } from '@acme/${lib}';

    import NxWelcome from './nx-welcome';

    export function App() {
      return (
        
        <div className='remote'>
          Lib version: { version }
          <NxWelcome title="${remote}" />
        </div>
      );
    }

    export default App;`
    );

    // update remote e2e test to check the version
    updateFile(
      `${remote}-e2e/src/e2e/app.cy.ts`,
      `describe('${remote}', () => {
          beforeEach(() => cy.visit('/'));
        
          it('should check the lib version', () => {
            cy.get('div.remote').contains('Lib version: 0.0.1');
          });
        });        
        `
    );

    // update shell e2e test to check the version
    updateFile(
      `${shell}-e2e/src/e2e/app.cy.ts`,
      `
      describe('${shell}', () => {
        beforeEach(() => cy.visit('/'));

        it('should check the lib version', () => {
          cy.get('div.home').contains('Lib version: 0.0.1');
        });
      });
      `
    );

    if (runE2ETests()) {
      // test remote e2e
      const remoteE2eResults = await runCommandUntil(
        `e2e ${remote}-e2e --no-watch --verbose`,
        (output) => output.includes("All specs passed!")
      );
      await killProcessAndPorts(remoteE2eResults.pid, remotePort);

      // test shell e2e
      // serve remote first
      const remoteProcess = await runCommandUntil(
        `serve ${remote} --no-watch --verbose`,
        (output) => {
          return output.includes(
            `Web Development Server is listening at http://localhost:${remotePort}/`
          );
        }
      );
      await killProcessAndPorts(remoteProcess.pid, remotePort);
      const shellE2eResults = await runCommandUntil(
        `e2e ${shell}-e2e --no-watch --verbose`,
        (output) => output.includes("All specs passed!")
      );
      await killProcessAndPorts(
        shellE2eResults.pid,
        shellPort,
        shellPort + 1,
        remotePort
      );
    }
  }, 500_000);
});
