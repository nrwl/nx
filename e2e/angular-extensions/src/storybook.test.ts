process.env.SELECTED_CLI = 'angular';

import {
  checkFilesExist,
  isNotWindows,
  killPorts,
  newProject,
  readFile,
  cleanupProject,
  runCLI,
  runCypressTests,
  tmpProjPath,
  uniq,
} from '@nrwl/e2e/utils';
import { writeFileSync } from 'fs';

describe('Angular Package', () => {
  describe('storybook schematics', () => {
    let proj: string;

    beforeAll(() => (proj = newProject()));
    afterAll(() => cleanupProject());

    it('should not overwrite global storybook config files', () => {
      const angularStorybookLib = uniq('test-ui-lib-angular');
      runCLI(
        `generate @nrwl/angular:lib ${angularStorybookLib} --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:storybook-configuration ${angularStorybookLib} --generateStories --no-interactive`
      );

      checkFilesExist(`.storybook/main.js`);
      writeFileSync(
        tmpProjPath(`.storybook/main.js`),
        `
        module.exports = {
          stories: [],
          addons: ['@storybook/addon-essentials'],
        };

        console.log('hi there');
      `
      );

      // generate another lib with storybook config
      const anotherAngularStorybookLib = uniq('test-ui-lib-angular2');
      runCLI(
        `generate @nrwl/angular:lib ${anotherAngularStorybookLib} --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:storybook-configuration ${anotherAngularStorybookLib} --generateStories --no-interactive`
      );

      expect(readFile(`.storybook/main.js`)).toContain(
        `console.log('hi there');`
      );
    });

    describe('build storybook', () => {
      // TODO(js): temporarily disabled
      xit('should execute e2e tests using Cypress running against Storybook', async () => {
        if (isNotWindows()) {
          const myapp = uniq('myapp');
          runCLI(`generate @nrwl/angular:app ${myapp} --no-interactive`);

          const myAngularLib = uniq('test-ui-lib');
          createTestUILib(myAngularLib);
          const myReactLib = uniq('test-ui-lib-react');
          runCLI(`generate @nrwl/react:lib ${myReactLib} --no-interactive`);
          runCLI(
            `generate @nrwl/react:component Button --project=${myReactLib} --no-interactive`
          );
          writeFileSync(
            tmpProjPath(`libs/${myReactLib}/src/lib/button.tsx`),
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
            tmpProjPath(`libs/${myReactLib}/src/lib/button.stories.tsx`),
            `
          import  { Story, Meta } from '@storybook/react';
          import { Button, ButtonProps } from './button';

          export default {
            component: Button,
            title: 'Button',
          } as Meta;

          const Template: Story<ButtonProps> = (args) => <Button {...args} />;

          export const Primary = Template.bind({});
          Primary.args = {
            text: 'Click me',
            padding: 0,
            style: 'default',
          };
            `
          );

          runCLI(
            `generate @nrwl/angular:storybook-configuration ${myAngularLib} --configureCypress --generateStories --generateCypressSpecs --no-interactive`
          );
          runCLI(
            `generate @nrwl/angular:stories ${myAngularLib} --generateCypressSpecs --no-interactive`
          );

          writeFileSync(
            tmpProjPath(
              `apps/${myAngularLib}-e2e/src/integration/test-button/test-button.component.spec.ts`
            ),
            `
            describe('${myAngularLib}', () => {

          it('should render the component', () => {
            cy.visit('/iframe.html?id=testbuttoncomponent--primary&args=buttonType:button;style:default;age;isDisabled:false');
            cy.get('proj-test-button').should('exist');
            cy.get('button').should('not.be.disabled');
            cy.get('button').should('have.class', 'default');
            cy.contains('You are 0 years old.');
          });
          it('should adjust the controls', () => {
            cy.visit('/iframe.html?id=testbuttoncomponent--primary&args=buttonType:button;style:primary;age:10;isDisabled:true');
            cy.get('button').should('be.disabled');
            cy.get('button').should('have.class', 'primary');
            cy.contains('You are 10 years old.');
          });
        });
        `
          );

          runCLI(
            `generate @nrwl/react:storybook-configuration ${myReactLib} --configureCypress --no-interactive`
          );

          // The following line (mkdirSync...) is not needed,
          // since the above schematic creates this directory.
          // So, if we leave it there, there's an error saying the directory exists.
          // I am not sure how it worked as it was :/

          // mkdirSync(tmpProjPath(`apps/${myReactLib}-e2e/src/integration`));
          writeFileSync(
            tmpProjPath(
              `apps/${myReactLib}-e2e/src/integration/button.spec.ts`
            ),
            `
        describe('react-ui', () => {
          it('should render the component', () => {
            cy.visit(
              '/iframe.html?id=button--primary&args=style:default;padding;text:Click%20me'
            );
            cy.get('button').should('exist');
            cy.get('button').should('have.class', 'default');
          });
          it('should adjust the controls', () => {
            cy.visit(
              '/iframe.html?id=button--primary&args=style:primary;padding:10;text:Other'
            );
            cy.get('button').should('have.class', 'primary');
          });
        });
        `
          );

          if (runCypressTests()) {
            const e2eResults = runCLI(`e2e ${myAngularLib}-e2e --no-watch`);
            expect(e2eResults).toContain('All specs passed!');
            expect(await killPorts()).toBeTruthy();
          }

          runCLI(`run ${myAngularLib}:build-storybook`);

          checkFilesExist(`dist/storybook/${myAngularLib}/index.html`);
        }
      }, 1000000);

      // TODO(js): temporarily disabled
      xit('should build an Angular based storybook', () => {
        const angularStorybookLib = uniq('test-ui-lib');
        createTestUILib(angularStorybookLib);
        runCLI(
          `generate @nrwl/angular:storybook-configuration ${angularStorybookLib} --generateStories --no-interactive`
        );

        // build Angular lib
        runCLI(`run ${angularStorybookLib}:build-storybook`);
        checkFilesExist(`dist/storybook/${angularStorybookLib}/index.html`);
      }, 1000000);

      // TODO(js): temporarily disabled
      xit('should build an Angular based storybook that references another lib', () => {
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
            import { moduleMetadata, Story, Meta } from '@storybook/angular';
            import { MyTestCmpComponent } from '@${proj}/${anotherTestLib}';

            export default {
              title: 'My Test Cmp',
              component: MyTestCmpComponent,
              decorators: [
                moduleMetadata({
                  imports: [],
                })
              ],
            } as Meta<MyTestCmpComponent>;

            const Template: Story<MyTestCmpComponent> = (args: MyTestCmpComponent) => ({
              component: MyTestCmpComponent,
              props: args,
            });


            export const Primary = Template.bind({});
            Primary.args = {
            }
        `
        );

        // build Angular lib
        runCLI(`run ${angularStorybookLib}:build-storybook`);
        checkFilesExist(`dist/storybook/${angularStorybookLib}/index.html`);
      }, 1000000);
    });
  });
});

export function createTestUILib(libName: string): void {
  runCLI(
    `g @nrwl/angular:library ${libName} --no-interactive --buildable=true`
  );
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
        @Input('buttonType') buttonType = 'button';
        @Input() style: ButtonStyle = 'default';
        @Input() age!: number;
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
