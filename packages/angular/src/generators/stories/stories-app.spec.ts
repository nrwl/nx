import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { componentGenerator } from '../component/component';
import { scamGenerator } from '../scam/scam';
import { generateTestApplication } from '../utils/testing';
import { angularStoriesGenerator } from './stories';
import { stripIndents } from '@nx/devkit';

// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');

// TODO(katerina): Nx 19 -> remove Cypress

describe('angularStories generator: applications', () => {
  let tree: Tree;
  const appName = 'test-app';
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestApplication(tree, {
      name: appName,
      skipFormat: true,
    });
  });

  it('should generate stories file with interaction tests', async () => {
    await angularStoriesGenerator(tree, { name: appName });

    expect(
      tree.read(`${appName}/src/app/app.component.stories.ts`, 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate stories file for scam component', async () => {
    await scamGenerator(tree, {
      name: 'my-scam',
      project: appName,
      skipFormat: true,
    });

    await angularStoriesGenerator(tree, { name: appName });

    expect(
      tree.exists(`${appName}/src/app/my-scam/my-scam.component.stories.ts`)
    ).toBeTruthy();
  });

  it('should ignore paths', async () => {
    await scamGenerator(tree, {
      name: 'my-scam',
      project: appName,
      skipFormat: true,
    });

    await angularStoriesGenerator(tree, {
      name: appName,
      ignorePaths: [`${appName}/src/app/my-scam/**`],
      skipFormat: true,
    });

    expect(
      tree.exists(`${appName}/src/app/my-scam/my-scam.component.stories.ts`)
    ).toBeFalsy();
  });

  it('should ignore paths when full path to component is provided', async () => {
    await scamGenerator(tree, {
      name: 'my-scam',
      project: appName,
      skipFormat: true,
    });

    await angularStoriesGenerator(tree, {
      name: appName,
      ignorePaths: [`${appName}/src/app/my-scam/my-scam.component.ts`],
      skipFormat: true,
    });

    expect(
      tree.exists(`${appName}/src/app/my-scam/my-scam.component.stories.ts`)
    ).toBeFalsy();
  });

  it('should ignore a path that has a nested component, but still generate nested component stories', async () => {
    await componentGenerator(tree, {
      name: 'component-a',
      project: appName,
      skipFormat: true,
    });
    await componentGenerator(tree, {
      name: 'component-a/component-b',
      project: appName,
      skipFormat: true,
    });

    await angularStoriesGenerator(tree, {
      name: appName,
      ignorePaths: [`${appName}/src/app/component-a/component-a.component.ts`],
      skipFormat: true,
    });

    expect(
      tree.read(
        `${appName}/src/app/component-a/component-b/component-b.component.stories.ts`,
        'utf-8'
      )
    ).toMatchSnapshot();
    expect(
      tree.exists(
        `${appName}/src/app/component-a/component-a.component.stories.ts`
      )
    ).toBeFalsy();
  });

  it('should ignore a path when using a routing module', async () => {
    tree.write(
      `${appName}/src/app/component/component.module.ts`,
      stripIndents`
      import { NgModule } from '@angular/core';
      
      @NgModule({})
      export class ComponentModule {}
      `
    );
    tree.write(
      `${appName}/src/app/component/component-routing.module.ts`,
      stripIndents`
      import { NgModule } from '@angular/core';
      import { RouterModule, Routes } from '@angular/router';
      
      const routes: Routes = [];
      
      @NgModule({
        imports: [RouterModule.forChild(routes)],
        exports: [RouterModule],
      })
      export class ComponentRoutingModule {}
      `
    );
    await componentGenerator(tree, {
      name: 'component/component',
      project: appName,
      flat: true,
      skipFormat: true,
    });

    await angularStoriesGenerator(tree, {
      name: appName,
      ignorePaths: [`${appName}/src/app/app.component.ts`],
      skipFormat: true,
    });

    expect(
      tree.read(
        `${appName}/src/app/component/component.component.stories.ts`,
        'utf-8'
      )
    ).toMatchSnapshot();
    expect(
      tree.exists(`${appName}/src/app/app.component.stories.ts`)
    ).toBeFalsy();
  });

  it('should generate stories file for inline scam component', async () => {
    await scamGenerator(tree, {
      name: 'my-scam',
      project: appName,
      inlineScam: true,
      skipFormat: true,
    });

    await angularStoriesGenerator(tree, { name: appName, skipFormat: true });

    expect(
      tree.read(
        `${appName}/src/app/my-scam/my-scam.component.stories.ts`,
        'utf-8'
      )
    ).toMatchSnapshot();
  });
});
