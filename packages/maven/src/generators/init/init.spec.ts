// import { readNxJson, Tree } from '@nx/devkit';
// import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
// import { initGenerator } from './init';
// import { hasMavenPlugin } from '../../utils/has-maven-plugin';
//
// describe('init', () => {
//   let tree: Tree;
//
//   beforeEach(() => {
//     tree = createTreeWithEmptyWorkspace();
//   });
//
//   it('should add maven plugin to nx.json', async () => {
//     await initGenerator(tree, {});
//     const nxJson = readNxJson(tree);
//     expect(hasMavenPlugin(tree)).toBe(true);
//   });
//
//   it('should add maven wrapper files', async () => {
//     await initGenerator(tree, {});
//     expect(tree.exists('mvnw')).toBe(true);
//     expect(tree.exists('mvnw.cmd')).toBe(true);
//     expect(tree.exists('.mvn/wrapper/maven-wrapper.properties')).toBe(true);
//   });
//
//   it('should create a basic pom.xml if none exists', async () => {
//     await initGenerator(tree, {});
//     expect(tree.exists('pom.xml')).toBe(true);
//     const pomContent = tree.read('pom.xml').toString();
//     expect(pomContent).toContain('<groupId>com.example</groupId>');
//     expect(pomContent).toContain('<artifactId>my-maven-project</artifactId>');
//   });
//
//   it('should not create a pom.xml if one already exists', async () => {
//     tree.write('pom.xml', '<project></project>');
//     await initGenerator(tree, {});
//     const pomContent = tree.read('pom.xml').toString();
//     expect(pomContent).toBe('<project></project>');
//   });
//
//   it('should update nx.json with appropriate namedInputs', async () => {
//     await initGenerator(tree, {});
//     const nxJson = readNxJson(tree);
//     expect(nxJson.namedInputs.default).toContain('{projectRoot}/**/*');
//     expect(nxJson.namedInputs.production).toContain('default');
//     expect(nxJson.namedInputs.production).toContain('!{projectRoot}/src/test/**/*');
//   });
// });
