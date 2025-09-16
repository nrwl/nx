package dev.nx.maven

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap

/**
 * Provides knowledge about known Maven plugin parameters and their input/output roles.
 * Loads plugin parameter mappings from a JSON resource file.
 */
class PluginKnowledge {
    private val log = LoggerFactory.getLogger(PluginKnowledge::class.java)
    private val mapper = jacksonObjectMapper()

    // Cache for parsed plugin knowledge
    private val knowledgeCache = ConcurrentHashMap<String, PluginKnowledgeData>()

    companion object {
        private const val KNOWLEDGE_RESOURCE = "/known-plugin-parameters.json"

        @Volatile
        private var instance: PluginKnowledge? = null

        fun getInstance(): PluginKnowledge {
            return instance ?: synchronized(this) {
                instance ?: PluginKnowledge().also { instance = it }
            }
        }
    }

    private val pluginData: PluginKnowledgeData by lazy {
        loadKnowledgeData()
    }

    /**
     * Gets the parameter role for a specific plugin, goal, and parameter combination.
     *
     * @param pluginArtifactId The plugin artifact ID (e.g., "maven-compiler-plugin")
     * @param goal The goal name (e.g., "compile")
     * @param parameterName The parameter name (e.g., "outputDirectory")
     * @return The ParameterRole if known, null otherwise
     */
    fun getParameterRole(pluginArtifactId: String?, goal: String?, parameterName: String?): ParameterRole? {
        if (pluginArtifactId == null || goal == null || parameterName == null) {
            return null
        }

        return try {
            val plugin = pluginData.plugins[pluginArtifactId] ?: return null
            val goalData = plugin.goals[goal] ?: return null

            val role = when {
                goalData.inputParameters.contains(parameterName) -> ParameterRole.INPUT
                goalData.outputParameters.contains(parameterName) -> ParameterRole.OUTPUT
                else -> return null
            }

            log.debug("Found parameter role from knowledge: $pluginArtifactId:$goal.$parameterName -> $role")
            role
        } catch (e: Exception) {
            log.warn("Error looking up parameter role for $pluginArtifactId:$goal.$parameterName: ${e.message}")
            null
        }
    }

    /**
     * Checks if a plugin is known in the knowledge base.
     */
    fun isKnownPlugin(pluginArtifactId: String?): Boolean {
        return pluginArtifactId?.let { pluginData.plugins.containsKey(it) } ?: false
    }

    /**
     * Checks if a specific goal is known for a plugin.
     */
    fun isKnownGoal(pluginArtifactId: String?, goal: String?): Boolean {
        if (pluginArtifactId == null || goal == null) return false
        return pluginData.plugins[pluginArtifactId]?.goals?.containsKey(goal) ?: false
    }

    /**
     * Gets all known input parameters for a specific plugin and goal.
     */
    fun getKnownInputParameters(pluginArtifactId: String?, goal: String?): Set<String> {
        if (pluginArtifactId == null || goal == null) return emptySet()
        return pluginData.plugins[pluginArtifactId]?.goals?.get(goal)?.inputParameters?.toSet() ?: emptySet()
    }

    /**
     * Gets all known output parameters for a specific plugin and goal.
     */
    fun getKnownOutputParameters(pluginArtifactId: String?, goal: String?): Set<String> {
        if (pluginArtifactId == null || goal == null) return emptySet()
        return pluginData.plugins[pluginArtifactId]?.goals?.get(goal)?.outputParameters?.toSet() ?: emptySet()
    }

    private fun loadKnowledgeData(): PluginKnowledgeData {
        return try {
            val resourceStream = javaClass.getResourceAsStream(KNOWLEDGE_RESOURCE)
                ?: throw IllegalStateException("Could not find resource: $KNOWLEDGE_RESOURCE")

            resourceStream.use { stream ->
                val knowledgeData = mapper.readValue<PluginKnowledgeData>(stream)
                log.info("Loaded plugin knowledge for ${knowledgeData.plugins.size} plugins")
                knowledgeData
            }
        } catch (e: Exception) {
            log.warn("Failed to load plugin knowledge from $KNOWLEDGE_RESOURCE: ${e.message}. Using empty knowledge base.")
            PluginKnowledgeData(emptyMap())
        }
    }
}

/**
 * Data structure for plugin knowledge loaded from JSON.
 */
data class PluginKnowledgeData(
    val plugins: Map<String, PluginData>
)

data class PluginData(
    val goals: Map<String, GoalData>
)

data class GoalData(
    val inputParameters: List<String>,
    val outputParameters: List<String>
)