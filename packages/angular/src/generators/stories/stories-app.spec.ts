import 'nx/src/internal-testing-utils/mock-project-graph';

import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { componentGenerator } from '../component/component';
import { scamGenerator } from '../scam/scam';
import { generateTestApplication } from '../utils/testing';
import { angularStoriesGenerator } from './stories';
import { stripIndents } from '@nx/devkit';

describe('angularStories generator: applications', () => {
  let tree: Tree;
  const appName = 'test-app';

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestApplication(tree, {
      directory: appName,
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
      path: `${appName}/src/app/my-scam/my-scam`,
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
      path: `${appName}/src/app/my-scam/my-scam`,
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
      path: `${appName}/src/app/my-scam/my-scam`,
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
      path: `${appName}/src/app/component-a/component-a`,
      skipFormat: true,
    });
    await componentGenerator(tree, {
      name: 'component-b',
      path: `${appName}/src/app/component-a/component-b/component-b`,
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
      name: 'component',
      path: `${appName}/src/app/component/component`,
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
      path: `${appName}/src/app/my-scam/my-scam`,
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
