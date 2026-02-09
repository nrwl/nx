import { formatFiles, logger, readJson, Tree, updateJson } from '@nx/devkit';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as path from 'path';

interface BumpMavenVersionSchema {
  newVersion: string;
  nxVersion: string;
}

/**
 * Parses a semantic version string into components
 * @example "0.0.10" -> { major: "0", minor: "0", patch: "10" }
 */
function parseVersion(version: string): {
  major: string;
  minor: string;
  patch: string;
} {
  const parts = version.split('.');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid version format: ${version}. Expected X.Y.Z format.`
    );
  }
  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2],
  };
}

/**
 * Converts version X.Y.Z to directory format X-Y-Z
 */
function versionToDirFormat(version: string): string {
  return version.replace(/\./g, '-');
}

/**
 * Updates an XML file's version element
 */
function updateXmlVersion(
  tree: Tree,
  filePath: string,
  newVersion: string,
  isRoot: boolean
): void {
  const content = tree.read(filePath, 'utf-8');
  if (!content) {
    throw new Error(`File not found: ${filePath}`);
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content);

    // Find the version element(s) and update them
    let updated = false;

    // For root pom.xml, update <version> directly under <project>
    if (isRoot) {
      const projectElement = doc.documentElement;
      if (projectElement.tagName === 'project') {
        const versionElements = projectElement.getElementsByTagName('version');

        // Update the first version element (direct child of project)
        for (let i = 0; i < versionElements.length; i++) {
          const versionElement = versionElements.item(i);
          if (versionElement && versionElement.parentNode === projectElement) {
            versionElement.textContent = newVersion;
            updated = true;
            break;
          }
        }
      }
    } else {
      const parentElement = doc.getElementsByTagName('parent').item(0);
      if (parentElement) {
        const versionElements = parentElement.getElementsByTagName('version');

        // Update the first version element within parent
        for (let i = 0; i < versionElements.length; i++) {
          const versionElement = versionElements.item(i);
          if (versionElement) {
            versionElement.textContent = newVersion;
            updated = true;
            break;
          }
        }
      }
    }

    if (!updated) {
      throw new Error(`Could not find version element in ${filePath}`);
    }

    const serializer = new XMLSerializer();
    const updatedContent = serializer.serializeToString(doc);
    tree.write(filePath, updatedContent);
    logger.info(`Updated version in ${filePath} to ${newVersion}`);
  } catch (error) {
    throw new Error(`Failed to update XML in ${filePath}: ${error.message}`);
  }
}

export default async function runGenerator(
  tree: Tree,
  options: BumpMavenVersionSchema
) {
  const { newVersion, nxVersion } = options;

  // Validate version format
  parseVersion(newVersion);

  const dirFormat = versionToDirFormat(newVersion);
  const migrationsDir = `packages/maven/src/migrations/${dirFormat}`;

  logger.info(
    `Bumping Maven plugin version to ${newVersion} for Nx ${nxVersion}`
  );

  try {
    // 1. Update root pom.xml
    logger.info('Updating /pom.xml...');
    updateXmlVersion(tree, 'pom.xml', newVersion, true);

    // 2. Update packages/maven/pom.xml
    logger.info('Updating packages/maven/pom.xml...');
    updateXmlVersion(tree, 'packages/maven/pom.xml', newVersion, false);

    // 3. Update maven-plugin pom.xml
    logger.info('Updating packages/maven/maven-plugin/pom.xml...');
    updateXmlVersion(
      tree,
      'packages/maven/maven-plugin/pom.xml',
      newVersion,
      false
    );

    // 4. Update shared pom.xml
    logger.info('Updating packages/maven/shared/pom.xml...');
    updateXmlVersion(tree, 'packages/maven/shared/pom.xml', newVersion, false);

    // 5. Update batch-runner pom.xml
    logger.info('Updating packages/maven/batch-runner/pom.xml...');
    updateXmlVersion(
      tree,
      'packages/maven/batch-runner/pom.xml',
      newVersion,
      false
    );

    // 5b. Update batch-runner-adapters pom.xml files
    logger.info('Updating packages/maven/batch-runner-adapters/pom.xml...');
    updateXmlVersion(
      tree,
      'packages/maven/batch-runner-adapters/pom.xml',
      newVersion,
      false
    );

    logger.info(
      'Updating packages/maven/batch-runner-adapters/maven3/pom.xml...'
    );
    updateXmlVersion(
      tree,
      'packages/maven/batch-runner-adapters/maven3/pom.xml',
      newVersion,
      false
    );

    logger.info(
      'Updating packages/maven/batch-runner-adapters/maven4/pom.xml...'
    );
    updateXmlVersion(
      tree,
      'packages/maven/batch-runner-adapters/maven4/pom.xml',
      newVersion,
      false
    );

    // 6. Update versions.ts
    logger.info('Updating packages/maven/src/utils/versions.ts...');
    const versionsFile = tree.read(
      'packages/maven/src/utils/versions.ts',
      'utf-8'
    );
    if (!versionsFile) {
      throw new Error('packages/maven/src/utils/versions.ts not found');
    }

    const updatedVersionsFile = versionsFile.replace(
      /export const mavenPluginVersion = '[^']*';/,
      `export const mavenPluginVersion = '${newVersion}';`
    );

    tree.write('packages/maven/src/utils/versions.ts', updatedVersionsFile);

    // 7. Update migrations.json
    logger.info('Updating packages/maven/migrations.json...');
    const migrationsJsonPath = 'packages/maven/migrations.json';
    const migrationEntry = {
      [migrationsJsonPath]: (current: any) => {
        const migrationKey = `update-${dirFormat}`;
        return {
          ...current,
          generators: {
            ...current.generators,
            [migrationKey]: {
              cli: 'nx',
              version: nxVersion,
              description: `Update Maven plugin version from 0.0.${
                parseInt(newVersion.split('.')[2]) - 1
              } to ${newVersion} in pom.xml files`,
              factory: `./dist/migrations/${dirFormat}/update-pom-xml-version`,
            },
          },
        };
      },
    };

    updateJson(tree, migrationsJsonPath, migrationEntry[migrationsJsonPath]);

    // 8. Create migration file
    logger.info(`Creating migration file in ${migrationsDir}...`);
    const migrationContent = `import { Tree } from '@nx/devkit';
import { updateNxMavenPluginVersion } from '../../utils/pom-xml-updater';

/**
 * Migration for @nx/maven v${newVersion}
 * Updates the Maven plugin version to ${newVersion} in pom.xml files
 */
export default async function update(tree: Tree) {
  // Update user pom.xml files
  updateNxMavenPluginVersion(tree, '${newVersion}');
}
`;

    tree.write(`${migrationsDir}/update-pom-xml-version.ts`, migrationContent);

    logger.info('Formatting files...');
    await formatFiles(tree);

    logger.info(`✅ Successfully bumped Maven plugin version to ${newVersion}`);
    logger.info(`   Migration created for Nx ${nxVersion}`);
  } catch (error) {
    logger.error(`Failed to bump Maven version: ${error.message}`);
    throw error;
  }
}
