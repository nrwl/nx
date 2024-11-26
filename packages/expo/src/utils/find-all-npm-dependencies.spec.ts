import { findAllNpmDependencies } from './find-all-npm-dependencies';
import { DependencyType, ProjectGraph } from '@nx/devkit';

const graphFixture: ProjectGraph = {
  nodes: {
    myapp: {
      type: 'app',
      name: 'myapp',
      data: { files: [], implicitDependencies: ['lib4'] },
    },
    lib1: {
      type: 'lib',
      name: 'lib1',
      data: { files: [] },
    },
    lib2: {
      type: 'lib',
      name: 'lib2',
      data: { files: [] },
    },
    lib3: {
      type: 'lib',
      name: 'lib3',
      data: { files: [] },
    },
    lib4: {
      type: 'lib',
      name: 'lib4',
      data: { files: [] },
    },
  } as any,
  externalNodes: {
    'npm:react-native-image-picker': {
      type: 'npm',
      name: 'npm:react-native-image-picker',
      data: {
        version: '1',
        packageName: 'react-native-image-picker',
      },
    },
    'npm:react-native-dialog': {
      type: 'npm',
      name: 'npm:react-native-dialog',
      data: {
        version: '1',
        packageName: 'react-native-dialog',
      },
    },
    'npm:react-native-snackbar': {
      type: 'npm',
      name: 'npm:react-native-snackbar',
      data: {
        version: '1',
        packageName: 'react-native-snackbar',
      },
    },
    'npm:@nx/react-native': {
      type: 'npm',
      name: 'npm:@nx/react-native',
      data: {
        version: '1',
        packageName: '@nx/react-native',
      },
    },
    'npm:axios': {
      type: 'npm',
      name: 'npm:axios',
      data: {
        version: '1',
        packageName: 'axios',
      },
    },
  },
  dependencies: {
    myapp: [
      { type: DependencyType.static, source: 'myapp', target: 'lib1' },
      { type: DependencyType.static, source: 'myapp', target: 'lib2' },
      { type: DependencyType.implicit, source: 'myapp', target: 'lib4' },
      {
        type: DependencyType.static,
        source: 'myapp',
        target: 'npm:react-native-image-picker',
      },
      {
        type: DependencyType.static,
        source: 'myapp',
        target: 'npm:@nx/react-native',
      },
    ],
    lib1: [
      { type: DependencyType.static, source: 'lib1', target: 'lib2' },
      {
        type: DependencyType.static,
        source: 'lib3',
        target: 'npm:react-native-snackbar',
      },
    ],
    lib2: [{ type: DependencyType.static, source: 'lib2', target: 'lib3' }],
    lib3: [
      {
        type: DependencyType.static,
        source: 'lib3',
        target: 'npm:react-native-dialog',
      },
    ],
    lib4: [
      {
        type: DependencyType.static,
        source: 'lib4',
        target: 'npm:axios',
      },
    ],
  },
};

describe('findAllNpmDependencies', () => {
  it('should return all npm dependencies of a project', () => {
    const result = findAllNpmDependencies(graphFixture, 'myapp');

    expect(result).toEqual([
      'react-native-dialog',
      'react-native-snackbar',
      'axios',
      'react-native-image-picker',
    ]);
  });

  describe('when passed excludeImplicit option', () => {
    it('should exclude implicit dependencies when `excludeImplicit` flag is true', () => {
      const result = findAllNpmDependencies(
        graphFixture,
        'myapp',
        { excludeImplicit: true },
        new Set()
      );

      expect(result).toEqual([
        'react-native-dialog',
        'react-native-snackbar',
        'react-native-image-picker',
      ]);
    });

    it('should include implicit dependencies when `excludeImplicit` flag is false', () => {
      const result = findAllNpmDependencies(
        graphFixture,
        'myapp',
        { excludeImplicit: false },
        new Set()
      );

      expect(result).toEqual([
        'react-native-dialog',
        'react-native-snackbar',
        'axios',
        'react-native-image-picker',
      ]);
    });
  });
});
