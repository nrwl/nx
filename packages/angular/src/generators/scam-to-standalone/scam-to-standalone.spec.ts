import { stripIndents, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import scamGenerator from '../scam/scam';
import { generateTestApplication } from '../utils/testing';
import { scamToStandalone } from './scam-to-standalone';

describe('scam-to-standalone', () => {
  it('should convert an inline scam to standalone', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestApplication(tree, { name: 'foo' });
    await scamGenerator(tree, { name: 'bar', project: 'foo' });

    tree.write(
      'apps/foo/src/app/mymodule.module.ts',
      `import { BarComponentModule } from './bar/bar.component';
      
      @NgModule({
        imports: [BarComponentModule]
      })
      export class MyModule {}`
    );

    await scamToStandalone(tree, {
      component: 'src/app/bar/bar.component.ts',
      project: 'foo',
    });

    expect(tree.read('apps/foo/src/app/bar/bar.component.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { Component, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        standalone: true,
        imports: [CommonModule],
        selector: 'proj-bar',
        templateUrl: './bar.component.html',
        styleUrls: ['./bar.component.css'],
      })
      export class BarComponent {}
      "
    `);

    expect(tree.read('apps/foo/src/app/mymodule.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { BarComponent } from './bar/bar.component';

      @NgModule({
        imports: [BarComponent],
      })
      export class MyModule {}
      "
    `);

    expect(tree.read('apps/foo/src/app/bar/bar.component.spec.ts', 'utf-8'))
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

  it('should error correctly when Angular version does not support standalone', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        '@angular/core': '14.0.0',
      },
    }));

    // ACT & ASSERT
    await expect(
      scamToStandalone(tree, {
        component: 'src/app/bar/bar.component.ts',
        project: 'foo',
      })
    ).rejects
      .toThrow(stripIndents`This generator is only supported with Angular >= 14.1.0. You are currently using 14.0.0.
    You can resolve this error by migrating to Angular 14.1.0.`);
  });
});
