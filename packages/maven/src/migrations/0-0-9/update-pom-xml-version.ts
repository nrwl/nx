import { Tree } from '@nx/devkit';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { updateNxMavenPluginVersion } from '../../utils/pom-xml-updater';

/**
 * Migration for @nx/maven v0.0.9
 * Updates the Maven plugin version from 0.0.8 to 0.0.9 in user pom.xml files and maven-plugin pom.xml
 */
export default async function update(tree: Tree) {
  // Update user pom.xml files
  updateNxMavenPluginVersion(tree, '0.0.9');

  // Update maven-plugin pom.xml parent version
  const pomPath = 'packages/maven/maven-plugin/pom.xml';
  if (tree.exists(pomPath)) {
    const content = tree.read(pomPath, 'utf-8');
    if (content) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content);
      const projectElement = doc.documentElement;

      if (projectElement.tagName === 'project') {
        const versionElements = projectElement.getElementsByTagName('version');

        // Find version element within parent element
        for (let i = 0; i < versionElements.length; i++) {
          const versionElement = versionElements.item(i);
          if (
            versionElement &&
            versionElement.parentNode?.nodeName === 'parent'
          ) {
            versionElement.textContent = '0.0.9';
            break;
          }
        }

        const serializer = new XMLSerializer();
        const updatedContent = serializer.serializeToString(doc);
        tree.write(pomPath, updatedContent);
      }
    }
  }
}
