package dev.nx.maven.utils

import java.io.File
import java.nio.file.Files
import kotlin.test.assertEquals
import kotlin.test.assertNull
import org.junit.jupiter.api.Test

class PathFormatterTest {

  private val formatter = PathFormatter()
  private val workspaceRoot = Files.createTempDirectory("nx-path-formatter").toFile()
  private val projectRoot = File(workspaceRoot, "apps/service")

  @Test
  fun `a path inside the module is project-relative`() {
    assertEquals(
      "{projectRoot}/src/main/java",
      formatter.formatInputPath(File(projectRoot, "src/main/java"), projectRoot, workspaceRoot)
    )
    assertEquals(
      "{projectRoot}/src/main/resources/**/*.properties",
      formatter.formatInputPath(
        File(projectRoot, "src/main/resources"), projectRoot, workspaceRoot, glob = "**/*.properties"
      )
    )
  }

  @Test
  fun `a resource directory outside the module is workspace-relative`() {
    assertEquals(
      "{workspaceRoot}/apps/shared-resources",
      formatter.formatInputPath(File(projectRoot, "../shared-resources"), projectRoot, workspaceRoot)
    )
    assertEquals(
      "{workspaceRoot}/apps/other-module/config",
      formatter.formatInputPath(File(projectRoot, "../other-module/config"), projectRoot, workspaceRoot)
    )
  }

  @Test
  fun `the module directory itself becomes a glob over its contents`() {
    assertEquals(
      "{projectRoot}/**/*",
      formatter.formatInputPath(File(projectRoot, "../service"), projectRoot, workspaceRoot)
    )
    assertEquals(
      "{workspaceRoot}/**/*",
      formatter.formatInputPath(File(projectRoot, "../.."), projectRoot, workspaceRoot)
    )
  }

  @Test
  fun `a relative path is module-relative, wherever the JVM runs`() {
    assertEquals(
      "{projectRoot}/src/main/**/*",
      formatter.formatInputPath(File("src/main/**/*"), projectRoot, workspaceRoot)
    )
    assertEquals(
      "{projectRoot}/*.properties",
      formatter.formatInputPath(File("*.properties"), projectRoot, workspaceRoot)
    )
  }

  @Test
  fun `a separate glob follows the resolved directory`() {
    assertEquals(
      "{workspaceRoot}/apps/shared-resources/**/*.properties",
      formatter.formatInputPath(
        File(projectRoot, "../shared-resources"), projectRoot, workspaceRoot, glob = "**/*.properties"
      )
    )
  }

  @Test
  fun `a relative tail stays verbatim after the split`() {
    assertEquals(
      "{projectRoot}/src/*/x",
      formatter.formatInputPath(File("src/*/x"), projectRoot, workspaceRoot)
    )
  }

  @Test
  fun `glob characters in the workspace path are not a glob`() {
    for (name in listOf("ws[old]", "ws{v2}")) {
      val root = File(workspaceRoot, name)
      val module = File(root, "apps/service")
      assertEquals(
        "{projectRoot}/src/main/java",
        formatter.formatInputPath(File(module, "src/main/java"), module, root)
      )
      assertEquals(
        "{projectRoot}/pom.xml",
        formatter.formatInputPath(File(module, "pom.xml"), module, root)
      )
      assertEquals(
        "{projectRoot}/src/main/**/*",
        formatter.formatInputPath(File("src/main/**/*"), module, root)
      )
    }
  }

  @Test
  fun `a path outside the workspace is dropped`() {
    assertNull(
      formatter.formatInputPath(File(workspaceRoot, "../elsewhere"), projectRoot, workspaceRoot)
    )
  }
}
