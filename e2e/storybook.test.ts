import {
  forEachCli,
  runCLI,
  supportUi,
  uniq,
  ensureProject,
  tmpProjPath
} from './utils';
import { writeFileSync } from 'fs';

forEachCli(() => {
  describe('Storybook schematics', () => {
    if (supportUi()) {
      describe('running Storybook and Cypress', () => {
        it('should execute e2e tests using Cypress running against Storybook', () => {
          ensureProject();

          const myapp = uniq('myapp');
          runCLI(`generate @nrwl/angular:app ${myapp} --no-interactive`);

          const mylib = uniq('test-ui-lib');
          createTestUILib(mylib);

          const mylib2 = uniq('test-ui-lib2');
          createTestUILib(mylib2);

          runCLI(
            `generate @nrwl/storybook:configuration ${mylib} --configureCypress --generateStories --generateCypressSpecs --no-interactive`
          );
          runCLI(
            `generate @nrwl/storybook:configuration ${mylib} --no-interactive`
          );
          runCLI(
            `generate @nrwl/storybook:configuration ${mylib2} --configureCypress --generateStories --generateCypressSpecs --no-interactive`
          );

          expect(
            runCLI(`run ${mylib}-e2e:e2e --configuration=headless --no-watch`)
          ).toContain('All specs passed!');
        }, 1000000);
      });
    }
  });
});

export function createTestUILib(libName: string): void {
  runCLI(`g @nrwl/angular:library ${libName} --no-interactive`);
  runCLI(
    `g @schematics/angular:component test-button --project=${libName} --no-interactive`
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
  @Input() isOn = false;

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
    `<button [attr.type]="type" [ngClass]="style"></button>`
  );
  runCLI(
    `g @schematics/angular:component test-other --project=${libName} --no-interactive`
  );
}
