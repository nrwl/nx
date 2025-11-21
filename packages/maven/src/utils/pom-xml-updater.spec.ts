import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateNxMavenPluginVersion } from './pom-xml-updater';

describe('pom-xml-updater', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({});
  });

  describe('updateNxMavenPluginVersion', () => {
    it('should update the nx-maven-plugin version only', () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <build>
    <plugins>
      <plugin>
        <groupId>dev.nx.maven</groupId>
        <artifactId>nx-maven-plugin</artifactId>
        <version>0.0.7</version>
      </plugin>
    </plugins>
  </build>
</project>`;

      tree.write('pom.xml', pomContent);

      // Act
      updateNxMavenPluginVersion(tree, '0.0.8');

      // Assert
      const updatedContent = tree.read('pom.xml', 'utf-8');
      expect(updatedContent).toMatchSnapshot();
    });

    it('should not update other plugin versions', () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <build>
    <plugins>
      <plugin>
        <groupId>dev.nx.maven</groupId>
        <artifactId>nx-maven-plugin</artifactId>
        <version>0.0.7</version>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>0.0.7</version>
      </plugin>
    </plugins>
  </build>
</project>`;

      tree.write('pom.xml', pomContent);

      // Act
      updateNxMavenPluginVersion(tree, '0.0.8');

      // Assert
      const updatedContent = tree.read('pom.xml', 'utf-8');
      expect(updatedContent).toMatchSnapshot();
    });

    it('should not modify pom.xml if file does not exist', () => {
      // Act & Assert - should not throw
      expect(() => {
        updateNxMavenPluginVersion(tree, '0.0.8');
      }).not.toThrow();
    });

    it('should preserve XML formatting and structure', () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <build>
    <plugins>
      <plugin>
        <groupId>dev.nx.maven</groupId>
        <artifactId>nx-maven-plugin</artifactId>
        <version>0.0.7</version>
      </plugin>
    </plugins>
  </build>
</project>`;

      tree.write('pom.xml', pomContent);

      // Act
      updateNxMavenPluginVersion(tree, '0.0.8');

      // Assert
      const updatedContent = tree.read('pom.xml', 'utf-8');
      expect(updatedContent).toMatchSnapshot();
    });

    it('should not update if version is already the target version', () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <build>
    <plugins>
      <plugin>
        <groupId>dev.nx.maven</groupId>
        <artifactId>nx-maven-plugin</artifactId>
        <version>0.0.8</version>
      </plugin>
    </plugins>
  </build>
</project>`;

      tree.write('pom.xml', pomContent);

      // Act
      updateNxMavenPluginVersion(tree, '0.0.8');

      // Assert
      const updatedContent = tree.read('pom.xml', 'utf-8');
      expect(updatedContent).toEqual(pomContent);
    });

    it('should handle pom.xml with dependencies and other version elements', () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <version>1.0.0</version>
  <build>
    <plugins>
      <plugin>
        <groupId>dev.nx.maven</groupId>
        <artifactId>nx-maven-plugin</artifactId>
        <version>0.0.7</version>
      </plugin>
    </plugins>
  </build>
  <dependencies>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
    </dependency>
  </dependencies>
</project>`;

      tree.write('pom.xml', pomContent);

      // Act
      updateNxMavenPluginVersion(tree, '0.0.8');

      // Assert
      const updatedContent = tree.read('pom.xml', 'utf-8');
      expect(updatedContent).toMatchSnapshot();
    });

    it('should correctly identify nx-maven-plugin with whitespace', () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <build>
    <plugins>
      <plugin>
        <groupId>
          dev.nx.maven
        </groupId>
        <artifactId>
          nx-maven-plugin
        </artifactId>
        <version>
          0.0.7
        </version>
      </plugin>
    </plugins>
  </build>
</project>`;

      tree.write('pom.xml', pomContent);

      // Act
      updateNxMavenPluginVersion(tree, '0.0.8');

      // Assert
      const updatedContent = tree.read('pom.xml', 'utf-8');
      expect(updatedContent).toMatchSnapshot();
    });

    it('should only update plugins, not parent version', () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <parent>
    <groupId>dev.nx</groupId>
    <artifactId>nx-parent</artifactId>
    <version>0.0.7</version>
  </parent>
  <build>
    <plugins>
      <plugin>
        <groupId>dev.nx.maven</groupId>
        <artifactId>nx-maven-plugin</artifactId>
        <version>0.0.7</version>
      </plugin>
    </plugins>
  </build>
</project>`;

      tree.write('pom.xml', pomContent);

      // Act
      updateNxMavenPluginVersion(tree, '0.0.8');

      // Assert
      const updatedContent = tree.read('pom.xml', 'utf-8');
      expect(updatedContent).toMatchSnapshot();
    });
  });
});
