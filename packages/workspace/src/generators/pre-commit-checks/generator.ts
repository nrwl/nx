import {
  addDependenciesToPackageJson,
  detectPackageManager,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getPackageManagerCommand,
  getPackageManagerVersion,
  joinPathFragments,
  PackageManager,
  Tree,
  updateJson,
} from '@nx/devkit';
import { PreCommitChecksGeneratorSchema } from './schema';
import { PackageJson } from 'nx/src/utils/package-json';
import {
  huskyVersion,
  pinstVersion,
  commitlintVersion,
  lintStagedVersion,
} from '../../utils/versions';
import { gte } from 'semver';

interface NormalizedSchema extends PreCommitChecksGeneratorSchema {
  enableCommitlint: boolean;
}

function normalizeSchema(
  schema: PreCommitChecksGeneratorSchema
): NormalizedSchema {
  return {
    ...schema,
    enableCommitlint: schema.enableCommitlint ?? true,
  };
}

function appendScriptInPlace(
  pkg: PackageJson,
  scriptName: string,
  cmd: string
) {
  pkg.scripts ??= {};

  if (pkg.scripts[scriptName]) {
    if (!pkg.scripts[scriptName].includes(cmd)) {
      pkg.scripts[scriptName] += ` && ${cmd}`;
    }
  } else {
    pkg.scripts[scriptName] = cmd;
  }
}

function createFiles(
  tree: Tree,
  schema: NormalizedSchema,
  packageManager: PackageManager
) {
  const pmc = getPackageManagerCommand(packageManager);

  const options = {
    execCmd: pmc.exec,
  };

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files/common'),
    '',
    options
  );
  updateChmodOnFile(tree, '.husky/pre-commit');

  if (schema.enableCommitlint) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, 'files/commitlint'),
      '',
      options
    );
    updateChmodOnFile(tree, '.husky/commit-msg');
  }
}

function installPreCommitDependencies(
  tree: Tree,
  params: { installPinst: boolean; enableCommitlint: boolean }
): GeneratorCallback {
  const devDependencies = {
    husky: huskyVersion,
    'lint-staged': lintStagedVersion,
  };
  if (params.installPinst) {
    devDependencies['pinst'] = pinstVersion;
  }
  if (params.enableCommitlint) {
    devDependencies['@commitlint/cli'] = commitlintVersion;
    devDependencies['@commitlint/config-conventional'] = commitlintVersion;
  }
  return addDependenciesToPackageJson(tree, {}, devDependencies);
}

function updateChmodOnFile(tree: Tree, filePath: string) {
  // making the file executable
  tree.write(filePath, tree.read(filePath), { mode: '755' });
}

export async function preCommitChecksGenerator(
  tree: Tree,
  opts: PreCommitChecksGeneratorSchema
) {
  const normalizedSchema = normalizeSchema(opts);

  const pm = detectPackageManager(tree.root);
  let isYarn2 = false;
  let installPinst = false;

  if (pm === 'yarn') {
    const yarnVersion = getPackageManagerVersion('yarn');
    isYarn2 = gte(yarnVersion, '2.0.0');
  }

  updateJson(tree, 'package.json', (packageJson: PackageJson) => {
    if (isYarn2) {
      // Yarn 2+ doesn't support prepare lifecycle script,
      // so husky needs to be installed differently (this doesn't apply to Yarn 1 though).
      // See https://typicode.github.io/husky/getting-started.html#yarn-2
      appendScriptInPlace(packageJson, 'postinstall', 'husky install');
      if (packageJson.private !== true) {
        appendScriptInPlace(packageJson, 'prepack', 'pinst --disable');
        appendScriptInPlace(packageJson, 'postpack', 'pinst --enable');
        installPinst = true;
      }
    } else {
      appendScriptInPlace(packageJson, 'prepare', 'husky install');
    }

    return packageJson;
  });

  createFiles(tree, normalizedSchema, pm);

  if (!normalizedSchema.skipFormat) {
    await formatFiles(tree);
  }

  return installPreCommitDependencies(tree, {
    installPinst,
    enableCommitlint: normalizedSchema.enableCommitlint,
  });
}

export default preCommitChecksGenerator;
