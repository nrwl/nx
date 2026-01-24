package dev.nx.maven.targets

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.nx.maven.GitIgnoreClassifier
import dev.nx.maven.utils.MojoAnalyzer
import dev.nx.maven.utils.PathFormatter
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.DefaultLifecycles
import org.apache.maven.model.Plugin
import org.apache.maven.model.PluginExecution
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.PluginDescriptor
import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File

data class GoalDescriptor(
  val pluginDescriptor: PluginDescriptor,
  val mojoDescriptor: MojoDescriptor,
  val goal: String,
  val goalSpecifier: String,
  val executionPriority: Int = 50, // Default priority - Maven uses 50 as default
  val executionId: String = "default"
)

/**
 * Collects lifecycle and plugin information directly from Maven APIs
 */
class NxTargetFactory(
  private val lifecycles: DefaultLifecycles,
  private val testClassDiscovery: TestClassDiscovery,
  private val pluginManager: MavenPluginManager,
  private val session: MavenSession,
  private val mojoAnalyzer: MojoAnalyzer,
  private val pathFormatter: PathFormatter,
  private val gitIgnoreClassifier: GitIgnoreClassifier,
  private val targetNamePrefix: String
) {
  private val log: Logger = LoggerFactory.getLogger(NxTargetFactory::class.java)


  fun createNxTargets(
    project: MavenProject
  ): Pair<JsonObject, JsonObject> {
    val nxTargets = JsonObject()
    val targetGroups = mutableMapOf<String, List<String>>()

    val plugins = getExecutablePlugins(project)

    // Collect all goals by phase from plugin executions
    val phaseGoals = collectGoalsByPhase(plugins, project)

    val phaseTargets = mutableMapOf<String, NxTarget>()
    val ciPhaseTargets = mutableMapOf<String, NxTarget>()
    val ciPhasesWithGoals = mutableSetOf<String>() // Track which CI phases have goals

    // Create phase targets from lifecycle (all phases get targets, either with goals or as noop)
    // CI phase targets are only created if they have goals or are "verify" phase
    processLifecyclePhases(
      lifecycles.lifeCycles,
      phaseGoals,
      project,
      phaseTargets,
      ciPhaseTargets,
      ciPhasesWithGoals
    )

    // Create individual goal targets for granular execution
    createIndividualGoalTargets(plugins, project, nxTargets)

    val mavenPhasesGroup = mutableListOf<String>()
    phaseTargets.forEach { (phase, target) ->
      nxTargets.add(phase, target.toJSON())
      mavenPhasesGroup.add(phase)
    }
    targetGroups["Phases"] = mavenPhasesGroup

    val ciPhasesGroup = mutableListOf<String>()
    ciPhaseTargets.forEach { (phase, target) ->
      nxTargets.add(phase, target.toJSON())
      ciPhasesGroup.add(phase)
    }
    targetGroups["CI Phases"] = ciPhasesGroup

    if (phaseGoals.contains("test")) {
      val atomizedTestTargets = generateAtomizedTestTargets(
        project,
        nxTargets,
        ciPhaseTargets["${applyPrefix("test-ci")}"]!!,
        phaseGoals["test"]!!
      )

      atomizedTestTargets.forEach { (goal, target) ->
        nxTargets.add(goal, target.toJSON())
      }
      targetGroups["Test CI"] = atomizedTestTargets.keys.toList()
    } else {
      log.info("No test goals found for project ${project.artifactId}, skipping atomized test target generation")
    }

    val targetGroupsJson = buildTargetGroupsJson(targetGroups)
    return Pair(nxTargets, targetGroupsJson)
  }

  /**
   * Creates a phase target that uses the batch executor for multi-task Maven execution.
   * This is similar to createPhaseTarget but delegates to the Maven batch runner.
   */
  private fun createPhaseBatchTarget(
    project: MavenProject, phase: String, goals: List<GoalDescriptor>
  ): NxTarget {
    // Sort goals by priority (lower numbers execute first)
    val sortedGoals = goals.sortedWith(compareBy<GoalDescriptor> { it.executionPriority }.thenBy { it.executionId })

    // Inline analysis logic from PhaseAnalyzer
    val plugins = project.build.plugins
    var isCacheable = true
    var isContinuous = false
    val inputs = JsonArray()
    val outputs = mutableSetOf<String>()

    val analyses = plugins
      .flatMap { plugin ->
        val pluginDescriptor = runCatching { getPluginDescriptor(plugin, project) }
          .getOrElse { throwable ->
            log.warn(
              "Failed to resolve plugin descriptor for ${plugin.groupId}:${plugin.artifactId}: ${throwable.message}"
            )
            return@flatMap emptyList()
          }

        plugin.executions
          .filter { execution -> normalizePhase(execution.phase) == phase }
          .flatMap { execution ->
            log.info(
              "Analyzing ${project.groupId}:${project.artifactId} execution: ${execution.id} -> phase: ${execution.phase}, goals: ${execution.goals}"
            )

            execution.goals.filterNotNull().mapNotNull { goal ->
              mojoAnalyzer.analyzeMojo(pluginDescriptor, goal, project)
            }
          }
      }

    // Aggregate analysis results
    analyses.forEach { analysis ->
      if (!analysis.isCacheable) {
        isCacheable = false
      }
      if (analysis.isContinuous) {
        isContinuous = true
      }

      analysis.inputs.forEach { input -> inputs.add(input) }
      analysis.outputs.forEach { output -> outputs.add(output) }
      analysis.dependentTaskOutputInputs.forEach { input ->
        val obj = JsonObject()
        obj.addProperty("dependentTasksOutputFiles", input.path)
        if (input.transitive) obj.addProperty("transitive", true)
        inputs.add(obj)
      }
    }

    log.info("Phase $phase batch analysis: cacheable: $isCacheable, inputs: $inputs, outputs: $outputs")

    val options = JsonObject()

    // Build phase and goals configuration for batch executor
    options.addProperty("phase", phase)

    // Add all goals for this phase (sorted by priority)
    val goalsArray = JsonArray()
    sortedGoals.forEach { goal -> goalsArray.add(goal.goalSpecifier) }
    options.add("goals", goalsArray)

    // Add standard Maven arguments
    options.addProperty("project", "${project.groupId}:${project.artifactId}")

    log.info("Created batch phase target '$phase' with executor: @nx/maven:maven-batch")

    // Use the batch executor instead of run-commands
    val target = NxTarget("@nx/maven:maven", options, isCacheable, isContinuous)

    // Copy caching info from analysis
    if (isCacheable) {
      // Convert inputs to JsonArray
      val inputsArray = JsonArray()
      inputs.forEach { input -> inputsArray.add(input) }
      target.inputs = inputsArray

      // Convert outputs to JsonArray
      val outputsArray = JsonArray()
      outputs.forEach { output -> outputsArray.add(output) }
      target.outputs = outputsArray
      addBuildStateJsonInputsAndOutputs(project, target)
    }

    return target
  }

  private fun processLifecyclePhases(
    lifecycles: List<org.apache.maven.lifecycle.Lifecycle>,
    phaseGoals: Map<String, MutableList<GoalDescriptor>>,
    project: MavenProject,
    phaseTargets: MutableMap<String, NxTarget>,
    ciPhaseTargets: MutableMap<String, NxTarget>,
    ciPhasesWithGoals: MutableSet<String>
  ) {
    lifecycles.forEach { lifecycle ->
      log.info(
        "Analyzing ${lifecycle.phases.size} phases for ${project.artifactId}: ${
          lifecycle.phases.joinToString(", ")
        }"
      )

      val hasInstall = lifecycle.phases.contains("install")
      val testIndex = lifecycle.phases.indexOf("test")

      // First pass: create regular phase targets
      lifecycle.phases.forEachIndexed { index, phase ->
        createRegularPhaseTarget(
          lifecycle.phases, index, phase, phaseGoals, project,
          phaseTargets, hasInstall
        )
      }

      // Second pass: create CI phase targets (depends on first pass completing)
      lifecycle.phases.forEachIndexed { index, phase ->
        if (testIndex > -1) {
          createCiPhaseTarget(
            lifecycle.phases, index, phase, phaseGoals, project,
            ciPhaseTargets, ciPhasesWithGoals, hasInstall
          )
        }
      }
    }
  }

  private fun createRegularPhaseTarget(
    phases: List<String>,
    index: Int,
    phase: String,
    phaseGoals: Map<String, MutableList<GoalDescriptor>>,
    project: MavenProject,
    phaseTargets: MutableMap<String, NxTarget>,
    hasInstall: Boolean
  ) {
    val goalsForPhase = phaseGoals[phase]
    val hasGoals = goalsForPhase?.isNotEmpty() == true

    // Create target for all phases - either with goals or as noop
    val target = createPhaseBatchTarget(project, phase, goalsForPhase ?: emptyList())


    target.dependsOn = target.dependsOn ?: JsonArray()

    if (hasInstall) {
      val dependsOnNode = JsonObject()
      dependsOnNode.addProperty("target", applyPrefix("install"))
      dependsOnNode.addProperty("dependencies", true)
      dependsOnNode.addProperty("params", "forward")
      target.dependsOn?.add(dependsOnNode)
    }

    // Add dependency on immediate previous phase (if exists)
    val previousPhase = phases.getOrNull(index - 1)
    if (previousPhase != null) {
      val dependsOnNode = JsonObject()
      dependsOnNode.addProperty("target", applyPrefix(previousPhase))
      dependsOnNode.addProperty("params", "forward")
      target.dependsOn?.add(dependsOnNode)
    }

    phaseTargets[applyPrefix(phase)] = target

    if (hasGoals) {
      log.info("Created phase target '${applyPrefix(phase)}' with ${goalsForPhase?.size ?: 0} goals")
    } else {
      log.info("Created noop phase target '${applyPrefix(phase)}' (no goals)")
    }
  }

  private fun createCiPhaseTarget(
    phases: List<String>,
    index: Int,
    phase: String,
    phaseGoals: Map<String, MutableList<GoalDescriptor>>,
    project: MavenProject,
    ciPhaseTargets: MutableMap<String, NxTarget>,
    ciPhasesWithGoals: MutableSet<String>,
    hasInstall: Boolean
  ) {
    val goalsForPhase = phaseGoals[phase]
    val hasGoals = goalsForPhase?.isNotEmpty() == true
    val ciPhaseName = "${applyPrefix(phase)}-ci"

    // Test and later phases get a CI counterpart - but only if they have goals
    if (!shouldCreateCiPhase(hasGoals, phase)) {
      log.info("Skipping noop CI phase target '$ciPhaseName' (no goals)")
      return
    }

    // Create CI targets for phases with goals, or noop for test/structural phases
    val ciTarget = if (hasGoals && phase != "test") {
      createPhaseBatchTarget(project, phase, goalsForPhase!!)
    } else {
      // Noop for test phase (will be orchestrated by atomized tests) or structural phases
      createPhaseBatchTarget(project, phase, emptyList())
    }
    // Initialize dependsOn for all CI targets (for atomized tests or phase dependencies)
    ciTarget.dependsOn = ciTarget.dependsOn ?: JsonArray()

    // Find the nearest previous phase that has a CI target
    val previousCiPhase = findPreviousCiPhase(phases, index, ciPhasesWithGoals)

    if (previousCiPhase != null) {
      log.info("CI phase '$phase' depends on previous CI phase: '$previousCiPhase'")
      val dependsOnNode = JsonObject()
      dependsOnNode.addProperty("target", "${applyPrefix(previousCiPhase)}-ci")
      dependsOnNode.addProperty("params", "forward")
      ciTarget.dependsOn?.add(dependsOnNode)
    }

    if (hasInstall) {
      val dependsOnNode = JsonObject()
      dependsOnNode.addProperty("target", "${applyPrefix("install")}-ci")
      dependsOnNode.addProperty("dependencies", true)
      dependsOnNode.addProperty("params", "forward")
      ciTarget.dependsOn?.add(dependsOnNode)
    }

    ciPhaseTargets[ciPhaseName] = ciTarget
    // Track all CI phases so the dependency chain is preserved
    ciPhasesWithGoals.add(phase)

    if (hasGoals) {
      log.info("Created CI phase target '$ciPhaseName' with goals")
    } else {
      log.info("Created noop CI phase target '$ciPhaseName'")
    }
  }

  private fun collectGoalsByPhase(
    plugins: List<Plugin>,
    project: MavenProject
  ): Map<String, MutableList<GoalDescriptor>> {
    val phaseGoals = mutableMapOf<String, MutableList<GoalDescriptor>>()

    plugins.forEach { plugin: Plugin ->
      val pluginDescriptor = getPluginDescriptor(plugin, project)
      val goalPrefix = pluginDescriptor.goalPrefix

      plugin.executions.forEach { execution ->
        execution.goals.forEach { goal ->
          val mojoDescriptor = pluginDescriptor.getMojo(goal)
          val phase = execution.phase ?: mojoDescriptor?.phase
          val normalizedPhase = normalizePhase(phase)

          if (normalizedPhase != null) {
            val goalSpec = "$goalPrefix:$goal@${execution.id}"
            val executionPriority = getExecutionPriority(execution)

            val goalDescriptor = GoalDescriptor(
              pluginDescriptor = pluginDescriptor,
              mojoDescriptor = mojoDescriptor,
              goal = goal,
              goalSpecifier = goalSpec,
              executionPriority = executionPriority,
              executionId = execution.id
            )

            phaseGoals.computeIfAbsent(normalizedPhase) { mutableListOf() }.add(goalDescriptor)
            log.info("Added goal $goalSpec to phase $normalizedPhase with priority $executionPriority")
          }
        }
      }
    }

    return phaseGoals
  }

  private fun createIndividualGoalTargets(
    plugins: List<Plugin>,
    project: MavenProject,
    nxTargets: JsonObject
  ) {
    plugins.forEach { plugin: Plugin ->
      val pluginDescriptor = runCatching { getPluginDescriptor(plugin, project) }
        .getOrElse { throwable ->
          log.warn(
            "Failed to resolve plugin descriptor for ${plugin.groupId}:${plugin.artifactId}: ${throwable.message}"
          )
          return@forEach
        }
      val goalPrefix = pluginDescriptor.goalPrefix

      // Track which goals are bound to executions
      val boundGoals = mutableSetOf<String>()

      plugin.executions.forEach { execution ->
        execution.goals.forEach { goal ->
          boundGoals.add(goal)

          val goalTargetName = applyPrefix("$goalPrefix:$goal@${execution.id}")
          val goalTarget = createSimpleGoalTarget(
            project,
            pluginDescriptor,
            goalPrefix,
            goal,
            execution
          ) ?: return@forEach
          nxTargets.add(goalTargetName, goalTarget.toJSON())

          log.info("Created individual goal target: $goalTargetName")
        }
      }

      // Handle unbound goals (goals defined in plugin but not bound to any execution)
      pluginDescriptor.mojos?.forEach { mojoDescriptor ->
        val goal = mojoDescriptor.goal
        if (!boundGoals.contains(goal)) {
          val goalTargetName = applyPrefix("$goalPrefix:$goal")
          val goalTarget = createSimpleGoalTarget(
            project,
            pluginDescriptor,
            goalPrefix,
            goal,
            null
          ) ?: return@forEach
          nxTargets.add(goalTargetName, goalTarget.toJSON())

          log.info("Created unbound goal target: $goalTargetName")
        }
      }
    }
  }

  private fun findPreviousCiPhase(
    lifecycle: List<String>,
    index: Int,
    ciPhasesWithGoals: Set<String>
  ): String? {
    for (prevIdx in index - 1 downTo 0) {
      val prevPhase = lifecycle.getOrNull(prevIdx)
      if (prevPhase != null && ciPhasesWithGoals.contains(prevPhase)) {
        return prevPhase
      }
    }
    return null
  }

  private fun shouldCreateCiPhase(hasGoals: Boolean, phase: String): Boolean {
    return hasGoals || phase == "verify"
  }

  private fun buildTargetGroupsJson(targetGroups: Map<String, List<String>>): JsonObject {
    val targetGroupsJson = JsonObject()
    targetGroups.forEach { (groupName, targets) ->
      val targetsArray = JsonArray()
      targets.forEach { target -> targetsArray.add(target) }
      targetGroupsJson.add(groupName, targetsArray)
    }
    return targetGroupsJson
  }

  private fun createNoopPhaseTarget(
    phase: String
  ): NxTarget {
    log.info("Creating noop target for phase '$phase' (no goals)")
    return NxTarget("nx:noop", null, cache = true, continuous = false)
  }

  private fun createSimpleGoalTarget(
    project: MavenProject,
    pluginDescriptor: PluginDescriptor,
    goalPrefix: String,
    goalName: String,
    execution: PluginExecution?
  ): NxTarget? {
    val options = JsonObject()
    val goalSpec = if (execution != null) "$goalPrefix:$goalName@${execution.id}" else "$goalPrefix:$goalName"

    // Use Maven executor with goal specifier
    options.addProperty("goals", goalSpec)

    // Add standard arguments
    val args = mutableListOf<String>()
    options.addProperty("project", "${project.groupId}:${project.artifactId}")

    val mavenVersion = session.systemProperties.getProperty("maven.version") ?: ""
    if (mavenVersion.startsWith("4")) {
      args.add("-N")
    }

    val argsArray = JsonArray()
    args.forEach { arg -> argsArray.add(arg) }
    options.add("args", argsArray)

    val analysis = mojoAnalyzer.analyzeMojo(pluginDescriptor, goalName, project)
      ?: return null

    val target = NxTarget("@nx/maven:maven", options, analysis.isCacheable, analysis.isContinuous)

    // Add inputs and outputs if cacheable
    if (analysis.isCacheable) {
      // Convert inputs to JsonArray
      val inputsArray = JsonArray()
      analysis.inputs.forEach { input -> inputsArray.add(input) }
      analysis.dependentTaskOutputInputs.forEach { input ->
        val obj = JsonObject()
        obj.addProperty("dependentTasksOutputFiles", input.path)
        if (input.transitive) obj.addProperty("transitive", true)
        inputsArray.add(obj)
      }
      target.inputs = inputsArray

      // Convert outputs to JsonArray
      val outputsArray = JsonArray()
      analysis.outputs.forEach { output -> outputsArray.add(output) }
      target.outputs = outputsArray
    }

    addBuildStateJsonInputsAndOutputs(project, target)
    return target
  }

  private fun getExecutablePlugins(project: MavenProject): List<Plugin> {
    return project.build.plugins
  }

  private fun generateAtomizedTestTargets(
    project: MavenProject,
    nxTargets: JsonObject,
    testCiTarget: NxTarget,
    testGoals: MutableList<GoalDescriptor>
  ): Map<String, NxTarget> {
    val goalDescriptor = testGoals.first()
    val targets = mutableMapOf<String, NxTarget>()

    val testClasses = testClassDiscovery.discoverTestClasses(project)
    val testCiTargetGroup = mutableListOf<String>()

    val analysis = mojoAnalyzer.analyzeMojo(goalDescriptor.pluginDescriptor, goalDescriptor.goal, project)
      ?: return emptyMap()

    testClasses.forEach { testClass ->
      val targetName = applyPrefix("${goalDescriptor.goalSpecifier}--${testClass.packagePath}.${testClass.className}")

      log.info("Generating target for test class: $targetName'")

      val options = JsonObject()

      // Use batch executor with structured options for test class filtering
      val goalsArray = JsonArray()
      goalsArray.add(goalDescriptor.goalSpecifier)
      options.add("goals", goalsArray)

      // Add test class filtering arguments
      val argsArray = JsonArray()
      argsArray.add("-Dtest=${testClass.packagePath}.${testClass.className}")
      argsArray.add("-Dsurefire.failIfNoSpecifiedTests=false")
      options.add("args", argsArray)

      options.addProperty("project", "${project.groupId}:${project.artifactId}")

      val target = NxTarget(
        "@nx/maven:maven",
        options,
        analysis.isCacheable,
        analysis.isContinuous,
        nxTargets.getAsJsonObject("${applyPrefix("test")}-ci").getAsJsonArray("dependsOn").deepCopy(),
        JsonArray(),
        JsonArray()
      )

      analysis.inputs.forEach { input -> target.inputs?.add(input) }
      analysis.outputs.forEach { output -> target.outputs?.add(output) }
      analysis.dependentTaskOutputInputs.forEach { input ->
        val obj = JsonObject()
        obj.addProperty("dependentTasksOutputFiles", input.path)
        if (input.transitive) obj.addProperty("transitive", true)
        target.inputs?.add(obj)
      }

      targets[targetName] = target
      testCiTargetGroup.add(targetName)

      val dependsOnNode = JsonObject()
      dependsOnNode.addProperty("target", targetName)
      dependsOnNode.addProperty("params", "forward")
      testCiTarget.dependsOn!!.add(dependsOnNode)
      addBuildStateJsonInputsAndOutputs(project, target)
    }

    return targets
  }

  private fun addBuildStateJsonInputsAndOutputs(project: MavenProject, target: NxTarget) {
    val buildJsonFile = File("${project.build.directory}/nx-build-state.json")

    val isIgnored = gitIgnoreClassifier.isIgnored(buildJsonFile)
    if (isIgnored) {
      log.warn("Input path is gitignored: ${buildJsonFile.path}")
      val input = pathFormatter.toDependentTaskOutputs(buildJsonFile, project.basedir)
      val obj = JsonObject()
      obj.addProperty("dependentTasksOutputFiles", input.path)
      if (input.transitive) obj.addProperty("transitive", true)
      target.inputs?.add(obj)
    } else {
      val input = pathFormatter.formatInputPath(buildJsonFile, projectRoot = project.basedir)

      target.inputs?.add(input)
    }
    target.outputs?.add(pathFormatter.formatOutputPath(buildJsonFile, project.basedir))
  }


  private fun getPluginDescriptor(
    plugin: Plugin,
    project: MavenProject
  ): PluginDescriptor = pluginManager.getPluginDescriptor(
    plugin, project.remotePluginRepositories, session.repositorySession
  )

  /**
   * Normalizes Maven 3 phase names to Maven 4 equivalents when running Maven 4.
   * Returns the original phase name when running Maven 3.
   */
  private fun normalizePhase(phase: String?): String? {
    if (phase == null) return null

    val mavenVersion = session.systemProperties.getProperty("maven.version") ?: ""
    if (!mavenVersion.startsWith("4")) {
      return phase // Keep original phase names for Maven 3
    }

    return when (phase) {
      "generate-sources" -> "sources"
      "process-sources" -> "after:sources"
      "generate-resources" -> "resources"
      "process-resources" -> "after:resources"
      "process-classes" -> "after:compile"
      "generate-test-sources" -> "test-sources"
      "process-test-sources" -> "after:test-sources"
      "generate-test-resources" -> "test-resources"
      "process-test-resources" -> "after:test-resources"
      "process-test-classes" -> "after:test-compile"
      "prepare-package" -> "before:package"
      "pre-integration-test" -> "before:integration-test"
      "post-integration-test" -> "after:integration-test"
      else -> phase
    }
  }

  /**
   * Applies the targetNamePrefix to a target name if the prefix is non-empty.
   */
  private fun applyPrefix(targetName: String): String {
    return if (targetNamePrefix.isNotEmpty()) {
      "$targetNamePrefix$targetName"
    } else {
      targetName
    }
  }
}


/**
 * Determines the execution priority for a goal within a phase.
 * Maven uses priority to determine the order of execution when multiple goals are bound to the same phase.
 * Lower numbers have higher priority (execute first).
 */
private fun getExecutionPriority(execution: PluginExecution): Int {
  // Maven assigns priorities based on several factors:
  // 1. Explicit priority in execution configuration
  // 2. Plugin goal priority from mojo descriptor
  // 3. Default priority (50)
  // 4. Alphabetical order as tiebreaker

  // For now, we'll use a simple heuristic based on common plugin patterns
  val executionId = execution.id ?: "default"

  // Well-known execution IDs that should run early
  return when {
    executionId.contains("generate") -> 10
    executionId.contains("process") -> 20
    executionId.contains("compile") -> 30
    executionId.contains("test-compile") -> 35
    executionId.contains("test") -> 40
    executionId.contains("package") -> 60
    executionId.contains("install") -> 70
    executionId.contains("deploy") -> 80
    else -> 50 // Default Maven priority
  }
}
