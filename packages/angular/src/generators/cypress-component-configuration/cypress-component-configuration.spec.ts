import { installedCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import { joinPathFragments, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { componentGenerator } from '../component/component';
import librarySecondaryEntryPointGenerator from '../library-secondary-entry-point/library-secondary-entry-point';
import { libraryGenerator } from '../library/library';
import { cypressComponentConfiguration } from './cypress-component-configuration';

jest.mock('@nrwl/cypress/src/utils/cypress-version');
describe('Cypress Component Testing Configuration', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '');
    mockedInstalledCypressVersion.mockReturnValue(10);
  });

  it('should work with simple components', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
    });

    await setup(tree, {
      project: 'my-lib',
      name: 'something',
      standalone: false,
    });

    await cypressComponentConfiguration(tree, {
      project: 'my-lib',
      generateTests: true,
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      basePath: 'libs/my-lib/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with standalone component', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib-standalone',
    });

    await setup(tree, {
      project: 'my-lib-standalone',
      name: 'something',
      standalone: true,
    });

    await cypressComponentConfiguration(tree, {
      project: 'my-lib-standalone',
      generateTests: true,
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      basePath: 'libs/my-lib-standalone/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with complex component', async () => {
    await libraryGenerator(tree, {
      name: 'with-inputs-cmp',
    });

    await setup(tree, {
      project: 'with-inputs-cmp',
      name: 'something',
      standalone: false,
      withInputs: true,
      basePath: 'libs/with-inputs-cmp/src/lib',
    });

    await cypressComponentConfiguration(tree, {
      project: 'with-inputs-cmp',
      generateTests: true,
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      basePath: 'libs/with-inputs-cmp/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with complex standalone component', async () => {
    await libraryGenerator(tree, {
      name: 'with-inputs-standalone-cmp',
    });

    await setup(tree, {
      project: 'with-inputs-standalone-cmp',
      name: 'something',
      standalone: true,
      withInputs: true,
      basePath: 'libs/with-inputs-standalone-cmp/src/lib',
    });

    await cypressComponentConfiguration(tree, {
      project: 'with-inputs-standalone-cmp',
      generateTests: true,
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      basePath: 'libs/with-inputs-standalone-cmp/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with secondary entry point libs', async () => {
    await libraryGenerator(tree, {
      name: 'secondary',
      buildable: true,
    });
    await librarySecondaryEntryPointGenerator(tree, {
      name: 'button',
      library: 'secondary',
    });
    await componentGenerator(tree, {
      name: 'fancy-button',
      path: 'libs/secondary/src/lib/button',
      project: 'secondary',
      flat: true,
    });

    await componentGenerator(tree, {
      name: 'standalone-fancy-button',
      path: 'libs/secondary/src/lib/button',
      project: 'secondary',
      standalone: true,
      flat: true,
    });

    await cypressComponentConfiguration(tree, {
      generateTests: true,
      project: 'secondary',
    });
    console.log(tree.listChanges().map((c) => c.path));
    expect(
      tree.read(
        'libs/secondary/src/lib/button/fancy-button.component.cy.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
    expect(
      tree.read(
        'libs/secondary/src/lib/button/standalone-fancy-button.component.cy.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
  });

  it('should not overwrite existing component test', async () => {
    await libraryGenerator(tree, {
      name: 'cool-lib',
      flat: true,
    });
    await setup(tree, { project: 'cool-lib', name: 'abc', standalone: false });
    tree.write(
      'libs/cool-lib/src/lib/abc-one/abc-one.component.cy.ts',
      'should not overwrite abc-one'
    );
    tree.write(
      'libs/cool-lib/src/lib/abc-two/abc-two.component.cy.ts',
      'should not overwrite abc-two'
    );
    tree.write(
      'libs/cool-lib/src/lib/abc-three/abc-three.component.cy.ts',
      'should not overwrite abc-three'
    );

    await cypressComponentConfiguration(tree, {
      project: 'cool-lib',
      generateTests: true,
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      name: 'abc',
      basePath: 'libs/cool-lib/src/lib',
    });

    expect(one.cy).toEqual('should not overwrite abc-one');
    expect(two.cy).toEqual('should not overwrite abc-two');
    expect(three.cy).toEqual('should not overwrite abc-three');
  });

  // TODO: should we support this?
  it.skip('should handle multiple components per file', async () => {
    await libraryGenerator(tree, {
      name: 'multiple-components',
      flat: true,
    });

    await componentGenerator(tree, {
      name: 'cmp-one',
      project: 'multiple-components',
      flat: true,
    });
    await componentGenerator(tree, {
      name: 'cmp-two',
      project: 'multiple-components',
      flat: true,
    });
    console.log(
      tree.read(
        'libs/multiple-components/src/lib/multiple-components.module.ts',
        'utf-8'
      )
    );
    tree.write(
      `libs/multiple-components/src/lib/cmp-one.component.ts`,
      `
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'proj-cmp-one',
  templateUrl: './cmp-one.component.html',
  styleUrls: ['./cmp-one.component.css']
})
export class CmpOneComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}

@Component({
  selector: 'proj-cmp-one',
  template: '<h1>Hello World, {{abc}}</h1>',
  styles: []
})
export class CmpMultiComponent implements OnInit {
  @Input() name: string = 'abc'
  constructor() { }
  ngOnInit(): void {}
}
`
    );

    tree.write(
      '',
      `
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CmpOneComponent, CmpMultiComponent } from './cmp-one.component';
import { CmpTwoComponent } from './cmp-two.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    CmpOneComponent,
    CmpTwoComponent
  ]
})
export class MultipleComponentsModule { }
`
    );

    await cypressComponentConfiguration(tree, {
      project: 'multiple-components',
      generateTests: true,
    });
    expect(
      tree.read(
        'libs/multiple-components/src/lib/cmp-one.component.cy.ts',
        'utf-8'
      )
    ).toEqual('');
  });
});

async function setup(
  tree: Tree,
  options: {
    name: string;
    project: string;
    standalone?: boolean;
    withInputs?: boolean;
    basePath?: string;
  }
) {
  for (const name of [
    `${options.name}-one`,
    `${options.name}-two`,
    `${options.name}-three`,
  ]) {
    await componentGenerator(tree, { project: options.project, name });

    if (options.withInputs) {
      const cmpPath = joinPathFragments(
        options.basePath,
        name,
        `${name}.component.ts`
      );
      const oldContent = tree.read(
        cmpPath,

        'utf-8'
      );

      const newContent = oldContent.replace(
        'constructor()',
        `
  @Input('buttonType') type = 'button';
  @Input() style: 'default' | 'fancy' | 'link' = 'default';
  @Input() age?: number;
  @Input() isOn = false;
  @Input() message: string | undefined;
  @Input() anotherProp: any;
  @Input() anotherNeverProp: never;

  constructor()`
      );

      tree.write(cmpPath, newContent);
    }
  }
}
function getCmpsFromTree(
  tree: Tree,
  options: { basePath: string; name: string }
) {
  return [
    `${options.name}-one`,
    `${options.name}-two`,
    `${options.name}-three`,
  ].map((n) => {
    expect(
      tree.exists(joinPathFragments(options.basePath, n, `${n}.component.ts`))
    ).toBeTruthy();
    expect(
      tree.exists(
        joinPathFragments(options.basePath, n, `${n}.component.cy.ts`)
      )
    ).toBeTruthy();
    return {
      cmp: tree.read(
        joinPathFragments(options.basePath, n, `${n}.component.ts`),
        'utf-8'
      ),
      cy: tree.read(
        joinPathFragments(options.basePath, n, `${n}.component.cy.ts`),
        'utf-8'
      ),
    };
  });
}
