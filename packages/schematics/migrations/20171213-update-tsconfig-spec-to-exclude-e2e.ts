import { updateJsonFile } from '../../shared/fileutils';

export default {
  description: 'Update tsconfig.spec.json to exclude e2e specs',
  run: () => {
    updateJsonFile('tsconfig.spec.json', json => {
      if (!json.exclude) {
        json.exclude = ['node_modules', 'tmp'];
      }
      json.exclude = [...json.exclude, '**/e2e/*.ts', '**/*.e2e-spec.ts', '**/*.po.ts'];
    });
  }
};
