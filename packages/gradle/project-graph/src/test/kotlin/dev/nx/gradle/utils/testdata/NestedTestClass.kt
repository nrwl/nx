package dev.nx.gradle.utils.testdata

import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/** Test class with nested test classes for testing runtime class inspection */
class NestedTestClass {

  @BeforeEach
  fun setup() {
    // Setup method
  }

  @Test
  fun topLevelTest() {
    // Top level test
  }

  @Nested
  inner class InnerTests {

    @Test
    fun innerTest() {
      // Inner test
    }

    @Test
    fun anotherInnerTest() {
      // Another inner test
    }
  }

  @Nested
  inner class AnotherInnerTests {

    @Test
    fun nestedTest() {
      // Nested test
    }
  }

  // This nested class without @Nested should be ignored
  inner class NotAnnotatedNested {

    @Test
    fun shouldBeIgnored() {
      // This should be ignored
    }
  }
}
