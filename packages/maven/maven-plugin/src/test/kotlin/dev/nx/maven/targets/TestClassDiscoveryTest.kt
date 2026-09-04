package dev.nx.maven.targets

import org.apache.maven.project.MavenProject
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertEquals

class TestClassDiscoveryTest {

  @Nested
  inner class ClassNameExtraction {

    @Test
    fun `resolves a plain package-private declaration`(@TempDir tempDir: File) {
      val discovered = discover(tempDir, "FooTest.java", """
        package com.example;

        class FooTest {
          @Test
          void works() {}
        }
      """.trimIndent())

      assertEquals(listOf("com.example.FooTest"), discovered.map { it.packagePath })
    }

    @Test
    fun `ignores the word class inside a markdown javadoc comment`(@TempDir tempDir: File) {
      val discovered = discover(tempDir, "FooTest.java", """
        package com.example;

        /// Named without the `${'$'}` of the class under test: a `${'$'}` in a top-level class
        /// name is treated as a nested class by Surefire and the test is silently skipped.
        class FooTest {
          @Test
          void works() {}
        }
      """.trimIndent())

      assertEquals(listOf("com.example.FooTest"), discovered.map { it.packagePath })
    }

    @Test
    fun `ignores the word class inside a block comment`(@TempDir tempDir: File) {
      val discovered = discover(tempDir, "FooTest.java", """
        package com.example;

        /*
         * This test class is a bit special, as it needs some manual actions.
         */
        class FooTest {
          @Test
          void works() {}
        }
      """.trimIndent())

      assertEquals(listOf("com.example.FooTest"), discovered.map { it.packagePath })
    }

    @Test
    fun `ignores the word class inside a string literal`(@TempDir tempDir: File) {
      val discovered = discover(tempDir, "FooTest.java", """
        package com.example;

        @DisplayName("runs the class Bogus scenario")
        class FooTest {
          @Test
          void works() {}
        }
      """.trimIndent())

      assertEquals(listOf("com.example.FooTest"), discovered.map { it.packagePath })
    }

    @Test
    fun `ignores the word class inside a text block`(@TempDir tempDir: File) {
      val discovered = discover(tempDir, "FooTest.java", """
        package com.example;

        @DisplayName(""${'"'}
            the class Bogus scenario
            ""${'"'})
        class FooTest {
          @Test
          void works() {}
        }
      """.trimIndent())

      assertEquals(listOf("com.example.FooTest"), discovered.map { it.packagePath })
    }

    @Test
    fun `does not treat comment markers inside a string literal as a comment`(
      @TempDir tempDir: File
    ) {
      // The literal's /* would otherwise open a comment that swallows the declaration and only
      // closes on the trailing */ below it
      val discovered = discover(tempDir, "FooTest.java", """
        package com.example;

        @DisplayName("matches globs like src/*")
        class FooTest {
          @Test
          void works() {} /* nothing to see here */
        }
      """.trimIndent())

      assertEquals(listOf("com.example.FooTest"), discovered.map { it.packagePath })
    }

    @Test
    fun `keeps sibling test classes distinct when both javadocs mention the word class`(
      @TempDir tempDir: File
    ) {
      listOf("FirstTest", "SecondTest").forEach { name ->
        writeSource(tempDir, "$name.java", """
          package com.example;

          /// Each nested class runs the full flow for one entity type.
          class $name {
            @Test
            void works() {}
          }
        """.trimIndent())
      }

      val discovered = TestClassDiscovery().discoverTestClasses(projectWithTestRoot(tempDir))

      assertEquals(
        listOf("com.example.FirstTest", "com.example.SecondTest"),
        discovered.map { it.packagePath }.sorted()
      )
    }
  }

  private fun discover(tempDir: File, fileName: String, source: String): List<TestClassInfo> {
    writeSource(tempDir, fileName, source)

    return TestClassDiscovery().discoverTestClasses(projectWithTestRoot(tempDir))
  }

  private fun writeSource(tempDir: File, fileName: String, source: String) =
    File(tempDir, "src/test/java/com/example").apply { mkdirs() }
      .resolve(fileName).writeText(source)

  private fun projectWithTestRoot(tempDir: File): MavenProject =
    MavenProject().apply {
      file = File(tempDir, "pom.xml")
      addTestCompileSourceRoot(File(tempDir, "src/test/java").absolutePath)
    }
}
