import { registerCompletion } from '../completion/metadata';
import { readNxPackageGroup } from '../../utils/nx-package-group';

// Same list `nx report` uses. Filter to first-party plugins and sort.
const FIRST_PARTY_PLUGINS: string[] = readNxPackageGroup()
  .filter((p) => p.startsWith('@nx/'))
  .sort();

registerCompletion('add', {
  positionals: [
    {
      complete: (current) =>
        FIRST_PARTY_PLUGINS.filter((p) => p.startsWith(current)),
    },
  ],
});
