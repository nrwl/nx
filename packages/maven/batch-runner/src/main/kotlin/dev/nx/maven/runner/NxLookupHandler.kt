package dev.nx.maven.runner

import org.slf4j.LoggerFactory
import java.lang.reflect.InvocationHandler
import java.lang.reflect.Method

/**
 * InvocationHandler for a dynamic Lookup proxy that intercepts Maven.class lookups.
 *
 * IMPORTANT: This class must NOT import any Maven classes directly.
 * All Maven interactions happen via reflection because this class is loaded
 * by the system classloader but Maven classes are only available in the ClassRealm.
 *
 * When Maven code calls lookup(Maven.class), this handler returns NxMaven instead
 * of the default Maven implementation, enabling our session caching.
 */
class NxLookupHandler(
  private val delegate: Any,  // The actual Lookup instance
  private val classRealm: ClassLoader
) : InvocationHandler {
  private val log = LoggerFactory.getLogger(NxLookupHandler::class.java)

  @Volatile
  private var nxMaven: Any? = null

  @Volatile
  private var nxMavenInitialized = false

  override fun invoke(proxy: Any?, method: Method, args: Array<out Any>?): Any? {
    val methodName = method.name

    // Special handling for lookup(Class) to intercept Maven.class
    if (methodName == "lookup" && args?.size == 1 && args[0] is Class<*>) {
      val type = args[0] as Class<*>
      if (type.name == "org.apache.maven.Maven") {
        return getOrCreateNxMaven()
      }
    }

    // Special handling for lookupOptional(Class) to intercept Maven.class
    if (methodName == "lookupOptional" && args?.size == 1 && args[0] is Class<*>) {
      val type = args[0] as Class<*>
      if (type.name == "org.apache.maven.Maven") {
        val nxMaven = getOrCreateNxMaven()
        val optionalClass = Class.forName("java.util.Optional")
        val ofMethod = optionalClass.getMethod("of", Any::class.java)
        return ofMethod.invoke(null, nxMaven)
      }
    }

    // Delegate all other calls to the actual Lookup
    return if (args == null) {
      method.invoke(delegate)
    } else {
      method.invoke(delegate, *args)
    }
  }

  @Synchronized
  private fun getOrCreateNxMaven(): Any {
    if (nxMavenInitialized && nxMaven != null) {
      return nxMaven!!
    }

    log.debug("Creating NxMaven via NxLookupHandler...")

    // Load NxMavenFactory via ClassRealm (it has Maven imports)
    val factoryClass = classRealm.loadClass("dev.nx.maven.runner.NxMavenFactory")
    val lookupClass = classRealm.loadClass("org.apache.maven.api.services.Lookup")
    val constructor = factoryClass.getConstructor(lookupClass)
    val factory = constructor.newInstance(delegate)

    // Call factory.create() to get NxMaven
    val createMethod = factoryClass.getMethod("create")
    nxMaven = createMethod.invoke(factory)
    nxMavenInitialized = true

    log.debug("NxMaven created and cached via handler")
    return nxMaven!!
  }

  /**
   * Get the NxMaven instance if created, for use by ResidentMavenExecutor.
   */
  fun getNxMaven(): Any? = nxMaven
}
