package dev.nx.gradle.utils.parsing

// Essential annotations (most common subset)
val essentialTestAnnotations =
    setOf(
        "@Test",
        "@TestTemplate",
        "@ParameterizedTest",
        "@RepeatedTest",
        "@TestFactory",
        "@org.junit.Test", // JUnit 4
        "@org.testng.annotations.Test" // TestNG
        )

// Class-level test annotation names (without @ prefix for AST parsing)
val classTestAnnotationNames =
    setOf("Nested", "TestInstance", "TestMethodOrder", "DisplayName", "ExtendWith")

// Method-level test annotation names (without @ prefix for AST parsing)
val methodTestAnnotationNames =
    setOf(
        "Test",
        "TestTemplate",
        "ParameterizedTest",
        "RepeatedTest",
        "TestFactory",
        "BeforeEach",
        "AfterEach",
        "BeforeAll",
        "AfterAll")

// Combined test annotation names for general use
val testAnnotationNames = classTestAnnotationNames + methodTestAnnotationNames

// Class-level qualified annotation names
val classQualifiedTestAnnotations =
    setOf(
        "org.junit.jupiter.api.Nested",
        "org.junit.jupiter.api.TestInstance",
        "org.junit.jupiter.api.TestMethodOrder",
        "org.junit.jupiter.api.DisplayName",
        "org.junit.jupiter.api.extension.ExtendWith")

// Method-level qualified annotation names
val methodQualifiedTestAnnotations =
    setOf(
        "org.junit.Test",
        "org.junit.jupiter.api.Test",
        "org.junit.jupiter.api.TestTemplate",
        "org.junit.jupiter.api.ParameterizedTest",
        "org.junit.jupiter.api.RepeatedTest",
        "org.junit.jupiter.api.TestFactory",
        "org.junit.jupiter.api.BeforeEach",
        "org.junit.jupiter.api.AfterEach",
        "org.junit.jupiter.api.BeforeAll",
        "org.junit.jupiter.api.AfterAll",
        "org.testng.annotations.Test",
        "kotlin.test.Test")

// Combined qualified annotation names for general use
val qualifiedTestAnnotations = classQualifiedTestAnnotations + methodQualifiedTestAnnotations

fun containsEssentialTestAnnotations(content: String): Boolean {
  return essentialTestAnnotations.any { content.contains(it) }
}

fun isClassTestAnnotation(annotationName: String): Boolean {
  return classTestAnnotationNames.contains(annotationName) ||
      classQualifiedTestAnnotations.contains(annotationName)
}

fun isMethodTestAnnotation(annotationName: String): Boolean {
  return methodTestAnnotationNames.contains(annotationName) ||
      methodQualifiedTestAnnotations.contains(annotationName)
}

fun isTestAnnotation(annotationName: String): Boolean {
  return testAnnotationNames.contains(annotationName) ||
      qualifiedTestAnnotations.contains(annotationName)
}
