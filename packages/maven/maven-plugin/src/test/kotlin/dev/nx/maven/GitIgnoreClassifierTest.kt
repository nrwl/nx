package dev.nx.maven

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GitIgnoreClassifierTest {

  @TempDir
  lateinit var workspaceRoot: File

  private fun write(relativePath: String, content: String): File {
    val file = File(workspaceRoot, relativePath)
    file.parentFile?.mkdirs()
    file.writeText(content)
    return file
  }

  // The rule is matched against the path relative to the .gitignore that
  // declared it, so anything below the first level carries a separator.
  @Test
  fun `nested gitignore applies to a file below it`() {
    write("module/.gitignore", "generated/\n")
    val generated = write("module/generated/Api.java", "")

    assertTrue(GitIgnoreClassifier(workspaceRoot).isIgnored(generated))
  }

  @Test
  fun `tracked source file is not ignored`() {
    write("module/.gitignore", "generated/\n")
    val source = write("module/src/main/java/App.java", "")

    assertFalse(GitIgnoreClassifier(workspaceRoot).isIgnored(source))
  }
}
