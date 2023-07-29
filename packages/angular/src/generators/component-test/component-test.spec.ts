import { assertMinimumCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { UnitTestRunner } from '../../utils/test-runners';
import { componentGenerator } from '../component/component';
import { generateTestLibrary } from '../utils/testing';
import { componentTestGenerator } from './component-test';

jest.mock('@nx/cypress/src/utils/cypress-version');

describe('Angular Cypress Component Test Generator', () => {
  let tree: Tree;
  let mockedAssertMinimumCypressVersion: jest.Mock<
    ReturnType<typeof assertMinimumCypressVersion>
  > = assertMinimumCypressVersion as never;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    // silence warnings about missing .gitignore file
    tree.write('.gitignore', '');
    mockedAssertMinimumCypressVersion.mockReturnValue();
  });

  it('should handle component w/o inputs', async () => {
    await generateTestLibrary(tree, {
      name: 'my-lib',
      unitTestRunner: UnitTestRunner.None,
      linter: Linter.None,
    });
    await componentGenerator(tree, {
      project: 'my-lib',
      name: 'my-lib',
    });
    componentTestGenerator(tree, {
      componentName: 'MyLibComponent',
      componentFileName: './my-lib.component',
      project: 'my-lib',
      componentDir: 'src/lib/my-lib',
    });
    expect(
      tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.cy.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate a component test', async () => {
    await generateTestLibrary(tree, {
      name: 'my-lib',
      unitTestRunner: UnitTestRunner.None,
      linter: Linter.None,
    });
    await componentGenerator(tree, {
      project: 'my-lib',
      name: 'my-lib',
    });

    tree.write(
      'libs/my-lib/src/lib/my-lib/my-lib.component.ts',
      `
import { Component, OnInit, Input } from '@angular/core';

export type ButtonStyle = 'default' | 'primary' | 'accent';

@Component({
  selector: 'proj-my-lib',
  templateUrl: './my-lib.component.html',
  styleUrls: ['./my-lib.component.css']
})
export class MyLibComponent implements OnInit {
  @Input('buttonType') type = 'button';
  @Input() style: ButtonStyle = 'default';
  @Input() age?: number;
  @Input() isOn = false;
  @Input() message: string | undefined;
  @Input() anotherProp: any;
  @Input() anotherNeverProp: never;
  
  constructor() { }

  ngOnInit(): void {
  }

}`
    );

    componentTestGenerator(tree, {
      componentName: 'MyLibComponent',
      componentFileName: './my-lib.component',
      project: 'my-lib',
      componentDir: 'src/lib/my-lib',
    });

    expect(
      tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.cy.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should work with standalone components', async () => {
    await generateTestLibrary(tree, {
      name: 'my-lib',
      unitTestRunner: UnitTestRunner.None,
      linter: Linter.None,
    });
    await componentGenerator(tree, {
      project: 'my-lib',
      name: 'my-lib',
      standalone: true,
    });
    tree.write(
      'libs/my-lib/src/lib/my-lib/my-lib.component.ts',
      `
import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'proj-my-lib',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-lib.component.html',
  styleUrls: ['./my-lib.component.css']
})
export class MyLibComponent implements OnInit {
  @Input('buttonType') type = 'button';
  @Input() style: ButtonStyle = 'default';
  @Input() age?: number;
  @Input() isOn = false;
  @Input() message: string | undefined;
  @Input() anotherProp: any;
  @Input() anotherNeverProp: never;
  constructor() { }

  ngOnInit(): void {
  }

}
`
    );
    componentTestGenerator(tree, {
      componentName: 'MyLibComponent',
      componentFileName: './my-lib.component',
      project: 'my-lib',
      componentDir: 'src/lib/my-lib',
    });
    expect(
      tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.cy.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should not overwrite an existing component test', async () => {
    await generateTestLibrary(tree, {
      name: 'my-lib',
      unitTestRunner: UnitTestRunner.None,
      linter: Linter.None,
    });

    await componentGenerator(tree, { name: 'my-lib', project: 'my-lib' });
    tree.write(
      'libs/my-lib/src/lib/my-lib/my-lib.component.cy.ts',
      `should not overwrite`
    );

    componentTestGenerator(tree, {
      componentName: 'MyLibComponent',
      componentFileName: './my-lib.component',
      project: 'my-lib',
      componentDir: 'src/lib/my-lib',
    });

    expect(
      tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.cy.ts', 'utf-8')
    ).toEqual('should not overwrite');
  });

  it('should be idempotent', async () => {
    await generateTestLibrary(tree, {
      name: 'my-lib',
      unitTestRunner: UnitTestRunner.None,
      linter: Linter.None,
    });

    await componentGenerator(tree, { name: 'my-lib', project: 'my-lib' });

    const expected = `import { TestBed } from '@angular/core/testing';
import { MyLibComponent } from './my-lib.component';

describe(MyLibComponent.name, () => {

  beforeEach(() => {
    TestBed.overrideComponent(MyLibComponent, {
      add: { 
        imports: [],
        providers: []
      }
    }) 
  })

  it('renders', () => {
     cy.mount(MyLibComponent,);
  })

})
`;

    componentTestGenerator(tree, {
      componentName: 'MyLibComponent',
      componentFileName: './my-lib.component',
      project: 'my-lib',
      componentDir: 'src/lib/my-lib',
    });
    expect(
      tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.cy.ts', 'utf-8')
    ).toEqual(expected);

    componentTestGenerator(tree, {
      componentName: 'MyLibComponent',
      componentFileName: './my-lib.component',
      project: 'my-lib',
      componentDir: 'src/lib/my-lib',
    });
    expect(
      tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.cy.ts', 'utf-8')
    ).toEqual(expected);
  });
});
