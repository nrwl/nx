import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { ProjectConfiguration } from '../../../config/workspace-config-project-config';

import * as nxPlugin from '../../../utils/nx-plugin';
import { DeletedFileChange } from '../../file-utils';
import { getTouchedProjectsFromProjectGlobChanges } from './project-glob-changes';

function makeProjectGraphNode(
  name,
  configurationFile = 'project.json'
): ProjectGraphProjectNode<ProjectConfiguration> {
  return {
    data: {
      files: [
        {
          file: `libs/${name}/${configurationFile}`,
          hash: 'hash' + Math.floor(Math.random() * 10000),
        },
      ],
      root: `libs/${name}`,
    },
    name,
    type: 'lib',
  };
}

describe('getTouchedProjectsFromProjectGlobChanges', () => {
  beforeEach(() => {
    jest.spyOn(nxPlugin, 'loadNxPlugins').mockReturnValue([]);
  });

  it('should affect all projects if a project is removed', () => {
    const result = getTouchedProjectsFromProjectGlobChanges(
      [
        {
          file: 'libs/proj1/project.json',
          hash: 'some-hash',
          getChanges: () => [new DeletedFileChange()],
        },
      ],
      {
        proj2: makeProjectGraphNode('proj2'),
        proj3: makeProjectGraphNode('proj3'),
      },
      {
        plugins: [],
      }
    );
    expect(result).toEqual(['proj2', 'proj3']);
  });
});
