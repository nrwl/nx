package dev.nx.maven.runner

import org.apache.maven.api.services.Lookup
import org.apache.maven.api.services.LookupException
import org.codehaus.plexus.PlexusContainer
import org.codehaus.plexus.component.repository.exception.ComponentLookupException
import java.util.Optional

/**
 * Adapter that bridges PlexusContainer (Maven 3.x) to the Lookup interface (Maven 4.x API).
 *
 * This allows Maven 3.x components to be accessed through the same Lookup interface
 * used by NxMaven, enabling code reuse between Maven 3.x and 4.x implementations.
 */
class PlexusLookupAdapter(
  private val container: PlexusContainer
) : Lookup {

  override fun <T : Any> lookup(type: Class<T>): T {
    return try {
      container.lookup(type)
    } catch (e: ComponentLookupException) {
      throw LookupException("Component not found: ${type.name}", e)
    }
  }

  override fun <T : Any> lookup(type: Class<T>, name: String): T {
    return try {
      container.lookup(type, name)
    } catch (e: ComponentLookupException) {
      throw LookupException("Component not found: ${type.name} with name: $name", e)
    }
  }

  override fun <T : Any> lookupOptional(type: Class<T>): Optional<T> {
    return try {
      Optional.ofNullable(container.lookup(type))
    } catch (e: ComponentLookupException) {
      Optional.empty()
    }
  }

  override fun <T : Any> lookupOptional(type: Class<T>, name: String): Optional<T> {
    return try {
      Optional.ofNullable(container.lookup(type, name))
    } catch (e: ComponentLookupException) {
      Optional.empty()
    }
  }

  override fun <T : Any> lookupList(type: Class<T>): List<T> {
    return try {
      container.lookupList(type)
    } catch (e: ComponentLookupException) {
      emptyList()
    }
  }

  override fun <T : Any> lookupMap(type: Class<T>): Map<String, T> {
    return try {
      container.lookupMap(type)
    } catch (e: ComponentLookupException) {
      emptyMap()
    }
  }
}
