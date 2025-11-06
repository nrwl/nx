package dev.nx.gradle.utils

import java.io.File
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir

class GitIgnoreClassifierTest {

  @Test
  fun `test isIgnored with no gitignore file`(@TempDir tempDir: File) {
    val classifier = GitIgnoreClassifier(tempDir)

    val file = File(tempDir, "src/main.kt")
    assertFalse(classifier.isIgnored(file))
  }

  @Test
  fun `test isIgnored with simple patterns`(@TempDir tempDir: File) {
    // Create .gitignore file
    val gitignore = File(tempDir, ".gitignore")
    gitignore.writeText(
        """
        # Comments should be ignored
        node_modules
        *.log
        dist
        build
        """
            .trimIndent())

    val classifier = GitIgnoreClassifier(tempDir)

    // Test exact directory matches
    assertTrue(classifier.isIgnored(File(tempDir, "node_modules")))
    assertTrue(classifier.isIgnored(File(tempDir, "node_modules/package.json")))
    assertTrue(classifier.isIgnored(File(tempDir, "dist")))
    assertTrue(classifier.isIgnored(File(tempDir, "dist/app.js")))
    assertTrue(classifier.isIgnored(File(tempDir, "build")))
    assertTrue(classifier.isIgnored(File(tempDir, "build/classes/Main.class")))

    // Test wildcard patterns
    assertTrue(classifier.isIgnored(File(tempDir, "app.log")))
    assertTrue(classifier.isIgnored(File(tempDir, "logs/error.log")))

    // Test files that should NOT be ignored
    assertFalse(classifier.isIgnored(File(tempDir, "src/main.kt")))
    assertFalse(classifier.isIgnored(File(tempDir, "README.md")))
    assertFalse(classifier.isIgnored(File(tempDir, "package.json")))
  }

  @Test
  fun `test isIgnored with nested paths`(@TempDir tempDir: File) {
    val gitignore = File(tempDir, ".gitignore")
    gitignore.writeText(
        """
        build
        .gradle
        out
        """
            .trimIndent())

    val classifier = GitIgnoreClassifier(tempDir)

    // Test nested build directories
    assertTrue(classifier.isIgnored(File(tempDir, "build")))
    assertTrue(classifier.isIgnored(File(tempDir, "build/libs")))
    assertTrue(classifier.isIgnored(File(tempDir, "build/libs/app.jar")))
    assertTrue(classifier.isIgnored(File(tempDir, "project/build")))
    assertTrue(classifier.isIgnored(File(tempDir, "project/build/classes/Main.class")))

    // Test .gradle directories
    assertTrue(classifier.isIgnored(File(tempDir, ".gradle")))
    assertTrue(classifier.isIgnored(File(tempDir, ".gradle/caches")))

    // Test out directories
    assertTrue(classifier.isIgnored(File(tempDir, "out")))
    assertTrue(classifier.isIgnored(File(tempDir, "out/production")))
  }

  @Test
  fun `test isIgnored with wildcard patterns`(@TempDir tempDir: File) {
    val gitignore = File(tempDir, ".gitignore")
    gitignore.writeText(
        """
        *.class
        *.jar
        *.log
        **/*.tmp
        """
            .trimIndent())

    val classifier = GitIgnoreClassifier(tempDir)

    // Test file extension wildcards
    assertTrue(classifier.isIgnored(File(tempDir, "Main.class")))
    assertTrue(classifier.isIgnored(File(tempDir, "build/classes/Main.class")))
    assertTrue(classifier.isIgnored(File(tempDir, "app.jar")))
    assertTrue(classifier.isIgnored(File(tempDir, "libs/dependency.jar")))
    assertTrue(classifier.isIgnored(File(tempDir, "debug.log")))

    // Test nested tmp files
    assertTrue(classifier.isIgnored(File(tempDir, "temp.tmp")))
    assertTrue(classifier.isIgnored(File(tempDir, "cache/temp.tmp")))

    // Files that should NOT match
    assertFalse(classifier.isIgnored(File(tempDir, "Main.kt")))
    assertFalse(classifier.isIgnored(File(tempDir, "app.json")))
  }

  @Test
  fun `test isIgnored with directory slash patterns`(@TempDir tempDir: File) {
    val gitignore = File(tempDir, ".gitignore")
    gitignore.writeText(
        """
        /build/
        /dist/
        """
            .trimIndent())

    // Create the directories so they exist
    File(tempDir, "build").mkdirs()
    File(tempDir, "dist").mkdirs()

    val classifier = GitIgnoreClassifier(tempDir)

    // Test root-level directories
    assertTrue(classifier.isIgnored(File(tempDir, "build")))
    assertTrue(classifier.isIgnored(File(tempDir, "build/output.jar")))
    assertTrue(classifier.isIgnored(File(tempDir, "dist")))
    assertTrue(classifier.isIgnored(File(tempDir, "dist/app.js")))
  }

