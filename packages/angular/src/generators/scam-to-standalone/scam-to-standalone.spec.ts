import { scamToStandalone } from './scam-to-standalone';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import applicationGenerator from '../application/application';
import scamGenerator from '../scam/scam';

describe('scam-to-standalone', () => {
  it('should convert an inline scam to standalone', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await applicationGenerator(tree, { name: 'foo' });
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
      "import { Component, OnInit, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
          standalone: true,
          imports: [CommonModule],
        selector: 'proj-bar',
        templateUrl: './bar.component.html',
        styleUrls: ['./bar.component.css']
      })
      export class BarComponent implements OnInit {

        constructor() { }

        ngOnInit(): void {
        }

      }
      "
    `);

    expect(tree.read('apps/foo/src/app/mymodule.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { BarComponent } from './bar/bar.component';
            
            @NgModule({
              imports: [BarComponent]
            })
            export class MyModule {}"
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
            imports: [ BarComponent ]
          })
          .compileComponents();

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
