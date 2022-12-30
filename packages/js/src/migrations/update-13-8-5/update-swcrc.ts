import {
  formatFiles,
  getProjects,
  readJson,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { join } from 'path';
import { defaultExclude } from '../../utils/swc/add-swc-config';

export default async function update(host: Tree) {
  const projects = getProjects(host);

  for (const config of projects.values()) {
    if (config?.targets?.build?.executor !== '@nrwl/js:swc') continue;

    const swcrcPath = join(config.root, '.swcrc');
    if (!host.exists(swcrcPath)) continue;

    // rename
    const libSwcrcPath = join(config.root, '.lib.swcrc');
    host.rename(swcrcPath, libSwcrcPath);

    const swcrcContent = readJson(host, libSwcrcPath);

    // skip if swcrc already has "exclude" field
    if (swcrcContent['exclude']) continue;

    // check swcExclude build options
    const exclude =
      config?.targets?.build?.options['swcExclude'] || defaultExclude;
    updateJson(host, libSwcrcPath, (swcrc) => {
      swcrc['exclude'] = exclude;
      return swcrc;
    });
  }

  await formatFiles(host);
}
