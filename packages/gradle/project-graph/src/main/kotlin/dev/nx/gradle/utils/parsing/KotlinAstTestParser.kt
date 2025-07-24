package dev.nx.gradle.utils.parsing

import java.io.File
import org.jetbrains.kotlin.cli.jvm.compiler.EnvironmentConfigFiles
import org.jetbrains.kotlin.cli.jvm.compiler.KotlinCoreEnvironment
import org.jetbrains.kotlin.com.intellij.openapi.util.Disposer
import org.jetbrains.kotlin.com.intellij.psi.PsiManager
import org.jetbrains.kotlin.com.intellij.testFramework.LightVirtualFile
import org.jetbrains.kotlin.config.CompilerConfiguration
import org.jetbrains.kotlin.idea.KotlinFileType
import org.jetbrains.kotlin.lexer.KtTokens
import org.jetbrains.kotlin.psi.KtClass
import org.jetbrains.kotlin.psi.KtFile
import org.jetbrains.kotlin.psi.psiUtil.getChildrenOfType

/** Check if Kotlin compiler classes are available using reflection */
fun isKotlinCompilerAvailable(logger: org.gradle.api.logging.Logger? = null): Boolean {
  return try {
    // Try to access critical Kotlin compiler classes
    Class.forName("org.jetbrains.kotlin.cli.jvm.compiler.KotlinCoreEnvironment")
    Class.forName("org.jetbrains.kotlin.config.CompilerConfiguration")
    Class.forName("org.jetbrains.kotlin.psi.KtFile")
    true
  } catch (e: ClassNotFoundException) {
    logger?.debug("Kotlin compiler class not found: ${e.message}")
    false
  } catch (e: NoClassDefFoundError) {
    logger?.debug("Kotlin compiler class definition error: ${e.message}")
    false
  } catch (e: LinkageError) {
    logger?.debug("Kotlin compiler linkage error: ${e.message}")
    false
  }
}

/** Parse Kotlin file using Kotlin compiler AST (PSI) */
fun parseKotlinFileWithAst(
    file: File,
    psiManager: PsiManager,
    logger: org.gradle.api.logging.Logger? = null
): MutableMap<String, String>? {
  return try {
    val content = file.readText()
    val result = mutableMapOf<String, String>()

    // Create virtual file and parse it using provided PsiManager
    val ktFile =
        try {
          val virtualFile = LightVirtualFile(file.name, KotlinFileType.INSTANCE, content)
          psiManager.findFile(virtualFile) as? KtFile
        } catch (e: Exception) {
          logger?.warn(
              "PSI parsing error for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
          return null
        } ?: return null

    // Process all top-level classes
    val topLevelClasses = ktFile.getChildrenOfType<KtClass>()

    for (topClass in topLevelClasses) {
      processClass(topClass, "", null, result)
    }

    result
  } catch (e: Exception) {
    // Fall back to regex parsing if AST parsing fails
    logger?.warn(
        "Kotlin AST parsing failed for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
    null
  }
}

/** Create Kotlin compiler environment for AST parsing */
fun createKotlinEnvironment():
    Pair<org.jetbrains.kotlin.com.intellij.openapi.Disposable, PsiManager>? {
  return try {
    val disposable = Disposer.newDisposable()
    val compilerConfiguration = CompilerConfiguration()
    val environment =
        KotlinCoreEnvironment.createForProduction(
            disposable, compilerConfiguration, EnvironmentConfigFiles.JVM_CONFIG_FILES)
    val psiManager = PsiManager.getInstance(environment.project)
    disposable to psiManager
  } catch (e: Exception) {
    null
  }
}

private fun processClass(
    ktClass: KtClass,
    packageName: String,
    parentClass: KtClass?,
    result: MutableMap<String, String>
) {
  val className = ktClass.name ?: return

  // Skip fake classes - they are test doubles, not actual test classes
  if (className.startsWith("Fake")) {
    return
  }

  // Only include regular classes - skip data classes, object declarations, enum classes, etc.
  if (ktClass.hasModifier(KtTokens.DATA_KEYWORD) ||
      ktClass.hasModifier(KtTokens.ENUM_KEYWORD) ||
      ktClass.hasModifier(KtTokens.SEALED_KEYWORD) ||
      ktClass.hasModifier(KtTokens.ABSTRACT_KEYWORD)) {
    return
  }

  val hasNestedAnnotation =
      ktClass.annotationEntries.any { annotation ->
        val annotationName = annotation.shortName?.asString() ?: ""
        val fullAnnotationText = annotation.text
        annotationName == "Nested" ||
            classQualifiedTestAnnotations.any { fullAnnotationText.contains(it) }
      }

  // Check if this class has any test annotations (class-level or method-level)
  if (parentClass == null) {
    // Top-level class processing
    val nestedWithAnnotation =
        ktClass.getChildrenOfType<KtClass>().filter { nestedClass ->
          nestedClass.annotationEntries.any { annotation ->
            val annotationName = annotation.shortName?.asString() ?: ""
            annotationName == "Nested"
          }
        }

    if (nestedWithAnnotation.isNotEmpty()) {
      // This top-level class has @Nested children - process them instead of the parent
      for (nestedClass in nestedWithAnnotation) {
        val nestedClassName = nestedClass.name ?: continue
        val nestedKey = "$className$nestedClassName"
        result[nestedKey] = "$className$$nestedClassName"
      }
    } else {
      // No @Nested children - include the top-level class
      result[className] = className
    }
  } else {
    // This should not be reached with the current logic, but keeping for completeness
    if (hasNestedAnnotation) {
      val parentName = parentClass.name ?: return
      val nestedKey = "$parentName$className"
      result[nestedKey] = "$parentName$$className"
    }
  }
}

private fun hasTestAnnotations(ktClass: KtClass): Boolean {
  // Check class-level annotations
  val hasClassAnnotations =
      ktClass.annotationEntries.any { annotation ->
        val annotationName = annotation.shortName?.asString() ?: ""
        val fullAnnotationText = annotation.text
        classTestAnnotationNames.contains(annotationName) ||
            classQualifiedTestAnnotations.any { fullAnnotationText.contains(it) }
      }

  // Check method-level annotations
  val hasMethodAnnotations =
      ktClass.declarations.any { declaration ->
        declaration.annotationEntries.any { annotation ->
          val annotationName = annotation.shortName?.asString() ?: ""
          val fullAnnotationText = annotation.text
          methodTestAnnotationNames.contains(annotationName) ||
              methodQualifiedTestAnnotations.any { fullAnnotationText.contains(it) }
        }
      }

  return hasClassAnnotations || hasMethodAnnotations
}
