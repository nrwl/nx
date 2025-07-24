package dev.nx.gradle.utils

import dev.nx.gradle.utils.testdata.*
import org.gradle.api.logging.Logger
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock

/** Tests for runtime class inspection functionality */
class RuntimeClassInspectionTest {

  private lateinit var mockLogger: Logger

  @BeforeEach
  fun setup() {
    mockLogger = mock(Logger::class.java)
  }

  @Test
  fun `inspectTestClassWithJUnit detects simple test class`() {
    val result = inspectTestClassWithJUnit(SimpleTestClass::class.java, mockLogger)

    assertEquals(1, result.size)
    assertEquals("dev.nx.gradle.utils.testdata.SimpleTestClass", result["SimpleTestClass"])
  }

  @Test
  fun `inspectTestClassWithJUnit detects nested test classes`() {
    val result = inspectTestClassWithJUnit(NestedTestClass::class.java, mockLogger)

    // JUnit Platform should detect nested classes with @Nested annotation
    assertTrue(result.isNotEmpty())
    assertTrue(
        result.containsKey("NestedTestClass") ||
            result.values.any { it.contains("NestedTestClass") })
  }

  @Test
  fun `inspectTestClassWithJUnit ignores configuration classes`() {
    val result1 = inspectTestClassWithJUnit(ConfigurationClass::class.java, mockLogger)
    val result2 = inspectTestClassWithJUnit(AnotherConfigurationClass::class.java, mockLogger)

    assertEquals(0, result1.size)
    assertEquals(0, result2.size)
  }

  @Test
  fun `inspectTestClassWithJUnit detects class with ExtendWith annotation`() {
    val result = inspectTestClassWithJUnit(ExtendWithTestClass::class.java, mockLogger)

    assertEquals(1, result.size)
    assertEquals("dev.nx.gradle.utils.testdata.ExtendWithTestClass", result["ExtendWithTestClass"])
  }

  @Test
  fun `inspectTestClassWithJUnit detects class with custom annotation`() {
    val result = inspectTestClassWithJUnit(CustomAnnotatedTestClass::class.java, mockLogger)

    assertEquals(1, result.size)
    assertEquals(
        "dev.nx.gradle.utils.testdata.CustomAnnotatedTestClass", result["CustomAnnotatedTestClass"])
  }

  @Test
  fun `inspectTestClassWithJUnit ignores interfaces`() {
    val result = inspectTestClassWithJUnit(TestInterface::class.java, mockLogger)

    assertEquals(0, result.size)
  }

  @Test
  fun `inspectTestClassWithJUnit ignores enums`() {
    val result = inspectTestClassWithJUnit(TestEnum::class.java, mockLogger)

    assertEquals(0, result.size)
  }

  @Test
  fun `inspectTestClassWithJUnit ignores annotation classes`() {
    val result = inspectTestClassWithJUnit(TestAnnotation::class.java, mockLogger)

    assertEquals(0, result.size)
  }

  @Test
  fun `shouldSkipClass correctly identifies non-test classes`() {
    // Test that utility functions still work
    assertTrue(shouldSkipClass(TestInterface::class.java))
    assertTrue(shouldSkipClass(TestEnum::class.java))
    assertTrue(shouldSkipClass(TestAnnotation::class.java))
    assertFalse(shouldSkipClass(SimpleTestClass::class.java))
  }

  @Test
  fun `getClassNameFromFile converts file path to class name correctly`() {
    val classDir = java.io.File("/build/classes/kotlin/test")
    val classFile =
        java.io.File(
            "/build/classes/kotlin/test/dev/nx/gradle/utils/testdata/SimpleTestClass.class")

    val result = getClassNameFromFile(classFile, classDir)

    assertEquals("dev.nx.gradle.utils.testdata.SimpleTestClass", result)
  }

  @Test
  fun `getClassNameFromFile skips nested class files`() {
    val classDir = java.io.File("/build/classes/kotlin/test")
    val classFile =
        java.io.File(
            "/build/classes/kotlin/test/dev/nx/gradle/utils/testdata/NestedTestClass\$InnerTests.class")

    val result = getClassNameFromFile(classFile, classDir)

    // Should return null for nested classes to avoid creating separate CI targets
    assertNull(result)
  }
}
