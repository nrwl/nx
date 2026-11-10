import { type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-nx-maven-plugin-to-0-0-18';

const pomWithPlugin = (groupId: string, version: string) => `<project>
  <build>
    <plugins>
      <plugin>
        <groupId>${groupId}</groupId>
        <artifactId>nx-maven-plugin</artifactId>
        <version>${version}</version>
      </plugin>
    </plugins>
  </build>
</project>
`;

describe('update-nx-maven-plugin-to-0-0-18 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('updates the nx-maven-plugin version in the root pom.xml', async () => {
    tree.write('pom.xml', pomWithPlugin('dev.nx.maven', '0.0.17'));

    await migration(tree);

    expect(tree.read('pom.xml', 'utf-8')).toContain(
      '<version>0.0.18</version>'
    );
  });

  it('leaves a same-named plugin from another group unchanged', async () => {
    const content = pomWithPlugin('com.example', '0.0.17');
    tree.write('pom.xml', content);

    await migration(tree);

    expect(tree.read('pom.xml', 'utf-8')).toBe(content);
  });

  it('does nothing without a root pom.xml', async () => {
    await expect(migration(tree)).resolves.toBeUndefined();
    expect(tree.exists('pom.xml')).toBe(false);
  });

  it('is idempotent', async () => {
    tree.write('pom.xml', pomWithPlugin('dev.nx.maven', '0.0.17'));

    await migration(tree);
    const afterFirstRun = tree.read('pom.xml', 'utf-8');
    await migration(tree);

    expect(tree.read('pom.xml', 'utf-8')).toBe(afterFirstRun);
  });
});