  @Test
  fun `test isIgnored with negation patterns`(@TempDir tempDir: File) {
    val gitignore = File(tempDir, ".gitignore")
    gitignore.writeText(
        """
        *.log
        !important.log
        """
            .trimIndent())

    val classifier = GitIgnoreClassifier(tempDir)

    // Test that .log files are ignored
    assertTrue(classifier.isIgnored(File(tempDir, "debug.log")))
    assertTrue(classifier.isIgnored(File(tempDir, "error.log")))

    // Test negation pattern (important.log should NOT be ignored)
    assertFalse(classifier.isIgnored(File(tempDir, "important.log")))
  }

  @Test
  fun `test isIgnored with files outside workspace`(@TempDir tempDir: File) {
    val gitignore = File(tempDir, ".gitignore")
    gitignore.writeText("build")

    val classifier = GitIgnoreClassifier(tempDir)

    // File outside workspace should return false
    val externalFile = File("/tmp/external/build/app.jar")
    assertFalse(classifier.isIgnored(externalFile))
  }

  @Test
  fun `test isIgnored with common build artifacts`(@TempDir tempDir: File) {
    val gitignore = File(tempDir, ".gitignore")
    gitignore.writeText(
        """
        # Build outputs
        build
        .gradle
        dist
        out
        target

        # IDE
        .idea
        .vscode

        # Logs
        *.log

        # OS
        .DS_Store
        """
            .trimIndent())

    val classifier = GitIgnoreClassifier(tempDir)

    // Build outputs
    assertTrue(classifier.isIgnored(File(tempDir, "build/libs/app.jar")))
    assertTrue(classifier.isIgnored(File(tempDir, ".gradle/caches")))
    assertTrue(classifier.isIgnored(File(tempDir, "dist/bundle.js")))
    assertTrue(classifier.isIgnored(File(tempDir, "out/production")))
    assertTrue(classifier.isIgnored(File(tempDir, "target/classes")))

    // IDE files
    assertTrue(classifier.isIgnored(File(tempDir, ".idea/workspace.xml")))
    assertTrue(classifier.isIgnored(File(tempDir, ".vscode/settings.json")))

    // Logs
    assertTrue(classifier.isIgnored(File(tempDir, "app.log")))
    assertTrue(classifier.isIgnored(File(tempDir, "logs/error.log")))

    // OS files
    assertTrue(classifier.isIgnored(File(tempDir, ".DS_Store")))

    // Source files should NOT be ignored
    assertFalse(classifier.isIgnored(File(tempDir, "src/main/kotlin/Main.kt")))
    assertFalse(classifier.isIgnored(File(tempDir, "build.gradle.kts")))
    assertFalse(classifier.isIgnored(File(tempDir, "settings.gradle.kts")))
  }

  @Test
  fun `test isIgnored caching behavior`(@TempDir tempDir: File) {
    val gitignore = File(tempDir, ".gitignore")
    gitignore.writeText("build\n*.log")

    // Create classifier - should load gitignore
    val classifier = GitIgnoreClassifier(tempDir)

    // Test initial checks
    assertTrue(classifier.isIgnored(File(tempDir, "build/app.jar")))
    assertTrue(classifier.isIgnored(File(tempDir, "debug.log")))

    // Modify gitignore file (classifier should still use cached rules)
    gitignore.writeText("other")

    // Should still use original rules
    assertTrue(classifier.isIgnored(File(tempDir, "build/app.jar")))
    assertTrue(classifier.isIgnored(File(tempDir, "debug.log")))

    // Create new classifier to pick up changes
    val newClassifier = GitIgnoreClassifier(tempDir)
    assertFalse(newClassifier.isIgnored(File(tempDir, "build/app.jar")))
    assertFalse(newClassifier.isIgnored(File(tempDir, "debug.log")))
    assertTrue(newClassifier.isIgnored(File(tempDir, "other")))
  }

  @Test
  fun `test isIgnored with empty gitignore`(@TempDir tempDir: File) {
    val gitignore = File(tempDir, ".gitignore")
    gitignore.writeText("")

    val classifier = GitIgnoreClassifier(tempDir)

    // Nothing should be ignored
    assertFalse(classifier.isIgnored(File(tempDir, "anything.txt")))
    assertFalse(classifier.isIgnored(File(tempDir, "build/app.jar")))
  }

  @Test
  fun `test isIgnored with only comments`(@TempDir tempDir: File) {
    val gitignore = File(tempDir, ".gitignore")
    gitignore.writeText(
        """
        # This is a comment
        # Another comment

        # Yet another comment
        """
            .trimIndent())

    val classifier = GitIgnoreClassifier(tempDir)

    // Nothing should be ignored
    assertFalse(classifier.isIgnored(File(tempDir, "anything.txt")))
    assertFalse(classifier.isIgnored(File(tempDir, "build/app.jar")))
  }
}
