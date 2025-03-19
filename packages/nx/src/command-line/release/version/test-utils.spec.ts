import { parseGraphDefinition } from './test-utils';

describe('parseGraphDefinition', () => {
  it('should produce an appropriate test graph based on the input definition', () => {
    const testGraph = parseGraphDefinition(
      `
        __default__ ({ "projectsRelationship": "fixed" }):
          - projectD@1.0.0 [js]
            -> depends on projectE(workspace:*)
          - projectE@1.0.0 [js:@myorg/projectE]
            -> depends on projectF
          - projectF[custom/project/root/for/projectF]@1.0.0 [js]
            -> release config overrides { "version": { "manifestRootsToUpdate": ["dist/something-custom/package.json"] } }
      `
    );
    expect(testGraph).toMatchInlineSnapshot(`
      {
        "projects": {
          "projectD": {
            "alternateNameInManifest": undefined,
            "data": {},
            "dependsOn": [
              {
                "collection": "dependencies",
                "prefix": "",
                "project": "projectE",
                "versionSpecifier": "workspace:*",
              },
            ],
            "group": "__default__",
            "language": "js",
            "relationship": "fixed",
            "version": "1.0.0",
          },
          "projectE": {
            "alternateNameInManifest": "@myorg/projectE",
            "data": {},
            "dependsOn": [
              {
                "collection": "dependencies",
                "prefix": "",
                "project": "projectF",
                "versionSpecifier": undefined,
              },
            ],
            "group": "__default__",
            "language": "js",
            "relationship": "fixed",
            "version": "1.0.0",
          },
          "projectF": {
            "alternateNameInManifest": undefined,
            "data": {
              "root": "custom/project/root/for/projectF",
            },
            "dependsOn": [],
            "group": "__default__",
            "language": "js",
            "relationship": "fixed",
            "releaseConfigOverrides": {
              "version": {
                "manifestRootsToUpdate": [
                  "dist/something-custom/package.json",
                ],
              },
            },
            "version": "1.0.0",
          },
        },
      }
    `);
  });
});
