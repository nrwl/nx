package dev.nx.maven.reflection

import org.codehaus.plexus.classworlds.ClassWorld
import org.slf4j.LoggerFactory
import java.lang.reflect.Field
import java.lang.reflect.Method

/**
 * Utility for safe reflection operations on Maven classes loaded at runtime.
 *
 * This helper provides defensive reflection that handles:
 * - Missing methods/fields (version differences)
 * - Access control (private/protected members)
 * - Type conversions
 * - Fallback strategies
 */
object ReflectionHelper {
  private val log = LoggerFactory.getLogger(ReflectionHelper::class.java)

  /**
   * Load a class from the plexus.core ClassRealm.
   * This loads classes from the user's Maven installation at runtime.
   */
  fun loadClass(classWorld: ClassWorld, className: String): Class<*> {
    return try {
      val classRealm = classWorld.getClassRealm("plexus.core")
      classRealm.loadClass(className)
    } catch (e: ClassNotFoundException) {
      throw RuntimeException("Could not load Maven class: $className - ensure Maven 4.x is properly installed", e)
    }
  }

  /**
   * Safely invoke a method via reflection with fallback support.
   *
   * @param target The object to invoke the method on
   * @param methodName The method name
   * @param parameterTypes Parameter types for method signature
   * @param args Arguments to pass to the method
   * @param fallback Function to call if method doesn't exist (version difference)
   * @return Method return value, or fallback result if method not found
   */
  fun <T> invokeMethod(
    target: Any,
    methodName: String,
    parameterTypes: Array<Class<*>>,
    args: Array<Any?>,
    fallback: (() -> T)? = null
  ): T? {
    return try {
      val method = target.javaClass.getMethod(methodName, *parameterTypes)
      method.isAccessible = true
      @Suppress("UNCHECKED_CAST")
      method.invoke(target, *args) as T?
    } catch (e: NoSuchMethodException) {
      if (fallback != null) {
        log.debug("Method $methodName not found, using fallback")
        fallback()
      } else {
        throw RuntimeException("Method $methodName not found and no fallback provided", e)
      }
    }
  }

  /**
   * Safely get a field value via reflection.
   *
   * @param target The object to get the field from
   * @param fieldName The field name
   * @param fallback Value to return if field doesn't exist
   * @return Field value, or fallback if field not found
   */
  fun <T> getField(
    target: Any,
    fieldName: String,
    fallback: T? = null
  ): T? {
    return try {
      val field = findField(target.javaClass, fieldName)
      field.isAccessible = true
      @Suppress("UNCHECKED_CAST")
      field.get(target) as T?
    } catch (e: NoSuchFieldException) {
      if (fallback != null) {
        log.debug("Field $fieldName not found, using fallback")
        fallback
      } else {
        throw RuntimeException("Field $fieldName not found and no fallback provided", e)
      }
    }
  }

  /**
   * Safely set a field value via reflection.
   *
   * @param target The object to set the field on
   * @param fieldName The field name
   * @param value The value to set
   */
  fun setField(
    target: Any,
    fieldName: String,
    value: Any?
  ) {
    try {
      val field = findField(target.javaClass, fieldName)
      field.isAccessible = true
      field.set(target, value)
    } catch (e: NoSuchFieldException) {
      throw RuntimeException("Field $fieldName not found", e)
    }
  }

  /**
   * Find a field in a class or its superclasses.
   * Handles inheritance hierarchy.
   */
  private fun findField(clazz: Class<*>, fieldName: String): Field {
    var currentClass: Class<*>? = clazz
    while (currentClass != null) {
      try {
        return currentClass.getDeclaredField(fieldName)
      } catch (e: NoSuchFieldException) {
        currentClass = currentClass.superclass
      }
    }
    throw NoSuchFieldException("Field $fieldName not found in $clazz or its superclasses")
  }

  /**
   * Find a method in a class or its superclasses with optional parameter matching.
   * Useful when exact parameter types aren't known at compile time.
   */
  fun findMethod(
    clazz: Class<*>,
    methodName: String,
    parameterCount: Int? = null
  ): Method? {
    var currentClass: Class<*>? = clazz
    while (currentClass != null) {
      val methods = currentClass.declaredMethods.filter { it.name == methodName }
      if (parameterCount != null) {
        methods.firstOrNull { it.parameterCount == parameterCount }?.let { return it }
      } else {
        methods.firstOrNull()?.let { return it }
      }
      currentClass = currentClass.superclass
    }
    return null
  }

  /**
   * Check if a method exists on a class.
   * Useful for version detection / feature detection.
   */
  fun hasMethod(
    clazz: Class<*>,
    methodName: String,
    vararg parameterTypes: Class<*>
  ): Boolean {
    return try {
      clazz.getMethod(methodName, *parameterTypes)
      true
    } catch (e: NoSuchMethodException) {
      false
    }
  }

  /**
   * Check if a field exists on a class.
   */
  fun hasField(clazz: Class<*>, fieldName: String): Boolean {
    return try {
      findField(clazz, fieldName)
      true
    } catch (e: NoSuchFieldException) {
      false
    }
  }
}
