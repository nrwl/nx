import type { Tree } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/devkit';

import type { Schema } from './schema';

export async function storybookCompodocConfig(tree: Tree, schema: Schema) {
  /**
   * 1. Add @compodoc/compodoc to package.json & Install
   * 2. Include the component files in .storybook/tsconfig.json
   * 3. Set compodoc: true
   * 4. Add "compodocArgs": ["-e", "json", "-d", "apps/web"]
   * 5. Add compodoc settings in .storybook/preview.js
   */

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

export default storybookCompodocConfig;
