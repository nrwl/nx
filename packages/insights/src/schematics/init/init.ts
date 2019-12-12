import { updateJsonInTree } from '@nrwl/workspace';

export default function init() {
  return updateJsonInTree('nx.json', json => {
    return {
      ...json,
      tasksRunnerOptions: {
        default: {
          runner: '@nrwl/insights'
        }
      }
    };
  });
}
