import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import scamGenerator from '../scam/scam';
import { generateTestApplication } from '../utils/testing';
import { scamToStandalone } from './scam-to-standalone';

describe('scam-to-standalone', () => {
  it('should convert an inline scam to standalone', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestApplication(tree, { directory: 'foo', skipFormat: true });
    await scamGenerator(tree, {
      name: 'bar',
      path: 'foo/src/app/bar/bar',
      skipFormat: true,
    });

    tree.write(
      'foo/src/app/mymodule.module.ts',
      `import { BarModule } from './bar/bar';
      import { ExtraBarComponentModule } from './bar/extra-bar.component';
      
      @NgModule({
        imports: [BarModule, ExtraBarComponentModule]
      })
      export class MyModule {}`
    );

    await scamToStandalone(tree, {
      component: 'src/app/bar/bar.ts',
      project: 'foo',
    });

    expect(tree.read('foo/src/app/bar/bar.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { Component, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        imports: [CommonModule],
        selector: 'app-bar',
        standalone: false,
        templateUrl: './bar.html',
        styleUrl: './bar.css',
      })
      export class Bar {}
      "
    `);

    expect(tree.read('foo/src/app/mymodule.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { Bar } from './bar/bar';
      import { ExtraBarComponentModule } from './bar/extra-bar.component';

      @NgModule({
        imports: [Bar, ExtraBarComponentModule],
      })
      export class MyModule {}
      "
    `);

    expect(tree.read('foo/src/app/bar/bar.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ComponentFixture, TestBed } from '@angular/core/testing';
      import { Bar } from './bar';

      describe('Bar', () => {
        let component: Bar;
        let fixture: ComponentFixture<Bar>;

        beforeEach(async () => {
          await TestBed.configureTestingModule({
            imports: [Bar],
          }).compileComponents();

          fixture = TestBed.createComponent(Bar);
          component = fixture.componentInstance;
          fixture.detectChanges();
        });

        it('should create', () => {
          expect(component).toBeTruthy();
        });
      });
      "
    `);
  });
});
