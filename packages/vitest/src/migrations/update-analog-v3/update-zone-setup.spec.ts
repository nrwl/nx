import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateJson } from '@nx/devkit';
import updateZoneSetup from './update-zone-setup';

describe('Analog Zone setup migration', () => {
  it.each(['3.0.0-beta.44', '~2.7.3'])(
    'handles %s idempotently',
    async (version) => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (pkg) => ({
        ...pkg,
        devDependencies: { '@analogjs/vitest-angular': version },
      }));
      const file = 'libs/example/src/test-setup.ts';
      const legacy = '@analogjs/vite-plugin-angular/setup-vitest';
      const before = `// ${legacy}\nimport '${legacy}';\n`;
      tree.write(file, before);
      await updateZoneSetup(tree);
      await updateZoneSetup(tree);
      expect(tree.read(file, 'utf-8')).toBe(
        version.startsWith('3')
          ? `// ${legacy}\nimport '@analogjs/vitest-angular/setup-zone';\n`
          : before
      );
    }
  );
});
