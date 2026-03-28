package dev.nx.gradle.utils.parsing

import java.io.File
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir

class TestClassParserTest {

  @TempDir lateinit var tempDir: File

  @Test
  fun `should exclude annotation classes from Kotlin files`() {
    val file =
        File(tempDir, "AnnotationTest.kt").apply {
          writeText(
              """
              package com.example
              import org.junit.jupiter.api.Test

              @Target(AnnotationTarget.CLASS)
              @Retention(AnnotationRetention.RUNTIME)
              annotation class CustomTestAnnotation

              @CustomTestAnnotation
              class ActualTestClass {
                @Test
                fun testMethod() {}
              }
              """
                  .trimIndent())
        }

    val result = getAllVisibleClassesWithNestedAnnotation(file)

    assertNotNull(result)
    assertTrue(result.containsKey("ActualTestClass"))
    assertFalse(
        result.containsKey("CustomTestAnnotation"),
        "Annotation classes should not be included as test targets")
  }

  @Test
  fun `should exclude annotation classes from regex fallback`() {
    val file =
        File(tempDir, "AnnotationTest.kt").apply {
          writeText(
              """
              package com.example
              import org.junit.jupiter.api.Test

              annotation class SomeAnnotation

              class RealTest {
                @Test
                fun testMethod() {}
              }
              """
                  .trimIndent())
        }

    val result = parseTestClassesWithRegex(file)

    assertNotNull(result)
    assertTrue(result.containsKey("RealTest"))
    assertFalse(
        result.containsKey("SomeAnnotation"),
        "Annotation classes should not be included as test targets")
  }

  @Test
  fun `should exclude multiple annotation classes in same file`() {
    val file =
        File(tempDir, "MultiAnnotation.kt").apply {
          writeText(
              """
              package com.example
              import org.junit.jupiter.api.Test

              @Target(AnnotationTarget.CLASS)
              annotation class FirstAnnotation

              @Target(AnnotationTarget.CLASS)
              annotation class SecondAnnotation

              @FirstAnnotation
              @SecondAnnotation
              class AnnotatedTest {
                @Test
                fun testMethod() {}
              }
              """
                  .trimIndent())
        }

    val result = getAllVisibleClassesWithNestedAnnotation(file)

    assertNotNull(result)
    assertTrue(result.containsKey("AnnotatedTest"))
    assertFalse(result.containsKey("FirstAnnotation"))
    assertFalse(result.containsKey("SecondAnnotation"))
  }

  @Test
  fun `should exclude enum classes from Kotlin files`() {
    val file =
        File(tempDir, "EnumTest.kt").apply {
          writeText(
              """
              package com.example
              import org.junit.jupiter.api.Test

              enum class TestStatus {
                PASSED, FAILED, SKIPPED
              }

              class ActualTestClass {
                @Test
                fun testMethod() {}
              }
              """
                  .trimIndent())
        }

    val result = getAllVisibleClassesWithNestedAnnotation(file)

    assertNotNull(result)
    assertTrue(result.containsKey("ActualTestClass"))
    assertFalse(
        result.containsKey("TestStatus"), "Enum classes should not be included as test targets")
  }

  @Test
  fun `should exclude enum classes from regex fallback`() {
    val file =
        File(tempDir, "EnumTest.kt").apply {
          writeText(
              """
              package com.example
              import org.junit.jupiter.api.Test

              enum class TestStatus {
                PASSED, FAILED, SKIPPED
              }

              class RealTest {
                @Test
                fun testMethod() {}
              }
              """
                  .trimIndent())
        }

    val result = parseTestClassesWithRegex(file)

    assertNotNull(result)
    assertTrue(result.containsKey("RealTest"))
    assertFalse(
        result.containsKey("TestStatus"), "Enum classes should not be included as test targets")
  }

  @Test
  fun `should exclude multiple enum classes in same file`() {
    val file =
        File(tempDir, "MultiEnum.kt").apply {
          writeText(
              """
              package com.example
              import org.junit.jupiter.api.Test

              enum class TestStatus {
                PASSED, FAILED, SKIPPED
              }

              enum class Priority {
                HIGH, MEDIUM, LOW
              }

              class EnumUserTest {
                @Test
                fun testMethod() {}
              }
              """
                  .trimIndent())
        }

    val result = getAllVisibleClassesWithNestedAnnotation(file)

    assertNotNull(result)
    assertTrue(result.containsKey("EnumUserTest"))
    assertFalse(result.containsKey("TestStatus"))
    assertFalse(result.containsKey("Priority"))
  }

  @Test
  fun `should still include regular test classes alongside annotation classes`() {
    val file =
        File(tempDir, "MixedFile.kt").apply {
          writeText(
              """
              package com.example
              import org.junit.jupiter.api.Test
              import org.junit.jupiter.api.extension.ExtendWith

              annotation class AssertFileChannelDataBlocksClosed

              @ExtendWith(value = [])
              class ExtendWithTestClass {
                @Test
                fun testMethod() {}
              }

              @AssertFileChannelDataBlocksClosed
              class CustomAnnotatedTestClass {
                @Test
                fun testMethod() {}
              }

              annotation class TestAnnotation
              """
                  .trimIndent())
        }

    val result = getAllVisibleClassesWithNestedAnnotation(file)

    assertNotNull(result)
    assertTrue(result.containsKey("ExtendWithTestClass"))
    assertTrue(result.containsKey("CustomAnnotatedTestClass"))
    assertFalse(
        result.containsKey("AssertFileChannelDataBlocksClosed"),
        "Annotation class should not be a test target")
    assertFalse(
        result.containsKey("TestAnnotation"), "Annotation class should not be a test target")
  }

  @Test
  fun `should exclude both enum and annotation classes in mixed file`() {
    val file =
        File(tempDir, "MixedEnumAnnotation.kt").apply {
          writeText(
              """
              package com.example
              import org.junit.jupiter.api.Test

              enum class TestStatus {
                PASSED, FAILED, SKIPPED
              }

              annotation class CustomAnnotation

              class MixedTest {
                @Test
                fun testMethod() {}
              }
              """
                  .trimIndent())
        }

    val result = getAllVisibleClassesWithNestedAnnotation(file)

    assertNotNull(result)
    assertTrue(result.containsKey("MixedTest"))
    assertFalse(
        result.containsKey("TestStatus"), "Enum classes should not be included as test targets")
    assertFalse(
        result.containsKey("CustomAnnotation"),
        "Annotation classes should not be included as test targets")
  }

  @Test
  fun `should exclude enum classes with visibility modifiers from regex fallback`() {
    val file =
        File(tempDir, "VisibilityEnumTest.kt").apply {
          writeText(
              """
              package com.example
              import org.junit.jupiter.api.Test

              public enum class PublicStatus {
                ACTIVE, INACTIVE
              }

              internal enum class InternalStatus {
                PENDING, DONE
              }

              class VisibilityTest {
                @Test
                fun testMethod() {}
              }
              """
                  .trimIndent())
        }

    val result = parseTestClassesWithRegex(file)

    assertNotNull(result)
    assertTrue(result.containsKey("VisibilityTest"))
    assertFalse(
        result.containsKey("PublicStatus"),
        "Public enum classes should not be included as test targets")
    assertFalse(
        result.containsKey("InternalStatus"),
        "Internal enum classes should not be included as test targets")
  }
}
