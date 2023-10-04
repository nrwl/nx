import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { ProjectConfiguration } from '../../../config/workspace-json-project-json';

import * as nxPlugin from '../../../utils/nx-plugin';
import { DeletedFileChange } from '../../file-utils';
import { getTouchedProjectsFromProjectGlobChanges } from './project-glob-changes';

describe('getTouchedProjectsFromProjectGlobChanges', () => {
  it('empty', () => {});
});

// describe('getTouchedProjectsFromProjectGlobChanges', () => {
//   beforeEach(() => {
//     jest.spyOn(nxPlugin, 'loadNxPlugins').mockResolvedValue([]);
//   });
//
//   it('should affect all projects if a project is removed', async () => {
//     const result = await getTouchedProjectsFromProjectGlobChanges(
//       [
//         {
//           file: 'libs/proj1/project.json',
//           hash: 'some-hash',
//           getChanges: () => [new DeletedFileChange()],
//         },
//       ],
//       {
//         proj2: makeProjectGraphNode('proj2'),
//         proj3: makeProjectGraphNode('proj3'),
//       },
//       {
//         plugins: [],
//       }
//     );
//     expect(result).toEqual(['proj2', 'proj3']);
//   });
// });

// function makeProjectGraphNode(
//   name,
//   configurationFile = 'project.json'
// ): ProjectGraphProjectNode {
//   return {
//     data: {
//       files: [
//         {
//           file: `libs/${name}/${configurationFile}`,
//           hash: 'hash' + Math.floor(Math.random() * 10000),
//         },
//       ],
//       root: `libs/${name}`,
//     },
//     name,
//     type: 'lib',
//   };
// }
