import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import * as storybookUtils from '../utils/storybook';
import { componentCypressSpecGenerator } from './component-cypress-spec';
import { applicationGenerator } from '../application/application';

describe('componentCypressSpec generator', () => {
  let tree: Tree;
  const appName = 'ng-app1';
  const specFile = `apps/${appName}-e2e/src/integration/test-button/test-button.component.spec.ts`;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    const componentGenerator = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'component'
    );

    await applicationGenerator(tree, { name: appName });
    await componentGenerator(tree, {
      name: 'test-button',
      project: appName,
    });

    tree.write(
      `apps/${appName}/src/app/test-button/test-button.component.ts`,
      `import { Component, Input } from '@angular/core';

export type ButtonStyle = 'default' | 'primary' | 'accent';

@Component({
  selector: 'proj-test-button',
  templateUrl: './test-button.component.html',
  styleUrls: ['./test-button.component.css']
})
export class TestButtonComponent {
  @Input('buttonType') type = 'button';
  @Input() style: ButtonStyle = 'default';
  @Input() age?: number;
  @Input() isOn = false;      
}`
    );
  });

  it('should not generate the component spec file when it already exists', () => {
    jest.spyOn(storybookUtils, 'getComponentProps');
    jest.spyOn(devkit, 'generateFiles');
    tree.write(specFile, '');

    componentCypressSpecGenerator(tree, {
      componentFileName: 'test-button.component',
      componentName: 'TestButtonComponent',
      componentPath: `test-button`,
      projectPath: `apps/${appName}/src/app`,
      projectName: appName,
    });

    expect(storybookUtils.getComponentProps).not.toHaveBeenCalled();
    expect(devkit.generateFiles).not.toHaveBeenCalled();
    expect(tree.read(specFile).toString()).toBe('');
  });

  it('should generate the component spec file', () => {
    componentCypressSpecGenerator(tree, {
      componentFileName: 'test-button.component',
      componentName: 'TestButtonComponent',
      componentPath: `test-button`,
      projectPath: `apps/${appName}/src/app`,
      projectName: appName,
    });

    expect(tree.exists(specFile)).toBe(true);
    const specFileContent = tree.read(specFile).toString();
    expect(specFileContent).toMatchSnapshot();
  });
});
