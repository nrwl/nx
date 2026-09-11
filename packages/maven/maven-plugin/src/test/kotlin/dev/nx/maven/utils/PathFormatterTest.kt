package dev.nx.maven.utils

import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals

class PathFormatterTest {

  private val pathFormatter = PathFormatter()

  // Nx looks projects up by their `/`-separated root. A Windows-separated root
  // misses that lookup and the project graph fails with
  // `Source file "backend\common\pom.xml" does not exist in the workspace.`
  @Test
  fun `normalizeRelativePath converts Windows separators to forward slashes`() {
    assertEquals("backend/common", pathFormatter.normalizeRelativePath("backend\\common"))
    assertEquals(
      "backend/common/pom.xml",
      pathFormatter.normalizeRelativePath("backend\\common\\pom.xml")
    )
  }

  @Test
  fun `normalizeRelativePath leaves POSIX paths untouched`() {
    assertEquals("backend/common", pathFormatter.normalizeRelativePath("backend/common"))
  }

  @Test
  fun `normalizeRelativePath maps the workspace root itself to a dot`() {
    assertEquals(".", pathFormatter.normalizeRelativePath(""))
  }

  @Test
  fun `toProjectPath emits forward slashes for nested paths`() {
    val projectRoot = File("root")
    val target = File("root", "target${File.separator}classes")

    assertEquals("{projectRoot}/target/classes", pathFormatter.toProjectPath(target, projectRoot))
  }

  @Test
  fun `toDependentTaskOutputs emits forward slashes for nested paths`() {
    val projectRoot = File("root")
    val target = File("root", "target${File.separator}classes")

    assertEquals(
      "target/classes",
      pathFormatter.toDependentTaskOutputs(target, projectRoot).path
    )
  }
}
