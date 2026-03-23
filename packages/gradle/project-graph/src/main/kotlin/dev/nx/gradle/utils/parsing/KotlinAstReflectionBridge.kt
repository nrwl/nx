package dev.nx.gradle.utils.parsing

import java.io.File
import org.gradle.api.logging.Logger

object KotlinAstReflectionBridge {

  fun isCompilerAvailable(classLoader: ClassLoader, logger: Logger? = null): Boolean {
    return try {
      Class.forName(
          "org.jetbrains.kotlin.cli.jvm.compiler.KotlinCoreEnvironment", true, classLoader)
      Class.forName("org.jetbrains.kotlin.config.CompilerConfiguration", true, classLoader)
      Class.forName("org.jetbrains.kotlin.psi.KtFile", true, classLoader)
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

  fun createEnvironment(classLoader: ClassLoader): ReflectionEnvironment? {
    return try {
      val disposerClass =
          Class.forName(
              "org.jetbrains.kotlin.com.intellij.openapi.util.Disposer", true, classLoader)
      val disposable = disposerClass.getMethod("newDisposable").invoke(null)

      val compilerConfigClass =
          Class.forName("org.jetbrains.kotlin.config.CompilerConfiguration", true, classLoader)
      val compilerConfig = compilerConfigClass.getDeclaredConstructor().newInstance()

      val envConfigFilesClass =
          Class.forName(
              "org.jetbrains.kotlin.cli.jvm.compiler.EnvironmentConfigFiles", true, classLoader)
      val jvmConfigFiles = envConfigFilesClass.getField("JVM_CONFIG_FILES").get(null)

      val coreEnvClass =
          Class.forName(
              "org.jetbrains.kotlin.cli.jvm.compiler.KotlinCoreEnvironment", true, classLoader)
      val disposableInterface =
          Class.forName("org.jetbrains.kotlin.com.intellij.openapi.Disposable", true, classLoader)
      val createMethod =
          coreEnvClass.getMethod(
              "createForProduction", disposableInterface, compilerConfigClass, envConfigFilesClass)
      val environment = createMethod.invoke(null, disposable, compilerConfig, jvmConfigFiles)

      val projectObj = environment.javaClass.getMethod("getProject").invoke(environment)

      val psiManagerClass =
          Class.forName("org.jetbrains.kotlin.com.intellij.psi.PsiManager", true, classLoader)
      val intellijProjectClass =
          Class.forName(
              "org.jetbrains.kotlin.com.intellij.openapi.project.Project", true, classLoader)
      val psiManager =
          psiManagerClass.getMethod("getInstance", intellijProjectClass).invoke(null, projectObj)

      ReflectionEnvironment(disposable, psiManager, classLoader)
    } catch (e: Exception) {
      null
    }
  }

  fun parseKotlinFile(
      file: File,
      env: ReflectionEnvironment,
      logger: Logger? = null
  ): MutableMap<String, String>? {
    return try {
      val content = file.readText()
      val result = mutableMapOf<String, String>()
      val cl = env.classLoader

      val kotlinFileTypeClass = Class.forName("org.jetbrains.kotlin.idea.KotlinFileType", true, cl)
      val fileTypeInstance = kotlinFileTypeClass.getField("INSTANCE").get(null)

      val lightVirtualFileClass =
          Class.forName(
              "org.jetbrains.kotlin.com.intellij.testFramework.LightVirtualFile", true, cl)
      val fileTypeInterface =
          Class.forName("org.jetbrains.kotlin.com.intellij.openapi.fileTypes.FileType", true, cl)
      val virtualFile =
          lightVirtualFileClass
              .getConstructor(String::class.java, fileTypeInterface, CharSequence::class.java)
              .newInstance(file.name, fileTypeInstance, content)

      val virtualFileClass =
          Class.forName("org.jetbrains.kotlin.com.intellij.openapi.vfs.VirtualFile", true, cl)
      val psiFile =
          try {
            env.psiManager.javaClass
                .getMethod("findFile", virtualFileClass)
                .invoke(env.psiManager, virtualFile)
          } catch (e: Exception) {
            logger?.warn(
                "PSI parsing error for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
            return null
          } ?: return null

      val ktFileClass = Class.forName("org.jetbrains.kotlin.psi.KtFile", true, cl)
      if (!ktFileClass.isInstance(psiFile)) return null

      val ktClassClass = Class.forName("org.jetbrains.kotlin.psi.KtClass", true, cl)
      val topLevelClasses = getChildrenOfType(psiFile, ktClassClass)

      for (topClass in topLevelClasses) {
        processClassReflective(topClass, null, result, cl)
      }

      result
    } catch (e: Exception) {
      logger?.warn(
          "Kotlin AST parsing failed for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
      null
    }
  }

  fun dispose(env: ReflectionEnvironment) {
    try {
      val disposerClass =
          Class.forName(
              "org.jetbrains.kotlin.com.intellij.openapi.util.Disposer", true, env.classLoader)
      val disposableInterface =
          Class.forName(
              "org.jetbrains.kotlin.com.intellij.openapi.Disposable", true, env.classLoader)
      disposerClass.getMethod("dispose", disposableInterface).invoke(null, env.disposable)
    } catch (_: Exception) {}
  }

  private fun processClassReflective(
      ktClass: Any,
      parentClass: Any?,
      result: MutableMap<String, String>,
      classLoader: ClassLoader
  ) {
    val className = ktClass.javaClass.getMethod("getName").invoke(ktClass) as? String ?: return

    if (className.startsWith("Fake")) return

    if (hasModifier(ktClass, "DATA_KEYWORD", classLoader) ||
        hasModifier(ktClass, "ENUM_KEYWORD", classLoader) ||
        hasModifier(ktClass, "SEALED_KEYWORD", classLoader) ||
        hasModifier(ktClass, "ABSTRACT_KEYWORD", classLoader) ||
        isAnnotationClass(ktClass)) {
      return
    }

    val ktClassClass = Class.forName("org.jetbrains.kotlin.psi.KtClass", true, classLoader)

    if (parentClass == null) {
      val nestedClasses = getChildrenOfType(ktClass, ktClassClass)
      val nestedWithAnnotation =
          nestedClasses.filter { nestedClass ->
            getAnnotationEntries(nestedClass).any { annotation ->
              getAnnotationShortName(annotation) == "Nested"
            }
          }

      if (nestedWithAnnotation.isNotEmpty()) {
        for (nestedClass in nestedWithAnnotation) {
          val nestedClassName =
              nestedClass.javaClass.getMethod("getName").invoke(nestedClass) as? String ?: continue
          val nestedKey = "$className$nestedClassName"
          result[nestedKey] = "$className$$nestedClassName"
        }
      } else {
        result[className] = className
      }
    } else {
      val hasNestedAnnotation =
          getAnnotationEntries(ktClass).any { annotation ->
            val annotationName = getAnnotationShortName(annotation)
            val fullAnnotationText = getAnnotationText(annotation)
            annotationName == "Nested" ||
                classQualifiedTestAnnotations.any { fullAnnotationText.contains(it) }
          }

      if (hasNestedAnnotation) {
        val parentName =
            parentClass.javaClass.getMethod("getName").invoke(parentClass) as? String ?: return
        val nestedKey = "$parentName$className"
        result[nestedKey] = "$parentName$$className"
      }
    }
  }

  private fun hasModifier(ktClass: Any, tokenFieldName: String, classLoader: ClassLoader): Boolean {
    return try {
      val ktTokensClass = Class.forName("org.jetbrains.kotlin.lexer.KtTokens", true, classLoader)
      val token = ktTokensClass.getField(tokenFieldName).get(null)
      val ktModifierKeywordTokenClass =
          Class.forName("org.jetbrains.kotlin.lexer.KtModifierKeywordToken", true, classLoader)
      val hasModifierMethod =
          ktClass.javaClass.getMethod("hasModifier", ktModifierKeywordTokenClass)
      hasModifierMethod.invoke(ktClass, token) as Boolean
    } catch (_: Exception) {
      false
    }
  }

  private fun isAnnotationClass(ktClass: Any): Boolean {
    return try {
      ktClass.javaClass.getMethod("isAnnotation").invoke(ktClass) as Boolean
    } catch (_: Exception) {
      false
    }
  }

  private fun getAnnotationEntries(element: Any): List<Any> {
    return try {
      @Suppress("UNCHECKED_CAST")
      element.javaClass.getMethod("getAnnotationEntries").invoke(element) as? List<Any>
          ?: emptyList()
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun getAnnotationShortName(annotation: Any): String {
    return try {
      val shortName = annotation.javaClass.getMethod("getShortName").invoke(annotation) ?: return ""
      shortName.javaClass.getMethod("asString").invoke(shortName) as? String ?: ""
    } catch (_: Exception) {
      ""
    }
  }

  private fun getAnnotationText(annotation: Any): String {
    return try {
      annotation.javaClass.getMethod("getText").invoke(annotation) as? String ?: ""
    } catch (_: Exception) {
      ""
    }
  }

  private fun getChildrenOfType(element: Any, childClass: Class<*>): List<Any> {
    return try {
      val children =
          element.javaClass.getMethod("getChildren").invoke(element) as? Array<*>
              ?: return emptyList()
      children.filterNotNull().filter { childClass.isInstance(it) }
    } catch (_: Exception) {
      emptyList()
    }
  }
}

data class ReflectionEnvironment(
    val disposable: Any,
    val psiManager: Any,
    val classLoader: ClassLoader
)
