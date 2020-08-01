import {
  forEachCli,
  runCLI,
  supportUi,
  uniq,
  ensureProject,
  tmpProjPath,
  checkFilesExist,
  readFile,
} from '@nrwl/e2e/utils';
import { writeFileSync, mkdirSync } from 'fs';

forEachCli(() => {
  describe('Storybook schematics', () => {
    describe('running Storybook and Cypress', () => {
      it('should execute e2e tests using Cypress running against Storybook', () => {
        ensureProject();

        const myapp = uniq('myapp');
        runCLI(`generate @nrwl/angular:app ${myapp} --no-interactive`);

        const mylib = uniq('test-ui-lib');
        createTestUILib(mylib);
        const mylib2 = uniq('test-ui-lib-react');
        runCLI(`generate @nrwl/react:lib ${mylib2} --no-interactive`);
        runCLI(
          `generate @nrwl/react:component Button --project=${mylib2} --no-interactive`
        );
        writeFileSync(
          tmpProjPath(`libs/${mylib2}/src/lib/button.tsx`),
          `
          import React from 'react';

            import './button.css';
            
            export type ButtonStyle = 'default' | 'primary' | 'warning';
            
            /* eslint-disable-next-line */
            export interface ButtonProps {
              text?: string;
              style?: ButtonStyle;
              padding?: number;
            }
            
            export const Button = (props: ButtonProps) => {
              return (
                <button className={props.style} style={{ padding: \`\${props.padding}px\` }}>
                  {props.text}
                </button>
              );
            };
            
            export default Button;            
            `
        );
        writeFileSync(
          tmpProjPath(`libs/${mylib2}/src/lib/button.stories.tsx`),
          `
            import React from 'react';
            import { text, number } from '@storybook/addon-knobs';
            import { Button, ButtonStyle } from './button';
            
            export default { title: 'Button' };
            
            export const primary = () => (
              <Button
                padding={number('Padding', 0)}
                style={text('Style', 'default') as ButtonStyle}
                text={text('Text', 'Click me')}
              />
            );
            `
        );

        runCLI(
          `generate @nrwl/angular:storybook-configuration ${mylib} --configureCypress --generateStories --generateCypressSpecs --no-interactive`
        );
        runCLI(
          `generate @nrwl/angular:stories ${mylib} --generateCypressSpecs --no-interactive`
        );

        writeFileSync(
          tmpProjPath(
            `apps/${mylib}-e2e/src/integration/test-button/test-button.component.spec.ts`
          ),
          `
            describe('test-ui-lib3726865', () => {

          it('should render the component', () => {
            cy.visit('/iframe.html?id=testbuttoncomponent--primary&knob-buttonType=button&knob-style=default&knob-age&knob-isDisabled=false');
            cy.get('proj-test-button').should('exist');
            cy.get('button').should('not.be.disabled');
            cy.get('button').should('have.class', 'default');
            cy.contains('You are 0 years old.');
          });
          it('should adjust the knobs', () => {
            cy.visit('/iframe.html?id=testbuttoncomponent--primary&knob-buttonType=button&knob-style=primary&knob-age=10&knob-isDisabled=true');
            cy.get('button').should('be.disabled');
            cy.get('button').should('have.class', 'primary');
            cy.contains('You are 10 years old.');
          });
        });
        `
        );

        runCLI(
          `generate @nrwl/react:storybook-configuration ${mylib2} --configureCypress --no-interactive`
        );

        mkdirSync(tmpProjPath(`apps/${mylib2}-e2e/src/integration`));
        writeFileSync(
          tmpProjPath(`apps/${mylib2}-e2e/src/integration/button.spec.ts`),
          `
        describe('react-ui', () => {
          it('should render the component', () => {
            cy.visit(
              '/iframe.html?id=button--primary&knob-Style=default&knob-Padding&knob-Text=Click%20me'
            );
            cy.get('button').should('exist');
            cy.get('button').should('have.class', 'default');
          });
          it('should adjust the knobs', () => {
            cy.visit(
              '/iframe.html?id=button--primary&knob-Style=primary&knob-Padding=10&knob-Text=Other'
            );
            cy.get('button').should('have.class', 'primary');
          });
        });
        `
        );

        if (supportUi()) {
          expect(runCLI(`run ${mylib}-e2e:e2e --no-watch`)).toContain(
            'All specs passed!'
          );
        }

        runCLI(`run ${mylib}:build-storybook`);

        checkFilesExist(`dist/storybook/${mylib}/index.html`);
        expect(readFile(`dist/storybook/${mylib}/index.html`)).toContain(
          `<title>Storybook</title>`
        );
      }, 1000000);
    });

    describe('build storybook', () => {
      it('should build an Angular based storybook', () => {
        ensureProject();

        const angularStorybookLib = uniq('test-ui-lib');
        createTestUILib(angularStorybookLib);
        runCLI(
          `generate @nrwl/angular:storybook-configuration ${angularStorybookLib} --generateStories --no-interactive`
        );

        // build Angular lib
        runCLI(`run ${angularStorybookLib}:build-storybook`);
        checkFilesExist(`dist/storybook/${angularStorybookLib}/index.html`);
        expect(
          readFile(`dist/storybook/${angularStorybookLib}/index.html`)
        ).toContain(`<title>Storybook</title>`);
      }, 1000000);

      it('should build a React based storybook', () => {
        ensureProject();

        const reactStorybookLib = uniq('test-ui-lib-react');
        runCLI(
          `generate @nrwl/react:lib ${reactStorybookLib} --no-interactive`
        );
        runCLI(
          `generate @nrwl/react:storybook-configuration ${reactStorybookLib} --generateStories --no-interactive`
        );

        // build React lib
        runCLI(`run ${reactStorybookLib}:build-storybook`);
        checkFilesExist(`dist/storybook/${reactStorybookLib}/index.html`);
        expect(
          readFile(`dist/storybook/${reactStorybookLib}/index.html`)
        ).toContain(`<title>Storybook</title>`);
      }, 1000000);

      it('should build a React based storybook that references another lib', () => {
        ensureProject();

        const reactStorybookLib = uniq('test-ui-lib-react');
        runCLI(
          `generate @nrwl/react:lib ${reactStorybookLib} --no-interactive`
        );
        runCLI(
          `generate @nrwl/react:storybook-configuration ${reactStorybookLib} --generateStories --no-interactive`
        );

        const anotherReactLib = uniq('test-another-lib-react');
        runCLI(`generate @nrwl/react:lib ${anotherReactLib} --no-interactive`);
        // create a React component we can reference
        writeFileSync(
          tmpProjPath(`libs/${anotherReactLib}/src/lib/mytestcmp.tsx`),
          `
            import React from 'react';
            
            /* eslint-disable-next-line */
            export interface MyTestCmpProps {}
            
            export const MyTestCmp = (props: MyTestCmpProps) => {
              return (
                <div>
                  <h1>Welcome to test cmp!</h1>
                </div>
              );
            };
            
            export default MyTestCmp;
        `
        );
        // update index.ts and export it
        writeFileSync(
          tmpProjPath(`libs/${anotherReactLib}/src/index.ts`),
          `
            export * from './lib/mytestcmp';
        `
        );

        // create a story in the first lib to reference the cmp from the 2nd lib
        writeFileSync(
          tmpProjPath(
            `libs/${reactStorybookLib}/src/lib/myteststory.stories.tsx`
          ),
          `
            import React from 'react';
            
            import { MyTestCmp, MyTestCmpProps } from '@proj/${anotherReactLib}';
    
            export default {
              component: MyTestCmp,
              title: 'MyTestCmp',
            };
    
            export const primary = () => {
              /* eslint-disable-next-line */
              const props: MyTestCmpProps = {};
    
              return <MyTestCmp />;
            };
        `
        );

        // build React lib
        runCLI(`run ${reactStorybookLib}:build-storybook`);
        checkFilesExist(`dist/storybook/${reactStorybookLib}/index.html`);
        expect(
          readFile(`dist/storybook/${reactStorybookLib}/index.html`)
        ).toContain(`<title>Storybook</title>`);
      }, 1000000);

      it('should build an Angular based storybook that references another lib', () => {
        ensureProject();

        const angularStorybookLib = uniq('test-ui-lib');
        createTestUILib(angularStorybookLib);
        runCLI(
          `generate @nrwl/angular:storybook-configuration ${angularStorybookLib} --generateStories --no-interactive`
        );

        // create another lib with a component
        const anotherTestLib = uniq('test-another-lib');
        runCLI(`g @nrwl/angular:library ${anotherTestLib} --no-interactive`);
        runCLI(
          `g @nrwl/angular:component my-test-cmp --project=${anotherTestLib} --no-interactive`
        );

        // update index.ts and export it
        writeFileSync(
          tmpProjPath(`libs/${anotherTestLib}/src/index.ts`),
          `
            export * from './lib/my-test-cmp/my-test-cmp.component';
        `
        );

        // create a story in the first lib to reference the cmp from the 2nd lib
        writeFileSync(
          tmpProjPath(
            `libs/${angularStorybookLib}/src/lib/myteststory.stories.ts`
          ),
          `
            import { MyTestCmpComponent } from '@proj/${anotherTestLib}';

            export default {
              title: 'My Test Cmp',
            };
            
            let x = 'hi';
            
            export const primary = () => ({
              moduleMetadata: {
                imports: [],
              },
              component: MyTestCmpComponent,
              props: {},
            });
        `
        );

        // build Angular lib
        runCLI(`run ${angularStorybookLib}:build-storybook`);
        checkFilesExist(`dist/storybook/${angularStorybookLib}/index.html`);
        expect(
          readFile(`dist/storybook/${angularStorybookLib}/index.html`)
        ).toContain(`<title>Storybook</title>`);
      }, 1000000);
    });
  });
});

