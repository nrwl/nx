package dev.nx.gradle.utils

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/**
 * Legacy test class - these tests are now handled by RuntimeClassInspectionTest since we switched
 * from AST/regex parsing to runtime class inspection
 */
class ClassDetectionTest {

  @Test
  fun `legacy test - now handled by runtime class inspection`() {
    // This test suite has been replaced by RuntimeClassInspectionTest
    // The new approach uses compiled classes and runtime inspection
    // instead of AST/regex parsing of source files
    assertTrue(true)
  }
}
