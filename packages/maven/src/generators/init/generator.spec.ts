import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { mavenInitGenerator } from './generator';

describe('Maven Init Generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({});
  });

  describe('addNxMavenAnalyzerPlugin', () => {
    it('should add plugin to pom.xml without build element', async () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>test-project</artifactId>
  <version>1.0.0</version>
</project>`;

      tree.write('pom.xml', pomContent);
      tree.write('package.json', JSON.stringify({ name: 'test' }));

      // Act
      await mavenInitGenerator(tree, {});

      // Assert
      const updatedPom = tree.read('pom.xml', 'utf-8')!;
      expect(updatedPom).toContain('<build>');
      expect(updatedPom).toContain('<plugins>');
      expect(updatedPom).toContain('dev.nx.maven');
      expect(updatedPom).toContain('nx-maven-plugin');
      expect(updatedPom).toContain('0.0.1');
    });

    it('should add plugin to pom.xml with build but without plugins', async () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>test-project</artifactId>
  <version>1.0.0</version>
  
  <build>
    <finalName>test-project</finalName>
  </build>
</project>`;

      tree.write('pom.xml', pomContent);
      tree.write('package.json', JSON.stringify({ name: 'test' }));

      // Act
      await mavenInitGenerator(tree, {});

      // Assert
      const updatedPom = tree.read('pom.xml', 'utf-8')!;
      expect(updatedPom).toContain('<build>');
      expect(updatedPom).toContain('<finalName>test-project</finalName>');
      expect(updatedPom).toContain('<plugins>');
      expect(updatedPom).toContain('dev.nx.maven');
      expect(updatedPom).toContain('nx-maven-plugin');
      expect(updatedPom).toContain('0.0.1');
    });

    it('should add plugin to pom.xml with existing plugins collection', async () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>test-project</artifactId>
  <version>1.0.0</version>
  
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.8.1</version>
      </plugin>
    </plugins>
  </build>
</project>`;

      tree.write('pom.xml', pomContent);
      tree.write('package.json', JSON.stringify({ name: 'test' }));

      // Act
      await mavenInitGenerator(tree, {});

      // Assert
      const updatedPom = tree.read('pom.xml', 'utf-8')!;
      expect(updatedPom).toContain('maven-compiler-plugin');
      expect(updatedPom).toContain('dev.nx.maven');
      expect(updatedPom).toContain('nx-maven-plugin');
      expect(updatedPom).toContain('0.0.1');
    });

    it('should not add plugin if already present', async () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>test-project</artifactId>
  <version>1.0.0</version>
  
  <build>
    <plugins>
      <plugin>
        <groupId>dev.nx.maven</groupId>
        <artifactId>nx-maven-plugin</artifactId>
        <version>0.0.1</version>
      </plugin>
    </plugins>
  </build>
</project>`;

      tree.write('pom.xml', pomContent);
      tree.write('package.json', JSON.stringify({ name: 'test' }));

      // Act
      await mavenInitGenerator(tree, {});

      // Assert
      const updatedPom = tree.read('pom.xml', 'utf-8')!;
      const pluginOccurrences = (updatedPom.match(/nx-maven-plugin/g) || [])
        .length;
      expect(pluginOccurrences).toBe(1);
    });

    it('should handle missing pom.xml gracefully', async () => {
      // Arrange
      tree.write('package.json', JSON.stringify({ name: 'test' }));

      // Act & Assert
      expect(async () => {
        await mavenInitGenerator(tree, {});
      }).not.toThrow();
    });

    it('should handle empty pom.xml content gracefully', async () => {
      // Arrange
      tree.write('pom.xml', '');
      tree.write('package.json', JSON.stringify({ name: 'test' }));

      // Act & Assert
      expect(async () => {
        await mavenInitGenerator(tree, {});
      }).not.toThrow();
    });

    it('should handle malformed XML gracefully', async () => {
      // Arrange
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <!-- Missing closing tag`;

      tree.write('pom.xml', pomContent);
      tree.write('package.json', JSON.stringify({ name: 'test' }));

      // Act & Assert
      expect(async () => {
        await mavenInitGenerator(tree, {});
      }).not.toThrow();

      // The XML parser should fix the malformed XML and add the plugin
      const updatedPom = tree.read('pom.xml', 'utf-8')!;
      expect(updatedPom).toContain('dev.nx.maven');
      expect(updatedPom).toContain('nx-maven-plugin');
      expect(updatedPom).toContain('&lt;!-- Missing closing tag');
    });
  });

  describe('nx.json plugin registration', () => {
    it('should add @nx/maven to plugins array', async () => {
      // Arrange
      tree.write('nx.json', JSON.stringify({ plugins: [] }));
      tree.write(
        'pom.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>test-project</artifactId>
  <version>1.0.0</version>
</project>`
      );

      // Act
      await mavenInitGenerator(tree, {});

      // Assert
      const nxJson = JSON.parse(tree.read('nx.json', 'utf-8')!);
      expect(nxJson.plugins).toContain('@nx/maven');
    });

    it('should not add @nx/maven if already present', async () => {
      // Arrange
      tree.write(
        'nx.json',
        JSON.stringify({ plugins: ['@nx/maven', '@nx/js'] })
      );
      tree.write(
        'pom.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>test-project</artifactId>
  <version>1.0.0</version>
</project>`
      );

      // Act
      await mavenInitGenerator(tree, {});

      // Assert
      const nxJson = JSON.parse(tree.read('nx.json', 'utf-8')!);
      const mavenPluginOccurrences = nxJson.plugins.filter(
        (p: string) => p === '@nx/maven'
      ).length;
      expect(mavenPluginOccurrences).toBe(1);
      expect(nxJson.plugins).toContain('@nx/js');
    });
  });
});
