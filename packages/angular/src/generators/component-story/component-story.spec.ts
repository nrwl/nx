import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator } from '../library/library';
import * as storybookUtils from '../utils/storybook';
import { componentStoryGenerator } from './component-story';

describe('componentStory generator', () => {
  let tree: Tree;
  const libName = 'ng-lib1';
  const storyFile = `libs/${libName}/src/lib/test-button/test-button.component.stories.ts`;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    const componentGenerator = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'component'
    );

    await libraryGenerator(tree, { name: libName });
    await componentGenerator(tree, {
      name: 'test-button',
      project: libName,
    });

    tree.write(
      `libs/${libName}/src/lib/test-button/test-button.component.ts`,
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
  @Input() message: string | undefined;
  @Input() anotherProp: any;
  @Input() anotherNeverProp: never;
}`
    );
  });

  it('should not generate the component stories file when it already exists', () => {
    jest.spyOn(storybookUtils, 'getComponentProps');
    jest.spyOn(devkit, 'generateFiles');
    tree.write(storyFile, '');

    componentStoryGenerator(tree, {
      componentFileName: 'test-button.component',
      componentName: 'TestButtonComponent',
      componentPath: `src/lib/test-button`,
      projectPath: `libs/${libName}`,
    });

    expect(storybookUtils.getComponentProps).not.toHaveBeenCalled();
    expect(devkit.generateFiles).not.toHaveBeenCalled();
    expect(tree.read(storyFile, 'utf-8')).toBe('');
  });

  it('should generate the component stories file', () => {
    componentStoryGenerator(tree, {
      componentFileName: 'test-button.component',
      componentName: 'TestButtonComponent',
      componentPath: `src/lib/test-button`,
      projectPath: `libs/${libName}`,
    });

    expect(tree.exists(storyFile)).toBe(true);
  });

  it('should generate the right props', () => {
    componentStoryGenerator(tree, {
      componentFileName: 'test-button.component',
      componentName: 'TestButtonComponent',
      componentPath: `src/lib/test-button`,
      projectPath: `libs/${libName}`,
    });

    const storiesFileContent = tree.read(storyFile).toString();
    expect(storiesFileContent).toMatchSnapshot();
  });
});
