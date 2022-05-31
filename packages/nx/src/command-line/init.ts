import { execSync } from 'child_process';
import { join } from 'path';
import { output } from '../utils/output';
import { getPackageManagerCommand } from '../utils/package-manager';
import { fileExists } from '../utils/workspace-root';
import { readJsonFile, writeJsonFile } from '../utils/fileutils';

export function initHandler() {
  const nxIsInstalled = !!execSync(getPackageManagerCommand().list)
    .toString()
    .split('\n')
    .find((line) => line.indexOf(' nx@') > -1);

  if (nxIsInstalled) {
    output.log({
      title: 'Nx is already installed',
    });
  } else {
    output.log({
      title: 'Installing Nx...',
    });
    execSync(`${getPackageManagerCommand().addDev} nx@latest`, {
      stdio: [0, 1, 2],
    });
    output.success({
      title: 'Nx has been installed',
    });
  }

  if (!fileExists('nx.json')) {
    writeJsonFile(
      'nx.json',
      readJsonFile(join(__dirname, '..', '..', 'presets', 'core.json'))
    );

    output.success({
      title: 'nx.json has been created',
    });
  }
}
