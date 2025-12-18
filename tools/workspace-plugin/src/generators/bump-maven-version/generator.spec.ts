import { Tree, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import generator from './generator';

describe('bump-maven-version generator', () => {
  let tree: Tree;

  const mockPomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <groupId>dev.nx</groupId>
  <artifactId>nx-parent</artifactId>
  <version>0.0.8</version>
</project>`;

  const mockMavenParentPomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <parent>
    <groupId>dev.nx</groupId>
    <artifactId>nx-parent</artifactId>
    <version>0.0.8</version>
  </parent>
  <groupId>dev.nx.maven</groupId>
  <artifactId>nx-maven-parent</artifactId>
  <packaging>pom</packaging>
</project>`;

  const mockMavenPluginPomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <parent>
    <groupId>dev.nx.maven</groupId>
    <artifactId>nx-maven-parent</artifactId>
    <version>0.0.8</version>
  </parent>
  <groupId>dev.nx.maven</groupId>
  <artifactId>nx-maven-plugin</artifactId>
  <version>\${project.parent.version}</version>
</project>`;

  const mockSharedPomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <parent>
    <groupId>dev.nx.maven</groupId>
    <artifactId>nx-maven-parent</artifactId>
    <version>0.0.8</version>
  </parent>
  <groupId>dev.nx.maven</groupId>
  <artifactId>nx-maven-shared</artifactId>
</project>`;

  const mockBatchRunnerPomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <parent>
    <groupId>dev.nx.maven</groupId>
    <artifactId>nx-maven-parent</artifactId>
    <version>0.0.8</version>
  </parent>
  <groupId>dev.nx.maven</groupId>
  <artifactId>maven-batch-runner</artifactId>
</project>`;

  const mockVersionsTs = `export const nxVersion = require('../../package.json').version;
export const mavenPluginVersion = '0.0.8';`;

  const mockMigrationsJson = {
    $schema: '../../node_modules/nx/schemas/generators-schema.json',
    generators: {
      'update-0.0.8': {
        cli: 'nx',
        version: '22.1.0-beta.4',
        description:
          'Update Maven plugin version from 0.0.7 to 0.0.8 in pom.xml files',
        factory: './dist/migrations/0-0-8/update-pom-xml-version',
      },
    },
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    // Setup mock files
    tree.write('pom.xml', mockPomXml);
    tree.write('packages/maven/pom.xml', mockMavenParentPomXml);
    tree.write('packages/maven/maven-plugin/pom.xml', mockMavenPluginPomXml);
    tree.write('packages/maven/shared/pom.xml', mockSharedPomXml);
    tree.write('packages/maven/batch-runner/pom.xml', mockBatchRunnerPomXml);
    tree.write('packages/maven/src/utils/versions.ts', mockVersionsTs);
    tree.write(
      'packages/maven/migrations.json',
      JSON.stringify(mockMigrationsJson)
    );
  });

  it('should update root pom.xml version', async () => {
    await generator(tree, {
      newVersion: '0.0.9',
      nxVersion: '22.1.0-beta.6',
    });

    const updatedPom = tree.read('pom.xml', 'utf-8');
    expect(updatedPom).toContain('<version>0.0.9</version>');
  });

  it('should update maven-plugin pom.xml parent version', async () => {
    await generator(tree, {
      newVersion: '0.0.9',
      nxVersion: '22.1.0-beta.6',
    });

    const updatedPom = tree.read(
      'packages/maven/maven-plugin/pom.xml',
      'utf-8'
    );
    expect(updatedPom).toContain('<version>0.0.9</version>');
  });

  it('should update versions.ts mavenPluginVersion', async () => {
    await generator(tree, {
      newVersion: '0.0.9',
      nxVersion: '22.1.0-beta.6',
    });

    const updatedVersions = tree.read(
      'packages/maven/src/utils/versions.ts',
      'utf-8'
    );
    expect(updatedVersions).toContain("mavenPluginVersion = '0.0.9'");
  });

  it('should add migration entry to migrations.json', async () => {
    await generator(tree, {
      newVersion: '0.0.9',
      nxVersion: '22.1.0-beta.6',
    });

    const migrationsJson = readJson(tree, 'packages/maven/migrations.json');
    expect(migrationsJson.generators['update-0-0-9']).toBeDefined();
    expect(migrationsJson.generators['update-0-0-9'].version).toBe(
      '22.1.0-beta.6'
    );
    expect(migrationsJson.generators['update-0-0-9'].factory).toContain(
      '0-0-9'
    );
  });

  it('should create migration file with correct content', async () => {
    await generator(tree, {
      newVersion: '0.0.9',
      nxVersion: '22.1.0-beta.6',
    });

    const migrationFile = tree.read(
      'packages/maven/src/migrations/0-0-9/update-pom-xml-version.ts',
      'utf-8'
    );
    expect(migrationFile).toMatchInlineSnapshot(`
      "import { Tree } from '@nx/devkit';
      import { updateNxMavenPluginVersion } from '../../utils/pom-xml-updater';

      /**
       * Migration for @nx/maven v0.0.9
       * Updates the Maven plugin version to 0.0.9 in pom.xml files
       */
      export default async function update(tree: Tree) {
        // Update user pom.xml files
        updateNxMavenPluginVersion(tree, '0.0.9');
      }
      "
    `);
  });

  it('should handle version format correctly for different versions', async () => {
    await generator(tree, {
      newVersion: '0.0.10',
      nxVersion: '22.1.0-beta.7',
    });

    const migrationFile = tree.read(
      'packages/maven/src/migrations/0-0-10/update-pom-xml-version.ts',
      'utf-8'
    );
    expect(migrationFile).toContain("'0.0.10'");
  });

  it('should reject invalid version format', async () => {
    expect(async () => {
      await generator(tree, {
        newVersion: '0.0',
        nxVersion: '22.1.0-beta.6',
      });
    }).rejects.toThrow();
  });
});
