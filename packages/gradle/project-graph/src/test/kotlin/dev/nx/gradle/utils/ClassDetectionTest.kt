package dev.nx.gradle.utils

import java.io.File
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ClassDetectionTest {
  @Test
  fun `detects top-level and annotated nested classes only`() {
    val kotlinSource =
        """
            class ClassA {
              @Nested
              class ClassB

              class ClassC

              private class ClassD
            }

            @Nested
            class ClassX // not nested — should be ignored

            private class ClassY

            class ClassZ
        """
            .trimIndent()

    // Write to temp file
    val tempFile = File.createTempFile("ClassDetectionTest", ".kt")
    tempFile.writeText(kotlinSource)
    tempFile.deleteOnExit()

    // Run the function
    val result = getAllVisibleClassesWithNestedAnnotation(tempFile)

    // Expected output
    val expected = mapOf("ClassAClassB" to "ClassA\$ClassB", "ClassZ" to "ClassZ")

    assertEquals(expected, result)
  }

  @Test
  fun `detects top-level and annotated nested classes only with package name`() {
    val kotlinSource =
        """
            package dev.test
            class ClassA {
              @Nested
              class ClassB

              class ClassC

              private class ClassD
              
              @Nested
              class ClassE
            }

            @Nested
            class ClassX // not nested — should be ignored

            private class ClassY

            class ClassZ
        """
            .trimIndent()

    // Write to temp file
    val tempFile = File.createTempFile("ClassDetectionTest", ".kt")
    tempFile.writeText(kotlinSource)
    tempFile.deleteOnExit()

    // Run the function
    val result = getAllVisibleClassesWithNestedAnnotation(tempFile)

    // Expected output
    val expected =
        mapOf(
            "ClassAClassB" to "dev.test.ClassA\$ClassB",
            "ClassAClassE" to "dev.test.ClassA\$ClassE",
            "ClassZ" to "dev.test.ClassZ")

    assertEquals(expected, result)
  }
}
