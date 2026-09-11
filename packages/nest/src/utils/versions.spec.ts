import { type Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { versions } from './versions';

describe('versions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function declareNestJs(
    version: string,
    field: 'dependencies' | 'devDependencies' = 'dependencies'
  ): void {
    updateJson(tree, 'package.json', (json) => {
      json[field] = { ...json[field], '@nestjs/core': version };
      return json;
    });
  }

  it('installs the latest supported major when NestJS is absent', () => {
    expect(versions(tree)).toEqual({
      nestJsVersion: '^12.0.0',
      nestJsSchematicsVersion: '^12.0.0',
      rxjsVersion: '^7.8.0',
      reflectMetadataVersion: '^0.2.0',
    });
  });

  // Asserting the whole object catches a major that silently borrows another
  // one's versions, which is how a v12 workspace ended up on v11.
  it.each([
    [
      '^10.0.0',
      {
        nestJsVersion: '^10.0.2',
        nestJsSchematicsVersion: '^10.0.1',
        rxjsVersion: '^7.8.0',
        reflectMetadataVersion: '^0.1.13',
      },
    ],
    [
      '^11.0.0',
      {
        nestJsVersion: '^11.0.0',
        nestJsSchematicsVersion: '^11.0.0',
        rxjsVersion: '^7.8.0',
        reflectMetadataVersion: '^0.2.0',
      },
    ],
    [
      '^12.0.1',
      {
        nestJsVersion: '^12.0.0',
        nestJsSchematicsVersion: '^12.0.0',
        rxjsVersion: '^7.8.0',
        reflectMetadataVersion: '^0.2.0',
      },
    ],
  ])('keeps a workspace on %s at its own major', (declared, expected) => {
    declareNestJs(declared);

    expect(versions(tree)).toEqual(expected);
  });

  it('reads @nestjs/core from devDependencies', () => {
    declareNestJs('^10.0.0', 'devDependencies');

    expect(versions(tree)).toMatchObject({ nestJsVersion: '^10.0.2' });
  });
});
