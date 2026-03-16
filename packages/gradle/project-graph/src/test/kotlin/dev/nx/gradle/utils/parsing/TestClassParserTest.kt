package dev.nx.gradle.utils.parsing

import java.io.File
import kotlin.test.assertEquals
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
}