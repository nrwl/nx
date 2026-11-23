import {
  formatFiles,
  type Tree,
  updateJson,
  visitNotIgnoredFiles,
} from '@nx/devkit';

type BabelPresetEntry = [
  string,
  { loose?: boolean; classProperties?: { loose?: boolean } }?,
];

interface BabelConfig {
  presets?: Array<string | BabelPresetEntry>;
}

export default async function updateBabelLoose(tree: Tree) {
  visitNotIgnoredFiles(tree, '', (path) => {
    if (!path.endsWith('.babelrc')) return;
    try {
      updateJson<BabelConfig>(tree, path, (babelConfig) => {
        if (!Array.isArray(babelConfig.presets)) return babelConfig;
        const ourPreset = babelConfig.presets.find(
          (p): p is BabelPresetEntry =>
            Array.isArray(p) && p[0] === '@nx/react/babel'
        );
        if (!ourPreset || !ourPreset[1]) return babelConfig;
        const options = ourPreset[1];
        if (options['classProperties']?.loose !== undefined) {
          options.loose = options['classProperties'].loose;
          delete options['classProperties'];
        }
        return babelConfig;
      });
    } catch {
      // Skip if JSON does not parse for whatever reason
      return;
    }
  });
  await formatFiles(tree);
}
