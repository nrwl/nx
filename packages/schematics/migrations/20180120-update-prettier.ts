import { updateJsonFile } from '../../shared/fileutils';

export default {
  description: 'Update the version of prettier',
  run: () => {
    updateJsonFile('package.json', json => {
      json.devDependencies = {
        ...json.devDependencies,
        prettier: '1.10.2'
      };
    });
  }
};
