package dev.nx.maven.cache

import org.codehaus.plexus.util.xml.Xpp3Dom
import org.codehaus.plexus.util.xml.Xpp3DomBuilder
import org.slf4j.LoggerFactory

/**
 * Loads cache configuration from XML using custom data types.
 * Uses Xpp3DomBuilder for parsing without dependency on build cache extension.
 */
class CacheConfigLoader {

    private val log = LoggerFactory.getLogger(CacheConfigLoader::class.java)

    /**
     * Loads cache configuration from a resource path
     */
    fun loadConfig(resourcePath: String): CacheConfig {
        return try {
            val stream = javaClass.getResourceAsStream(resourcePath)
            if (stream == null) {
                log.debug("Resource not found: $resourcePath, using empty configuration")
                return CacheConfig()
            }

            stream.use {
                val dom = Xpp3DomBuilder.build(it, "UTF-8")
                val config = parseDom(dom)
                log.info("Loaded cache configuration with ${config.plugins.size} plugins")
                config
            }
        } catch (e: Exception) {
            log.warn("Failed to load cache configuration from $resourcePath: ${e.message}. Using empty configuration.")
            CacheConfig()
        }
    }

    private fun parseDom(dom: Xpp3Dom): CacheConfig {
        val plugins = mutableMapOf<String, PluginConfig>()
        val globalIncludes = mutableListOf<PathPattern>()
        val globalExcludes = mutableListOf<PathPattern>()
        val alwaysRunPlugins = mutableSetOf<String>()

        // Parse input section
        dom.getChild("input")?.let { inputElement ->
            // Parse global includes/excludes
            inputElement.getChild("global")?.let { globalElement ->
                globalElement.getChild("includes")?.let { includesElement ->
                    for (includeElement in includesElement.getChildren("include")) {
                        val path = includeElement.getAttribute("value") ?: continue
                        globalIncludes.add(PathPattern(
                            path = path,
                            glob = includeElement.getAttribute("glob"),
                            recursive = includeElement.getAttribute("recursive")?.toBoolean() ?: false
                        ))
                    }
                }

                globalElement.getChild("excludes")?.let { excludesElement ->
                    for (excludeElement in excludesElement.getChildren("exclude")) {
                        val path = excludeElement.getAttribute("value") ?: continue
                        globalExcludes.add(PathPattern(
                            path = path,
                            glob = excludeElement.getAttribute("glob"),
                            recursive = false
                        ))
                    }
                }
            }

            // Parse plugins
            inputElement.getChild("plugins")?.let { pluginsElement ->
                for (pluginElement in pluginsElement.getChildren("plugin")) {
                    val artifactId = pluginElement.getAttribute("artifactId") ?: continue
                    val pluginConfig = parsePluginConfig(artifactId, pluginElement)
                    plugins[artifactId] = pluginConfig
                }
            }
        }

        // Parse execution control for always run plugins
        dom.getChild("executionControl")?.let { executionElement ->
            executionElement.getChild("runAlways")?.let { runAlwaysElement ->
                runAlwaysElement.getChild("plugins")?.let { pluginsElement ->
                    for (pluginElement in pluginsElement.getChildren("plugin")) {
                        pluginElement.getAttribute("artifactId")?.let { artifactId ->
                            alwaysRunPlugins.add(artifactId)
                        }
                    }
                }
            }
        }

        return CacheConfig(
            globalIncludes = globalIncludes,
            globalExcludes = globalExcludes,
            plugins = plugins,
            alwaysRunPlugins = alwaysRunPlugins
        )
    }

    private fun parsePluginConfig(artifactId: String, pluginElement: Xpp3Dom): PluginConfig {
        val inputParameters = mutableSetOf<String>()
        val outputParameters = mutableSetOf<String>()

        pluginElement.getChild("dirScan")?.let { dirScanElement ->
            // Parse includes (input parameters)
            dirScanElement.getChild("includes")?.let { includesElement ->
                for (includeElement in includesElement.getChildren("include")) {
                    includeElement.getAttribute("tagName")?.let { tagName ->
                        inputParameters.add(tagName)
                    }
                }
            }

            // Parse excludes (output parameters)
            dirScanElement.getChild("excludes")?.let { excludesElement ->
                for (excludeElement in excludesElement.getChildren("exclude")) {
                    excludeElement.getAttribute("tagName")?.let { tagName ->
                        outputParameters.add(tagName)
                    }
                }
            }
        }

        return PluginConfig(
            artifactId = artifactId,
            inputParameters = inputParameters,
            outputParameters = outputParameters
        )
    }
}