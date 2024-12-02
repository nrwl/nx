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
      `import { BarComponentModule } from './bar/bar.component';
      import { ExtraBarComponentModule } from './bar/extra-bar.component';
      
      @NgModule({
        imports: [BarComponentModule, ExtraBarComponentModule]
      })
      export class MyModule {}`
    );

    await scamToStandalone(tree, {
      component: 'src/app/bar/bar.component.ts',
      project: 'foo',
    });

    expect(tree.read('foo/src/app/bar/bar.component.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { Component, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        imports: [CommonModule],
        selector: 'app-bar',
        standalone: false,
        templateUrl: './bar.component.html',
        styleUrl: './bar.component.css',
      })
      export class BarComponent {}
      "
    `);

    expect(tree.read('foo/src/app/mymodule.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { BarComponent } from './bar/bar.component';
      import { ExtraBarComponentModule } from './bar/extra-bar.component';

      @NgModule({
        imports: [BarComponent, ExtraBarComponentModule],
      })
      export class MyModule {}
      "
    `);

    expect(tree.read('foo/src/app/bar/bar.component.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ComponentFixture, TestBed } from '@angular/core/testing';
      import { BarComponent } from './bar.component';

      describe('BarComponent', () => {
        let component: BarComponent;
        let fixture: ComponentFixture<BarComponent>;

        beforeEach(async () => {
          await TestBed.configureTestingModule({
            imports: [BarComponent],
          }).compileComponents();

          fixture = TestBed.createComponent(BarComponent);
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
