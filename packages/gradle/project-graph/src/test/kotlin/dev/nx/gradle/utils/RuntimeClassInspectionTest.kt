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
  fun `inspectTestClass detects simple test class`() {
    val result = inspectTestClass(SimpleTestClass::class.java, mockLogger)

    assertEquals(1, result.size)
    assertEquals("dev.nx.gradle.utils.testdata.SimpleTestClass", result["SimpleTestClass"])
  }

  @Test
  fun `inspectTestClass detects nested test classes`() {
    val result = inspectTestClass(NestedTestClass::class.java, mockLogger)

    // Should detect nested classes with @Nested annotation
    assertEquals(2, result.size)
    assertTrue(result.containsKey("NestedTestClassInnerTests"))
    assertTrue(result.containsKey("NestedTestClassAnotherInnerTests"))
    assertEquals(
        "dev.nx.gradle.utils.testdata.NestedTestClass\$InnerTests",
        result["NestedTestClassInnerTests"])
    assertEquals(
        "dev.nx.gradle.utils.testdata.NestedTestClass\$AnotherInnerTests",
        result["NestedTestClassAnotherInnerTests"])
  }

  @Test
  fun `inspectTestClass ignores configuration classes`() {
    val result1 = inspectTestClass(ConfigurationClass::class.java, mockLogger)
    val result2 = inspectTestClass(AnotherConfigurationClass::class.java, mockLogger)

    assertEquals(0, result1.size)
    assertEquals(0, result2.size)
  }

  @Test
  fun `inspectTestClass detects class with ExtendWith annotation`() {
    val result = inspectTestClass(ExtendWithTestClass::class.java, mockLogger)

    assertEquals(1, result.size)
    assertEquals("dev.nx.gradle.utils.testdata.ExtendWithTestClass", result["ExtendWithTestClass"])
  }

  @Test
  fun `inspectTestClass detects class with custom annotation`() {
    val result = inspectTestClass(CustomAnnotatedTestClass::class.java, mockLogger)

    assertEquals(1, result.size)
    assertEquals(
        "dev.nx.gradle.utils.testdata.CustomAnnotatedTestClass", result["CustomAnnotatedTestClass"])
  }

  @Test
  fun `inspectTestClass ignores interfaces`() {
    val result = inspectTestClass(TestInterface::class.java, mockLogger)

    assertEquals(0, result.size)
  }

  @Test
  fun `inspectTestClass ignores enums`() {
    val result = inspectTestClass(TestEnum::class.java, mockLogger)

    assertEquals(0, result.size)
  }

  @Test
  fun `inspectTestClass ignores annotation classes`() {
    val result = inspectTestClass(TestAnnotation::class.java, mockLogger)

    assertEquals(0, result.size)
  }

  @Test
  fun `hasClassTestAnnotations detects ExtendWith annotation`() {
    assertTrue(hasClassTestAnnotations(ExtendWithTestClass::class.java))
  }

  @Test
  fun `hasClassTestAnnotations detects custom test annotation`() {
    assertTrue(hasClassTestAnnotations(CustomAnnotatedTestClass::class.java))
  }

  @Test
  fun `hasClassTestAnnotations ignores configuration annotations`() {
    assertFalse(hasClassTestAnnotations(ConfigurationClass::class.java))
    assertFalse(hasClassTestAnnotations(AnotherConfigurationClass::class.java))
  }

  @Test
  fun `hasMethodTestAnnotations detects Test annotation`() {
    assertTrue(hasMethodTestAnnotations(SimpleTestClass::class.java))
    assertTrue(hasMethodTestAnnotations(NestedTestClass::class.java))
    assertTrue(hasMethodTestAnnotations(ExtendWithTestClass::class.java))
    assertTrue(hasMethodTestAnnotations(CustomAnnotatedTestClass::class.java))
  }

  @Test
  fun `hasMethodTestAnnotations ignores configuration classes`() {
    assertFalse(hasMethodTestAnnotations(ConfigurationClass::class.java))
    assertFalse(hasMethodTestAnnotations(AnotherConfigurationClass::class.java))
  }

  @Test
  fun `isNestedTestClass detects Nested annotation`() {
    val nestedClasses = NestedTestClass::class.java.declaredClasses

    val innerTests = nestedClasses.find { it.simpleName == "InnerTests" }
    val anotherInnerTests = nestedClasses.find { it.simpleName == "AnotherInnerTests" }
    val notAnnotatedNested = nestedClasses.find { it.simpleName == "NotAnnotatedNested" }

    assertNotNull(innerTests)
    assertNotNull(anotherInnerTests)
    assertNotNull(notAnnotatedNested)

    assertTrue(isNestedTestClass(innerTests!!))
    assertTrue(isNestedTestClass(anotherInnerTests!!))
    assertFalse(isNestedTestClass(notAnnotatedNested!!))
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
  fun `getClassNameFromFile handles nested class files`() {
    val classDir = java.io.File("/build/classes/kotlin/test")
    val classFile =
        java.io.File(
            "/build/classes/kotlin/test/dev/nx/gradle/utils/testdata/NestedTestClass\$InnerTests.class")

    val result = getClassNameFromFile(classFile, classDir)

    assertEquals("dev.nx.gradle.utils.testdata.NestedTestClass\$InnerTests", result)
  }
}
