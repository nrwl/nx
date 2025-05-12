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

  it('should support non-semver versioning and projects with no current version', () => {
    const testGraph = parseGraphDefinition(
      `
        __default__ ({ "projectsRelationship": "independent" }):
          - projectA@1.0 [non-semver]
          - projectB [non-semver]
      `
    );
    expect(testGraph).toMatchInlineSnapshot(`
      {
        "projects": {
          "projectA": {
            "alternateNameInManifest": undefined,
            "data": {
              "release": {
                "versionActions": "__EXAMPLE_NON_SEMVER_VERSION_ACTIONS__",
              },
            },
            "dependsOn": [],
            "group": "__default__",
            "language": "non-semver",
            "relationship": "independent",
            "version": "1.0",
          },
          "projectB": {
            "alternateNameInManifest": undefined,
            "data": {
              "release": {
                "versionActions": "__EXAMPLE_NON_SEMVER_VERSION_ACTIONS__",
              },
            },
            "dependsOn": [],
            "group": "__default__",
            "language": "non-semver",
            "relationship": "independent",
            "version": null,
          },
        },
      }
    `);
  });

  it('should support complex non-semver version values', () => {
    const testGraph = parseGraphDefinition(
      `
        __default__ ({ "projectsRelationship": "independent" }):
          - projectA@abc123 [non-semver]
          - projectB@2099-01-01.build1 [non-semver]
      `
    );
    expect(testGraph).toMatchInlineSnapshot(`
      {
        "projects": {
          "projectA": {
            "alternateNameInManifest": undefined,
            "data": {
              "release": {
                "versionActions": "__EXAMPLE_NON_SEMVER_VERSION_ACTIONS__",
              },
            },
            "dependsOn": [],
            "group": "__default__",
            "language": "non-semver",
            "relationship": "independent",
            "version": "abc123",
          },
          "projectB": {
            "alternateNameInManifest": undefined,
            "data": {
              "release": {
                "versionActions": "__EXAMPLE_NON_SEMVER_VERSION_ACTIONS__",
              },
            },
            "dependsOn": [],
            "group": "__default__",
            "language": "non-semver",
            "relationship": "independent",
            "version": "2099-01-01.build1",
          },
        },
      }
    `);
  });
});
