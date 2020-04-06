import { externalSchematic, Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../utils/testing';
import { CreateComponentSpecFileSchema } from './component-cypress-spec';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

describe('react:component-cypress-spec', () => {
  let appTree: Tree;
  let tree: UnitTestTree;

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
      `
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
      `
    }
  ].forEach(testConfig => {
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

            appTree.overwrite(cmpPath, testConfig.testCmpSrcWithProps);

            tree = await runSchematic(
              'component-cypress-spec',
              <CreateComponentSpecFileSchema>{
                componentPath: `lib/test-ui-lib.${fileCmpExt}`,
                project: 'test-ui-lib',
                js: testConfig.plainJS
              },
              appTree
            );
          });

          it('should properly set up the spec', () => {
            expect(stripIndents`${tree.readContent(cypressStorySpecFilePath)}`)
              .toContain(stripIndents`describe('test-ui-lib: Test component', () => {
        beforeEach(() => cy.visit('/iframe.html?id=test--primary&knob-name=&knob-displayAge=false'));
        
        it('should render the component', () => {
          cy.get('h1').should('contain', 'Welcome to test-ui-lib!');
        });
      });
      `);
          });
        });
      }

      describe('component without properties', () => {
        beforeEach(async () => {
          appTree = await createTestUILib('test-ui-lib', testConfig.plainJS);

          appTree.overwrite(cmpPath, testConfig.testCmpSrcWithoutProps);

          tree = await runSchematic(
            'component-cypress-spec',
            <CreateComponentSpecFileSchema>{
              componentPath: `lib/test-ui-lib.${fileCmpExt}`,
              project: 'test-ui-lib',
              js: testConfig.plainJS
            },
            appTree
          );
        });

        it('should properly set up the spec', () => {
          expect(stripIndents`${tree.readContent(cypressStorySpecFilePath)}`)
            .toContain(stripIndents`describe('test-ui-lib: Test component', () => {
      beforeEach(() => cy.visit('/iframe.html?id=test--primary'));
      
      it('should render the component', () => {
        cy.get('h1').should('contain', 'Welcome to test-ui-lib!');
      });
    });
    `);
        });
      });
    });
  });
});

export async function createTestUILib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = Tree.empty();
  appTree = createEmptyWorkspace(appTree);
  appTree = await callRule(
    externalSchematic('@nrwl/react', 'library', {
      name: libName,
      js: plainJS
    }),
    appTree
  );

  // create some Nx app that we'll use to generate the cypress
  // spec into it. We don't need a real Cypress setup
  appTree = await callRule(
    externalSchematic('@nrwl/react', 'application', {
      name: `${libName}-e2e`,
      js: plainJS
    }),
    appTree
  );
  return appTree;
}
