package dev.nx.maven.utils

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class PathFormatterTest {

  private val pathFormatter = PathFormatter()

  @Test
  fun `normalizeRelativePath uses forward slashes`() {
    assertEquals("packages/maven/shared", pathFormatter.normalizeRelativePath("packages\\maven\\shared"))
    assertEquals("packages/maven/shared", pathFormatter.normalizeRelativePath("packages/maven/shared"))
  }

  @Test
  fun `normalizeRelativePath maps the workspace root to a dot`() {
    assertEquals(".", pathFormatter.normalizeRelativePath(""))
  }
}
