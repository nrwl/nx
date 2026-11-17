#### Update the Nx Maven plugin to 0.0.20

Updates the version of `dev.nx.maven:nx-maven-plugin` to `0.0.20` in the root `pom.xml`, so Maven uses the plugin version that matches `@nx/maven`.

#### Sample code changes

##### Before

```xml
<plugin>
  <groupId>dev.nx.maven</groupId>
  <artifactId>nx-maven-plugin</artifactId>
  <version>0.0.19</version>
</plugin>
```

##### After

```xml
<plugin>
  <groupId>dev.nx.maven</groupId>
  <artifactId>nx-maven-plugin</artifactId>
  <version>0.0.20</version>
</plugin>
```
