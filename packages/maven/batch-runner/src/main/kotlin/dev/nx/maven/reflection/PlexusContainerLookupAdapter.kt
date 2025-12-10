package dev.nx.maven.reflection

import org.apache.maven.api.services.Lookup
import org.apache.maven.api.services.LookupException
import org.slf4j.LoggerFactory

/**
 * Adapter that makes PlexusContainer (Maven 3.x) compatible with Lookup interface (Maven 4.x).
 *
 * This allows us to use the same NxMaven implementation for both Maven 3.x and 4.x.
 *
 * Maven 3.x uses PlexusContainer for DI, Maven 4.x uses Lookup.
 * Both have similar `lookup(Class)` methods, so we can bridge them via reflection.
 */
class PlexusContainerLookupAdapter(
  private val container: Any
) : Lookup {
  private val log = LoggerFactory.getLogger(PlexusContainerLookupAdapter::class.java)

  // Cache the lookup method for performance
  private val lookupMethod by lazy {
    container.javaClass.getMethod("lookup", Class::class.java)
  }

  private val lookupWithHintMethod by lazy {
    try {
      container.javaClass.getMethod("lookup", Class::class.java, String::class.java)
    } catch (e: NoSuchMethodException) {
      null
    }
  }

  override fun <T : Any> lookup(type: Class<T>): T {
    return lookupOptional(type).orElseThrow {
      LookupException("Component not found: ${type.name}")
    }
  }

  override fun <T : Any> lookup(type: Class<T>, name: String): T {
    return lookupOptional(type, name).orElseThrow {
      LookupException("Component not found: ${type.name} with name '$name'")
    }
  }

  override fun <T : Any> lookupOptional(type: Class<T>): java.util.Optional<T> {
    return try {
      @Suppress("UNCHECKED_CAST")
      val result = lookupMethod.invoke(container, type) as T?
      java.util.Optional.ofNullable(result)
    } catch (e: Exception) {
      log.debug("Failed to lookup ${type.simpleName}: ${e.message}")
      java.util.Optional.empty()
    }
  }

  override fun <T : Any> lookupOptional(type: Class<T>, name: String): java.util.Optional<T> {
    val method = lookupWithHintMethod
    if (method == null) {
      // PlexusContainer doesn't have lookup with hint, fall back to plain lookup
      return lookupOptional(type)
    }

    return try {
      @Suppress("UNCHECKED_CAST")
      val result = method.invoke(container, type, name) as T?
      java.util.Optional.ofNullable(result)
    } catch (e: Exception) {
      log.debug("Failed to lookup ${type.simpleName} with name '$name': ${e.message}")
      java.util.Optional.empty()
    }
  }

  override fun <T : Any> lookupList(type: Class<T>): List<T> {
    return try {
      // PlexusContainer has lookupList method
      val lookupListMethod = container.javaClass.getMethod("lookupList", Class::class.java)
      @Suppress("UNCHECKED_CAST")
      lookupListMethod.invoke(container, type) as List<T>
    } catch (e: Exception) {
      log.debug("Failed to lookup list of ${type.simpleName}: ${e.message}")
      emptyList()
    }
  }

  override fun <T : Any> lookupMap(type: Class<T>): Map<String, T> {
    return try {
      // PlexusContainer has lookupMap method
      val lookupMapMethod = container.javaClass.getMethod("lookupMap", Class::class.java)
      @Suppress("UNCHECKED_CAST")
      lookupMapMethod.invoke(container, type) as Map<String, T>
    } catch (e: Exception) {
      log.debug("Failed to lookup map of ${type.simpleName}: ${e.message}")
      emptyMap()
    }
  }
}
