import { PromiseExecutor, readJsonFile, workspaceRoot } from '@nx/devkit';
import * as esbuild from 'esbuild';
import {
  cpSync,
  existsSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import * as semver from 'semver';

import { BundleRulesExecutorSchema } from './schema';

interface RuleFiles {
  indexPath: string;
  schemaPath: string;
  ruleName: string;
}

/**
 * Ajv wouldn't give us anything beyond JSON syntax validation here (which we already get from readJsonFile),
 * so we don't bother using it and assert things manually.
 */
function validateSchema(schemaPath: string): void {
  const schema = readJsonFile(schemaPath);
  const requiredFields = ['$schema', 'type'];
  const missingFields = requiredFields.filter((field) => !(field in schema));
  if (missingFields.length > 0) {
    throw new Error(
      `Schema in ${schemaPath} is missing required fields: ${missingFields.join(', ')}. ` +
        'Schemas must include $schema and type.'
    );
  }
  if (schema.type !== 'object') {
    throw new Error(`Schema in ${schemaPath} must have "type": "object"`);
  }
}

function getExternalPatterns(): string[] {
  return ['nx', 'nx/package.json', '@nx/*'];
}

function getNxVersionRange(): string {
  const nxVersion = require('nx/package.json').version;
  return `^${semver.major(nxVersion)}`;
}

function getPackageNameFromImport(importPath: string): string {
  // Handle scoped packages like @nx/devkit
  if (importPath.startsWith('@')) {
    const [scope, pkg] = importPath.split('/');
    return `${scope}/${pkg.split('/')[0]}`;
  }
  // Handle regular packages like nx
  return importPath.split('/')[0];
}

function getDependenciesForRule(
  metafile: esbuild.Metafile,
  nxVersionRange: string
): Record<string, string> {
  const dependencies: Record<string, string> = {};
  // Get all unique imports across all entry points
  const imports = new Set<string>();
  Object.values(metafile.outputs).forEach((output) => {
    Object.keys(output.imports).forEach((imp) => {
      // The 'path' property contains the imported package name
      imports.add(output.imports[imp].path);
    });
  });

  const nxImports = Array.from(imports).filter(
    (imp) => imp === 'nx' || imp.startsWith('nx/') || imp.startsWith('@nx/')
  );

  // nx and every @nx/* package release in lockstep
  nxImports.forEach((imp) => {
    dependencies[getPackageNameFromImport(imp)] = nxVersionRange;
  });

  return dependencies;
}

function validateRuleDirectory(
  rulePath: string,
  ruleName: string
): RuleFiles | null {
  const indexPath = join(rulePath, 'index.ts');
  const schemaPath = join(rulePath, 'schema.json');
  if (!existsSync(indexPath) || !existsSync(schemaPath)) {
    throw new Error(
      `Directory ${ruleName} is missing required files (index.ts and/or schema.json)`
    );
  }
  validateSchema(schemaPath);
  return { indexPath, schemaPath, ruleName };
}

function discoverRules(srcDir: string): RuleFiles[] {
  try {
    const entries = readdirSync(srcDir, { withFileTypes: true });
    const rules: RuleFiles[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const rulePath = join(srcDir, entry.name);
        // This will throw if validation fails
        const rule = validateRuleDirectory(rulePath, entry.name);
        if (rule) {
          rules.push(rule);
        }
      }
    }

    if (rules.length === 0) {
      throw new Error(
        'No valid rules found. Each rule must be in its own directory containing both index.ts and schema.json files.'
      );
    }

    return rules;
  } catch (err: any) {
    throw new Error(`Failed to discover rules: ${err.message}`);
  }
}

const runExecutor: PromiseExecutor<BundleRulesExecutorSchema> = async (
  options,
  context
) => {
  try {
    const projectRoot =
      context.projectsConfigurations.projects[
        context.projectName ?? '__PROJECT_NAME_NOT_FOUND__'
      ]?.root;
    if (!projectRoot) {
      throw new Error(
        'Project root could not be determined, please report this error'
      );
    }

    const srcDir =
      typeof options.rulesDirectory === 'string'
        ? join(context.root, options.rulesDirectory)
        : join(context.root, projectRoot, 'src');
    const outDir = join(context.root, options.outputPath);

    if (existsSync(outDir)) {
      rmSync(outDir, { recursive: true });
    }

    const rules = discoverRules(srcDir);
    console.log(
      `📦 Found ${rules.length} rule${rules.length === 1 ? '' : 's'} to bundle\n`
    );

    const nxVersionRange = getNxVersionRange();

    for (const rule of rules) {
      const ruleOutDir = join(outDir, rule.ruleName);
      const outFile = join(ruleOutDir, 'index.js');

      const result = await esbuild.build({
        entryPoints: [rule.indexPath],
        bundle: true,
        minify: true,
        platform: 'node',
        target: 'node18',
        outfile: outFile,
        external: getExternalPatterns(),
        metafile: true,
      });

      // Use metafile for dependency detection
      const dependencies = getDependenciesForRule(
        result.metafile,
        nxVersionRange
      );

      // Generate package.json
      const packageJson = {
        private: true,
        dependencies,
      };

      const packageJsonPath = join(ruleOutDir, 'package.json');
      const packageJsonContents = JSON.stringify(packageJson, null, 2);
      writeFileSync(packageJsonPath, packageJsonContents);

      // Copy schema.json
      const schemaJsonPath = join(ruleOutDir, 'schema.json');
      cpSync(rule.schemaPath, schemaJsonPath);

      // Get the actual file size
      const bundleSizeKb = (statSync(outFile).size / 1024).toFixed(2);

      console.log(`Rule: ${rule.ruleName}`);
      console.log('\n  Generated files:');
      console.log(`    📄 ${relative(workspaceRoot, packageJsonPath)}`);
      console.log(
        `    📄 ${relative(workspaceRoot, outFile)} (${bundleSizeKb} KiB)`
      );
      console.log(`    📄 ${relative(workspaceRoot, schemaJsonPath)}`);

      if (Object.keys(dependencies).length > 0) {
        console.log(
          "\n  External dependencies (that will be installed at runtime if they do not match the consuming workspace's versions):"
        );
        Object.entries(dependencies).forEach(([dep, version]) =>
          console.log(`    - ${dep}@${version}`)
        );
      }
      console.log(''); // Empty line between rules
    }

    return {
      success: true,
    };
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    return {
      success: false,
    };
  }
};

export default runExecutor;
