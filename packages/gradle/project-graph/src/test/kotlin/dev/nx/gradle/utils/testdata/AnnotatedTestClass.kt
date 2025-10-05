package dev.nx.gradle.utils.testdata

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

// Custom annotation for testing - simulates @AssertFileChannelDataBlocksClosed
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class AssertFileChannelDataBlocksClosed

/** Test class with various class-level annotations */
@ExtendWith(value = [])
class ExtendWithTestClass {

  @Test
  fun testMethod() {
    // Test method
  }
}

/** Test class with custom annotation */
@AssertFileChannelDataBlocksClosed
class CustomAnnotatedTestClass {

  @Test
  fun testMethod() {
    // Test method
  }
}

/** Interface that should be ignored */
interface TestInterface {

  @Test
  fun interfaceMethod() {
    // This should be ignored
  }
}

/** Enum that should be ignored */
enum class TestEnum {
  VALUE1,
  VALUE2;

  fun enumMethod() {
    // This should be ignored - no @Test annotation
  }
}

/** Annotation that should be ignored */
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class TestAnnotation