export function createTestUILib(libName: string): void {
  runCLI(`g @nrwl/angular:library ${libName} --no-interactive`);
  runCLI(
    `g @nrwl/angular:component test-button --project=${libName} --no-interactive`
  );

  writeFileSync(
    tmpProjPath(`libs/${libName}/src/lib/test-button/test-button.component.ts`),
    `
      import { Component, OnInit, Input } from '@angular/core';

      export type ButtonStyle = 'default' | 'primary' | 'accent';

      @Component({
        selector: 'proj-test-button',
        templateUrl: './test-button.component.html',
        styleUrls: ['./test-button.component.css']
      })
      export class TestButtonComponent implements OnInit {
        @Input('buttonType') type = 'button';
        @Input() style: ButtonStyle = 'default';
        @Input() age: number;
        @Input() isDisabled = false;

        constructor() { }

        ngOnInit() {
        }

      }
      `
  );

  writeFileSync(
    tmpProjPath(
      `libs/${libName}/src/lib/test-button/test-button.component.html`
    ),
    `
    <button [disabled]="isDisabled" [attr.type]="type" [ngClass]="style">Click me</button>
    <p>You are {{age}} years old.</p>
    `
  );
  runCLI(
    `g @nrwl/angular:component test-other --project=${libName} --no-interactive`
  );
}
