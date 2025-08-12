package dev.nx.gradle.utils.parsing

import com.github.javaparser.JavaParser
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration
import com.github.javaparser.ast.body.MethodDeclaration
import java.io.File

// Singleton instances for heavy objects to avoid recreation
private val javaParser by lazy { JavaParser() }

/** Parse Java file using JavaParser AST */
fun parseJavaFileWithAst(file: File): MutableMap<String, String>? {
  val parseResult = javaParser.parse(file)

  if (!parseResult.isSuccessful) {
    return null
  }

  val compilationUnit = parseResult.result.orElse(null) ?: return null
  val result = mutableMapOf<String, String>()

  // Find only top-level class declarations (excluding interfaces)
  val topLevelClasses = compilationUnit.types.filterIsInstance<ClassOrInterfaceDeclaration>()

  topLevelClasses.forEach { classDecl ->
    // Skip interfaces - only process classes
    if (!classDecl.isInterface) {
      // Skip abstract classes - they shouldn't have individual test targets
      if (classDecl.isAbstract) {
        return@forEach
      }

      val className = classDecl.nameAsString

      // Skip fake classes - they are test doubles, not actual test classes
      if (className.startsWith("Fake")) {
        return@forEach
      }
      val hasTestAnnotations = hasTestAnnotationsInClass(classDecl)

      // Check for direct nested classes with @Nested annotation (also excluding interfaces and
      // abstract classes)
      val nestedTestClasses =
          classDecl.members.filterIsInstance<ClassOrInterfaceDeclaration>().filter {
            !it.isInterface && !it.isAbstract && hasNestedAnnotation(it)
          }

      // Include parent class if it has test annotations
      if (hasTestAnnotations) {
        result[className] = className
      }

      // Include @Nested test classes
      nestedTestClasses.forEach { nestedClass ->
        val nestedClassName = nestedClass.nameAsString
        result["$className$nestedClassName"] = "$className$$nestedClassName"
      }
    }
  }

  return result
}

private fun hasTestAnnotationsInClass(classDecl: ClassOrInterfaceDeclaration): Boolean {
  // Check class-level annotations for test-related annotations
  val hasClassAnnotations =
      classDecl.annotations.any { annotation -> isClassTestAnnotation(annotation.nameAsString) }

  // Check method-level annotations for test-related annotations
  val hasMethodAnnotations = classDecl.methods.any { method -> hasTestAnnotations(method) }

  return hasClassAnnotations || hasMethodAnnotations
}

private fun hasTestAnnotations(method: MethodDeclaration): Boolean {
  return method.annotations.any { annotation -> isMethodTestAnnotation(annotation.nameAsString) }
}

private fun hasNestedAnnotation(classDecl: ClassOrInterfaceDeclaration): Boolean {
  return classDecl.annotations.any { annotation ->
    annotation.nameAsString == "Nested" || annotation.nameAsString.endsWith(".Nested")
  }
}
