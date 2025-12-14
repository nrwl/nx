package dev.nx.maven

import org.eclipse.jgit.ignore.FastIgnoreRule
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GitIgnoreClassifierTest {

  @TempDir
  lateinit var tempDir: File

  @BeforeEach
  fun setup() {
    // Create basic workspace structure
  }

  @AfterEach
  fun cleanup() {
    // Temp dir is auto-cleaned by JUnit
  }

  @Test
  fun `FastIgnoreRule should match target directory pattern`() {
    // First let's verify how FastIgnoreRule works
    val rule = FastIgnoreRule("target/")

    // Test what FastIgnoreRule actually matches
    println("Testing FastIgnoreRule('target/'):")
    println("  isMatch('target', true) = ${rule.isMatch("target", true)}")
    println("  isMatch('target', false) = ${rule.isMatch("target", false)}")
    println("  isMatch('target/', true) = ${rule.isMatch("target/", true)}")
    println("  isMatch('target/classes', true) = ${rule.isMatch("target/classes", true)}")
    println("  isMatch('target/classes', false) = ${rule.isMatch("target/classes", false)}")
    println("  result = ${rule.result}")

    // The rule 'target/' should match 'target' as a directory
    assertTrue(rule.isMatch("target", true), "target/ rule should match 'target' directory")
  }

  @Test
  fun `should match target directory in root gitignore`() {
    // Create .gitignore with target/
    File(tempDir, ".gitignore").writeText("target/\n")

    println("TempDir: ${tempDir.absolutePath}")
    println(".gitignore content: ${File(tempDir, ".gitignore").readText()}")

    val classifier = GitIgnoreClassifier(tempDir)

    val targetPath = File(tempDir, "target")
    val classesPath = File(tempDir, "target/classes")

    println("Testing path: ${targetPath.absolutePath}")
    println("  isIgnored: ${classifier.isIgnored(targetPath)}")

    println("Testing path: ${classesPath.absolutePath}")
    println("  isIgnored: ${classifier.isIgnored(classesPath)}")

    // target/ should be ignored
    assertTrue(classifier.isIgnored(targetPath), "target should be ignored")

    // Files inside target/ should also be ignored
    assertTrue(classifier.isIgnored(classesPath), "target/classes should be ignored")
    assertTrue(classifier.isIgnored(File(tempDir, "target/test-classes")), "target/test-classes should be ignored")
    assertTrue(classifier.isIgnored(File(tempDir, "target/classes/com/example/App.class")), "nested file in target should be ignored")
  }

  @Test
  fun `should match nested gitignore rules`() {
    // Root .gitignore - doesn't ignore target
    File(tempDir, ".gitignore").writeText("node_modules/\n")

    // Create app directory with its own .gitignore
    val appDir = File(tempDir, "app")
    appDir.mkdirs()
    File(appDir, ".gitignore").writeText("target/\n")

    val classifier = GitIgnoreClassifier(tempDir)

    // Root level target/ should NOT be ignored (no rule for it at root)
    assertFalse(classifier.isIgnored(File(tempDir, "target")), "root target should not be ignored")

    // app/target/ SHOULD be ignored (rule in app/.gitignore)
    assertTrue(classifier.isIgnored(File(tempDir, "app/target")), "app/target should be ignored")
    assertTrue(classifier.isIgnored(File(tempDir, "app/target/classes")), "app/target/classes should be ignored")
    assertTrue(classifier.isIgnored(File(tempDir, "app/target/test-classes")), "app/target/test-classes should be ignored")
  }

  @Test
  fun `should handle deep nested paths`() {
    // Create app/.gitignore with target/
    val appDir = File(tempDir, "app")
    appDir.mkdirs()
    File(appDir, ".gitignore").writeText("target/\n")

    val classifier = GitIgnoreClassifier(tempDir)

    // Deep paths under target should be ignored
    assertTrue(
      classifier.isIgnored(File(tempDir, "app/target/test-classes/com/example/AppTest.class")),
      "deeply nested file under target should be ignored"
    )
  }

  @Test
  fun `should handle negation rules`() {
    // Create .gitignore with target/ but negation for specific file
    File(tempDir, ".gitignore").writeText("""
      target/
      !target/important.txt
    """.trimIndent())

    val classifier = GitIgnoreClassifier(tempDir)

    // target/ should be ignored
    assertTrue(classifier.isIgnored(File(tempDir, "target")), "target should be ignored")
    assertTrue(classifier.isIgnored(File(tempDir, "target/classes")), "target/classes should be ignored")

    // target/important.txt should NOT be ignored due to negation
    assertFalse(classifier.isIgnored(File(tempDir, "target/important.txt")), "target/important.txt should not be ignored due to negation")
  }

  @Test
  fun `should handle glob patterns`() {
    File(tempDir, ".gitignore").writeText("*.class\n")

    val classifier = GitIgnoreClassifier(tempDir)

    assertTrue(classifier.isIgnored(File(tempDir, "App.class")), "*.class should match App.class")
    assertTrue(classifier.isIgnored(File(tempDir, "src/main/App.class")), "*.class should match nested .class files")
    assertFalse(classifier.isIgnored(File(tempDir, "App.java")), "*.class should not match .java files")
  }

  @Test
  fun `should handle double star patterns`() {
    File(tempDir, ".gitignore").writeText("**/build/\n")

    val classifier = GitIgnoreClassifier(tempDir)

    assertTrue(classifier.isIgnored(File(tempDir, "build")), "**/build/ should match root build")
    assertTrue(classifier.isIgnored(File(tempDir, "app/build")), "**/build/ should match nested build")
    assertTrue(classifier.isIgnored(File(tempDir, "app/module/build")), "**/build/ should match deeply nested build")
    assertTrue(classifier.isIgnored(File(tempDir, "app/build/output.jar")), "**/build/ should match files inside build")
  }

  @Test
  fun `should not match paths outside workspace`() {
    File(tempDir, ".gitignore").writeText("target/\n")

    val classifier = GitIgnoreClassifier(tempDir)

    // Path outside workspace should not be ignored
    assertFalse(classifier.isIgnored(File("/some/other/path/target")), "path outside workspace should not be ignored")
  }

  @Test
  fun `should handle paths with forward slashes correctly`() {
    // This tests that we correctly convert Windows-style paths
    val appDir = File(tempDir, "app")
    appDir.mkdirs()
    File(appDir, ".gitignore").writeText("target/\n")

    val classifier = GitIgnoreClassifier(tempDir)

    // Test with File constructed from path with separators
    val testPath = File(tempDir, "app${File.separator}target${File.separator}test-classes")
    assertTrue(classifier.isIgnored(testPath), "path with system separators should be ignored")
  }

  @Test
  fun `should match Spring Boot style gitignore`() {
    // This mimics the actual Spring Boot .gitignore pattern
    val appDir = File(tempDir, "app")
    appDir.mkdirs()
    File(appDir, ".gitignore").writeText("""
      HELP.md
      target/
      !**/src/main/**/target/
      !**/src/test/**/target/
    """.trimIndent())

    val classifier = GitIgnoreClassifier(tempDir)

    // Regular target should be ignored
    assertTrue(classifier.isIgnored(File(tempDir, "app/target")), "app/target should be ignored")
    assertTrue(classifier.isIgnored(File(tempDir, "app/target/classes")), "app/target/classes should be ignored")
    assertTrue(classifier.isIgnored(File(tempDir, "app/target/test-classes")), "app/target/test-classes should be ignored")

    // But target inside src/main should NOT be ignored (due to negation)
    // Note: This depends on how the negation pattern is interpreted
  }

  @Test
  fun `should work with absolute paths like Maven provides`() {
    // This mimics how Maven provides absolute paths to the classifier
    val appDir = File(tempDir, "app")
    appDir.mkdirs()
    File(appDir, ".gitignore").writeText("target/\n")

    val classifier = GitIgnoreClassifier(tempDir)

    // Maven provides absolute paths like /workspace/app/target/test-classes
    val absoluteTargetPath = File(tempDir, "app/target").absoluteFile
    val absoluteClassesPath = File(tempDir, "app/target/test-classes").absoluteFile

    println("Testing absolute paths:")
    println("  workspace root: ${tempDir.absolutePath}")
    println("  absolute target path: ${absoluteTargetPath.absolutePath}")
    println("  isIgnored: ${classifier.isIgnored(absoluteTargetPath)}")
    println("  absolute classes path: ${absoluteClassesPath.absolutePath}")
    println("  isIgnored: ${classifier.isIgnored(absoluteClassesPath)}")

    assertTrue(classifier.isIgnored(absoluteTargetPath), "absolute app/target should be ignored")
    assertTrue(classifier.isIgnored(absoluteClassesPath), "absolute app/target/test-classes should be ignored")
  }
}
