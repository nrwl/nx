import { parseGraphDefinition } from './test-utils';

describe('parseGraphDefinition', () => {
  it('should produce an appropriate test graph based on the input definition', () => {
    const testGraph = parseGraphDefinition(
      `
        __default__ ({ "projectsRelationship": "fixed" }):
          - projectD@1.0.0 [js]
            -> depends on projectE
          - projectE@1.0.0 [js:@myorg/projectE]
            -> depends on projectF
          - projectF@1.0.0 [js]
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
              },
            ],
            "group": "__default__",
            "language": "js",
            "relationship": "fixed",
            "version": "1.0.0",
          },
          "projectF": {
            "alternateNameInManifest": undefined,
            "data": {},
            "dependsOn": [],
            "group": "__default__",
            "language": "js",
            "relationship": "fixed",
            "version": "1.0.0",
          },
        },
      }
    `);
  });
});
