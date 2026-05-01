import { Tree } from '@nx/devkit';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

/**
 * Updates the version of dev.nx.maven:nx-maven-plugin in pom.xml files.
 * Only updates the version element that belongs to the nx-maven-plugin.
 *
 * @param tree - Nx Tree instance
 * @param version - The new version to set
 */
export function updateNxMavenPluginVersion(tree: Tree, version: string): void {
  const pomPath = 'pom.xml';

  if (!tree.exists(pomPath)) {
    return;
  }

  const content = tree.read(pomPath, 'utf-8');
  const parser = new DOMParser();
  const doc = parser.parseFromString(content);

  let hasChanges = false;

  // Find all plugin elements in the document
  const plugins = Array.from(doc.getElementsByTagName('plugin'));

  for (const plugin of plugins) {
    // Check if this is the nx-maven-plugin by looking for groupId and artifactId
    const groupId = plugin.getElementsByTagName('groupId')[0];
    const artifactId = plugin.getElementsByTagName('artifactId')[0];

    const isNxMavenPlugin =
      groupId?.textContent?.trim() === 'dev.nx.maven' &&
      artifactId?.textContent?.trim() === 'nx-maven-plugin';

    // If this is the nx-maven-plugin, update its version
    if (isNxMavenPlugin) {
      const versionElement = plugin.getElementsByTagName('version')[0];
      const currentVersion = versionElement?.textContent?.trim();

      if (currentVersion && currentVersion !== version) {
        versionElement.textContent = version;
        hasChanges = true;
      }
    }
  }

  // If content changed, write it back using XML serializer to preserve formatting
  if (hasChanges) {
    const serializer = new XMLSerializer();
    const updatedContent = serializer.serializeToString(doc);
    tree.write(pomPath, updatedContent);
  }
}
