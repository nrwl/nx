package dev.nx.maven.utils

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertEquals

class PathFormatterTest {

  @TempDir
  lateinit var workspaceRoot: File

  private val pathFormatter = PathFormatter()

  @Test
  fun `relativePath uses forward slashes`() {
    val project = File(workspaceRoot, "packages/maven/shared")
    assertEquals("packages/maven/shared", pathFormatter.relativePath(project, workspaceRoot))
  }

  @Test
  fun `relativePath maps the workspace root to a dot`() {
    assertEquals(".", pathFormatter.relativePath(workspaceRoot, workspaceRoot))
  }
}
