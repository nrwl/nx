import { findAllNpmDependencies } from './find-all-npm-dependencies';
import { ProjectGraph } from '@nrwl/workspace/src/core/project-graph';

test('findAllNpmDependencies', () => {
  const graph: ProjectGraph = {
    nodes: {
      myapp: {
        type: 'app',
        name: 'myapp',
        data: { files: [] },
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
    },
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
      'npm:@nrwl/react-native': {
        type: 'npm',
        name: 'npm:@nrwl/react-native',
        data: {
          version: '1',
          packageName: '@nrwl/react-native',
        },
      },
    },
    dependencies: {
      myapp: [
        { type: 'static', source: 'myapp', target: 'lib1' },
        { type: 'static', source: 'myapp', target: 'lib2' },
        {
          type: 'static',
          source: 'myapp',
          target: 'npm:react-native-image-picker',
        },
        {
          type: 'static',
          source: 'myapp',
          target: 'npm:@nrwl/react-native',
        },
      ],
      lib1: [
        { type: 'static', source: 'lib1', target: 'lib2' },
        { type: 'static', source: 'lib3', target: 'npm:react-native-snackbar' },
      ],
      lib2: [{ type: 'static', source: 'lib2', target: 'lib3' }],
      lib3: [
        { type: 'static', source: 'lib3', target: 'npm:react-native-dialog' },
      ],
    },
  };

  const result = findAllNpmDependencies(graph, 'myapp');

  expect(result).toEqual([
    'react-native-dialog',
    'react-native-snackbar',
    'react-native-image-picker',
  ]);
});
