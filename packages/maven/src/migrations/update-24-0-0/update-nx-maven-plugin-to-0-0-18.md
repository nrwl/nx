#### Update the Nx Maven plugin to 0.0.18

Updates the version of `dev.nx.maven:nx-maven-plugin` to `0.0.18` in the root `pom.xml`, so Maven uses the plugin version that matches `@nx/maven`.

#### Sample code changes

##### Before

```xml
<plugin>
  <groupId>dev.nx.maven</groupId>
  <artifactId>nx-maven-plugin</artifactId>
  <version>0.0.17</version>
</plugin>
```

##### After

```xml
<plugin>
  <groupId>dev.nx.maven</groupId>
  <artifactId>nx-maven-plugin</artifactId>
  <version>0.0.18</version>
</plugin>
```
