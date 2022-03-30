import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { formatFile } from '../../utils/format-file';
import applicationGenerator from '../application/application';
import libraryGenerator from '../library/library';
import componentCypressSpecGenerator from './component-cypress-spec';

describe('react:component-cypress-spec', () => {
  let appTree: Tree;

  [
    {
      plainJS: false,
      testCmpSrcWithProps: `import React from 'react';
    
      import './test.scss';
      
      export interface TestProps {
        name: string;
        displayAge: boolean;
      }
      
      export const Test = (props: TestProps) => {
        return (
          <div>
            <h1>Welcome to test component, {props.name}</h1>
          </div>
        );
      };
      
      export default Test;        
      `,
      testCmpSrcWithoutProps: `import React from 'react';
    
      import './test.scss';
      
      export const Test = () => {
        return (
          <div>
            <h1>Welcome to test component</h1>
          </div>
        );
      };
      
      export default Test;        
      `,
    },
    {
      plainJS: true,
      testCmpSrcWithProps: `import React from 'react';
    
      import './test.scss';      
      export const Test = (props: TestProps) => {
        return (
          <div>
            <h1>Welcome to test component, {props.name}</h1>
          </div>
        );
      };
      
      export default Test;        
      `,
      testCmpSrcWithoutProps: `import React from 'react';
      import './test.scss';
      export const Test = () => {
        return (
          <div>
            <h1>Welcome to test component</h1>
          </div>
        );
      };
      
      export default Test;        
      `,
    },
  ].forEach((testConfig) => {
    let fileCmpExt = testConfig.plainJS ? 'js' : 'tsx';
    let fileExt = testConfig.plainJS ? 'js' : 'ts';

    describe(`using ${
      testConfig.plainJS ? 'plain JS' : 'TypeScript'
    } setup`, () => {
      let cmpPath = `libs/test-ui-lib/src/lib/test-ui-lib.${fileCmpExt}`;
      let cypressStorySpecFilePath = `apps/test-ui-lib-e2e/src/integration/test-ui-lib/test-ui-lib.spec.${fileExt}`;

      if (!testConfig.plainJS) {
        // hacky, but we should do this check only if we run with TypeScript,
        // detecting component props in plain JS is "not possible"
        describe('component with properties', () => {
          beforeEach(async () => {
            appTree = await createTestUILib('test-ui-lib', testConfig.plainJS);

            appTree.write(cmpPath, testConfig.testCmpSrcWithProps);

            await componentCypressSpecGenerator(appTree, {
              componentPath: `lib/test-ui-lib.${fileCmpExt}`,
              project: 'test-ui-lib',
              js: testConfig.plainJS,
            });
          });

          it('should properly set up the spec', () => {
            expect(
              formatFile`${appTree.read(cypressStorySpecFilePath, 'utf-8')}`
            )
              .toContain(formatFile`describe('test-ui-lib: Test component', () => {
        beforeEach(() => cy.visit('/iframe.html?id=test--primary&args=name;displayAge:false;'));
        
        it('should render the component', () => {
          cy.get('h1').should('contain', 'Welcome to Test!');
        });
      })
      `);
          });
        });
      }

      describe('component without properties', () => {
        beforeEach(async () => {
          appTree = await createTestUILib('test-ui-lib', testConfig.plainJS);

          appTree.write(cmpPath, testConfig.testCmpSrcWithoutProps);

          await componentCypressSpecGenerator(appTree, {
            componentPath: `lib/test-ui-lib.${fileCmpExt}`,
            project: 'test-ui-lib',
            js: testConfig.plainJS,
          });
        });

        it('should properly set up the spec', () => {
          expect(formatFile`${appTree.read(cypressStorySpecFilePath, 'utf-8')}`)
            .toContain(formatFile`describe('test-ui-lib: Test component', () => {
      beforeEach(() => cy.visit('/iframe.html?id=test--primary'));
      
      it('should render the component', () => {
        cy.get('h1').should('contain', 'Welcome to Test!');
      });
    });
    `);
        });
      });
    });
  });

  it('should target the correct cypress suite', async () => {
    appTree = await createTestUILib('test-ui-lib');
    await applicationGenerator(appTree, {
      e2eTestRunner: 'none',
      linter: Linter.EsLint,
      name: `other-e2e`,
      skipFormat: true,
      style: 'css',
      unitTestRunner: 'none',
      standaloneConfig: false,
    });
    // since other-e2e isn't a real cypress project we mock the v10 cypress config
    appTree.write('apps/other-e2e/cypress.config.ts', `export default {}`);
    await componentCypressSpecGenerator(appTree, {
      componentPath: `lib/test-ui-lib.tsx`,
      project: 'test-ui-lib',
      cypressProject: 'other-e2e',
    });
    expect(
      appTree.exists('apps/other-e2e/src/e2e/test-ui-lib/test-ui-lib.cy.ts')
    ).toBeTruthy();
    expect(
      appTree.exists('apps/test-ui-lib/src/e2e/test-ui-lib/test-ui-lib.cy.ts')
    ).toBeFalsy();
  });

  it('should generate a .spec.ts file with cypress.json', async () => {
    appTree = await createTestUILib('test-ui-lib');
    await applicationGenerator(appTree, {
      e2eTestRunner: 'none',
      linter: Linter.EsLint,
      name: `other-e2e`,
      skipFormat: true,
      style: 'css',
      unitTestRunner: 'none',
      standaloneConfig: false,
    });
    appTree.delete(`apps/other-e2e/cypress.config.ts`);
    appTree.write(`apps/other-e2e/cypress.json`, '{}');
    await componentCypressSpecGenerator(appTree, {
      componentPath: `lib/test-ui-lib.tsx`,
      project: 'test-ui-lib',
      cypressProject: 'other-e2e',
    });
    expect(
      appTree.exists(
        'apps/other-e2e/src/integration/test-ui-lib/test-ui-lib.spec.ts'
      )
    ).toBeTruthy();
    expect(
      appTree.exists(
        'apps/test-ui-lib/src/integration/test-ui-lib/test-ui-lib.spec.ts'
      )
    ).toBeFalsy();
  });
});

export async function createTestUILib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();
  await libraryGenerator(appTree, {
    name: libName,
    linter: Linter.EsLint,
    js: plainJS,
    component: true,
    skipFormat: true,
    skipTsConfig: false,
    style: 'css',
    unitTestRunner: 'jest',
    standaloneConfig: false,
  });

  // create some Nx app that we'll use to generate the cypress
  // spec into it. We don't need a real Cypress setup
  await applicationGenerator(appTree, {
    js: plainJS,
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    name: `${libName}-e2e`,
    skipFormat: true,
    style: 'css',
    unitTestRunner: 'none',
    standaloneConfig: false,
  });

  return appTree;
}
