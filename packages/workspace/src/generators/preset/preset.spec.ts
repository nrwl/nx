import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { presetGenerator } from './preset';

describe('preset', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  // TODO: reenable. This doesn't work because wrapAngularDevkit uses the fs
  xdescribe('--preset', () => {
    describe('angular', () => {
      it('should create files (preset = angular)', async () => {
        await presetGenerator(tree, {
          name: 'proj',
          preset: 'angular',
          cli: 'nx',
        });
        expect(tree.children('apps/proj')).toMatchSnapshot();
        expect(tree.children('apps/proj/src/')).toMatchSnapshot();
        expect(tree.children('apps/proj/src/app')).toMatchSnapshot();
        console.log(tree.children(''));

        expect(
          JSON.parse(tree.read('/workspace.json').toString()).cli
            .defaultCollection
        ).toBe('@nrwl/angular');
      });
    });
  });

  // it('should create files (preset = react)', async () => {
  //   const tree = await runSchematic(
  //     'preset',
  //     { name: 'proj', preset: 'react' },
  //     tree
  //   );
  //   expect(tree.exists('/apps/proj/src/main.tsx')).toBe(true);
  //   expect(
  //     JSON.parse(tree.readContent('/workspace.json')).cli.defaultCollection
  //   ).toBe('@nrwl/react');
  // });
  //
  // it('should create files (preset = web-components)', async () => {
  //   const tree = await runSchematic(
  //     'preset',
  //     { name: 'proj', preset: 'web-components' },
  //     tree
  //   );
  //   expect(tree.exists('/apps/proj/src/main.ts')).toBe(true);
  //   expect(
  //     JSON.parse(tree.readContent('/workspace.json')).cli.defaultCollection
  //   ).toBe('@nrwl/web');
  // });
  //
  // it('should create files (preset = next)', async () => {
  //   const tree = await runSchematic(
  //     'preset',
  //     { name: 'proj', preset: 'next' },
  //     tree
  //   );
  //   expect(tree.exists('/apps/proj/pages/index.tsx')).toBe(true);
  //   expect(
  //     JSON.parse(tree.readContent('/workspace.json')).cli.defaultCollection
  //   ).toBe('@nrwl/next');
  // });
  //
  // describe('--preset angular-nest', () => {
  //   it('should create files', async () => {
  //     const tree = await runSchematic(
  //       'preset',
  //       { name: 'proj', preset: 'angular-nest' },
  //       tree
  //     );
  //     expect(tree.exists('/apps/proj/src/app/app.component.ts')).toBe(true);
  //     expect(tree.exists('/apps/api/src/app/app.controller.ts')).toBe(true);
  //     expect(
  //       tree.exists('/libs/api-interfaces/src/lib/api-interfaces.ts')
  //     ).toBe(true);
  //   });
  //
  //   it('should work with unnormalized names', async () => {
  //     const tree = await runSchematic(
  //       'preset',
  //       { name: 'myProj', preset: 'angular-nest' },
  //       tree
  //     );
  //
  //     expect(tree.exists('/apps/my-proj/src/app/app.component.ts')).toBe(true);
  //     expect(tree.exists('/apps/api/src/app/app.controller.ts')).toBe(true);
  //     expect(
  //       tree.exists('/libs/api-interfaces/src/lib/api-interfaces.ts')
  //     ).toBe(true);
  //   });
  // });
  //
  // describe('--preset react-express', () => {
  //   it('should create files', async () => {
  //     const tree = await runSchematic(
  //       'preset',
  //       { name: 'proj', preset: 'react-express' },
  //       tree
  //     );
  //     expect(tree.exists('/apps/proj/src/app/app.tsx')).toBe(true);
  //     expect(
  //       tree.exists('/libs/api-interfaces/src/lib/api-interfaces.ts')
  //     ).toBe(true);
  //     expect(tree.exists('/apps/proj/.eslintrc.json')).toBe(true);
  //     expect(tree.exists('/apps/api/.eslintrc.json')).toBe(true);
  //     expect(tree.exists('/libs/api-interfaces/.eslintrc.json')).toBe(true);
  //   });
  //
  //   it('should work with unnormalized names', async () => {
  //     const tree = await runSchematic(
  //       'preset',
  //       { name: 'myProj', preset: 'react-express' },
  //       tree
  //     );
  //
  //     expect(tree.exists('/apps/my-proj/src/app/app.tsx')).toBe(true);
  //     expect(
  //       tree.exists('/libs/api-interfaces/src/lib/api-interfaces.ts')
  //     ).toBe(true);
  //   });
  // });
});
