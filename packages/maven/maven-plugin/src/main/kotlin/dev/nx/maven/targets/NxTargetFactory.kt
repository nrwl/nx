package dev.nx.maven.targets

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
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

private const val APPLY_GOAL = "dev.nx.maven:nx-maven-plugin:apply"

private const val RECORD_GOAL = "dev.nx.maven:nx-maven-plugin:record"


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
  private val objectMapper: ObjectMapper,
  private val testClassDiscovery: TestClassDiscovery,
  private val pluginManager: MavenPluginManager,
  private val session: MavenSession,
  private val mojoAnalyzer: MojoAnalyzer,
  private val pathFormatter: PathFormatter,
  private val gitIgnoreClassifier: GitIgnoreClassifier,
) {
  private val log: Logger = LoggerFactory.getLogger(NxTargetFactory::class.java)


  fun createNxTargets(
    mavenCommand: String, project: MavenProject
  ): Pair<ObjectNode, ObjectNode> {
    val nxTargets = objectMapper.createObjectNode()
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
      mavenCommand,
      phaseTargets,
      ciPhaseTargets,
      ciPhasesWithGoals
    )

    // Create individual goal targets for granular execution
    createIndividualGoalTargets(plugins, project, mavenCommand, nxTargets)

    val mavenPhasesGroup = mutableListOf<String>()
    phaseTargets.forEach { (phase, target) ->
      nxTargets.set<ObjectNode>(phase, target.toJSON(objectMapper))
      mavenPhasesGroup.add(phase)
    }
    targetGroups["Phases"] = mavenPhasesGroup

    val ciPhasesGroup = mutableListOf<String>()
    ciPhaseTargets.forEach { (phase, target) ->
      nxTargets.set<ObjectNode>(phase, target.toJSON(objectMapper))
      ciPhasesGroup.add(phase)
    }
    targetGroups["CI Phases"] = ciPhasesGroup

    if (phaseGoals.contains("test")) {
      val atomizedTestTargets = generateAtomizedTestTargets(
        project,
        mavenCommand,
        nxTargets,
        ciPhaseTargets["test-ci"]!!,
        phaseGoals["test"]!!
      )

      atomizedTestTargets.forEach { (goal, target) ->
        nxTargets.set<ObjectNode>(goal, target.toJSON(objectMapper))
      }
      targetGroups["Test CI"] = atomizedTestTargets.keys.toList()
    } else {
      log.info("No test goals found for project ${project.artifactId}, skipping atomized test target generation")
    }

    val targetGroupsJson = buildTargetGroupsJson(targetGroups)
    return Pair(nxTargets, targetGroupsJson)
  }

  private fun createPhaseTarget(
    project: MavenProject, phase: String, mavenCommand: String, goals: List<GoalDescriptor>
  ): NxTarget {
    // Sort goals by priority (lower numbers execute first)
    val sortedGoals = goals.sortedWith(compareBy<GoalDescriptor> { it.executionPriority }.thenBy { it.executionId })

    // Inline analysis logic from PhaseAnalyzer
    val plugins = project.build.plugins
    var isThreadSafe = true
    var isCacheable = true
    var isContinuous = false
    val inputs = objectMapper.createArrayNode()
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

      if (!analysis.isThreadSafe) {
        isThreadSafe = false
      }
      if (!analysis.isCacheable) {
        isCacheable = false
      }
      if (analysis.isContinuous) {
        isContinuous = true
      }

      analysis.inputs.forEach { input -> inputs.add(input) }
      analysis.outputs.forEach { output -> outputs.add(output) }
      analysis.dependentTaskOutputInputs.forEach { input ->
        val obj = objectMapper.createObjectNode()
        obj.put("dependentTasksOutputFiles", input.path)
        if (input.transitive) obj.put("transitive", true)
        inputs.add(obj)
      }
    }

    log.info("Phase $phase analysis: thread safe: $isThreadSafe, cacheable: $isCacheable, inputs: $inputs, outputs: $outputs")

    val options = objectMapper.createObjectNode()

    // Build command with goals bundled together
    val commandParts = mutableListOf<String>()
    commandParts.add(mavenCommand)

    // Add build state apply (all goals get build state management for maximum compatibility)
    commandParts.add(APPLY_GOAL)

    // Add all goals for this phase (sorted by priority)
    commandParts.addAll(sortedGoals.map { it.goalSpecifier })

    // Add build state record (all goals except install)
    // TODO: install cannot record because it attaches a unique timestamp to artifacts, breaking caching
    if (phase !== "install") {
      commandParts.add(RECORD_GOAL)
    }

    // Add project selection and non-recursive flag
    commandParts.add("-pl")
    commandParts.add("${project.groupId}:${project.artifactId}")

    // Only add -N flag for Maven 4
    val mavenVersion = session.systemProperties.getProperty("maven.version") ?: ""
    if (mavenVersion.startsWith("4")) {
      commandParts.add("-N")
    }

    val command = commandParts.joinToString(" ")
    options.put("command", command)

    log.info("Created phase target '$phase' with command: $command")

    val target = NxTarget("nx:run-commands", options, isCacheable, isContinuous, isThreadSafe)

    // Copy caching info from analysis
    if (isCacheable) {
      // Convert inputs to JsonNode array
      val inputsArray = objectMapper.createArrayNode()
      inputs.forEach { input -> inputsArray.add(input) }
      target.inputs = inputsArray

      // Convert outputs to JsonNode array
      val outputsArray = objectMapper.createArrayNode()
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
    mavenCommand: String,
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
          lifecycle.phases, index, phase, phaseGoals, project, mavenCommand,
          phaseTargets, hasInstall
        )
      }

      // Second pass: create CI phase targets (depends on first pass completing)
      lifecycle.phases.forEachIndexed { index, phase ->
        if (testIndex > -1) {
          createCiPhaseTarget(
            lifecycle.phases, index, phase, phaseGoals, project, mavenCommand,
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
    mavenCommand: String,
    phaseTargets: MutableMap<String, NxTarget>,
    hasInstall: Boolean
  ) {
    val goalsForPhase = phaseGoals[phase]
    val hasGoals = goalsForPhase?.isNotEmpty() == true

    // Create target for all phases - either with goals or as noop
    val target = if (hasGoals) {
      createPhaseTarget(project, phase, mavenCommand, goalsForPhase!!)
    } else {
      createNoopPhaseTarget(phase)
    }

    target.dependsOn = target.dependsOn ?: objectMapper.createArrayNode()

    if (hasInstall) {
      val dependsOnNode = objectMapper.createObjectNode()
      dependsOnNode.put("target", "install")
      dependsOnNode.put("dependencies", true)
      dependsOnNode.put("params", "forward")
      target.dependsOn?.add(dependsOnNode)
    }

    // Add dependency on immediate previous phase (if exists)
    val previousPhase = phases.getOrNull(index - 1)
    if (previousPhase != null) {
      val dependsOnNode = objectMapper.createObjectNode()
      dependsOnNode.put("target", previousPhase)
      dependsOnNode.put("params", "forward")
      target.dependsOn?.add(dependsOnNode)
    }

    phaseTargets[phase] = target

    if (hasGoals) {
      log.info("Created phase target '$phase' with ${goalsForPhase?.size ?: 0} goals")
    } else {
      log.info("Created noop phase target '$phase' (no goals)")
    }
  }

  private fun createCiPhaseTarget(
    phases: List<String>,
    index: Int,
    phase: String,
    phaseGoals: Map<String, MutableList<GoalDescriptor>>,
    project: MavenProject,
    mavenCommand: String,
    ciPhaseTargets: MutableMap<String, NxTarget>,
    ciPhasesWithGoals: MutableSet<String>,
    hasInstall: Boolean
  ) {
    val goalsForPhase = phaseGoals[phase]
    val hasGoals = goalsForPhase?.isNotEmpty() == true
    val ciPhaseName = "$phase-ci"

    // Test and later phases get a CI counterpart - but only if they have goals
    if (!shouldCreateCiPhase(hasGoals, phase)) {
      log.info("Skipping noop CI phase target '$ciPhaseName' (no goals)")
      return
    }

    // Create CI targets for phases with goals, or noop for test/structural phases
    val ciTarget = if (hasGoals && phase != "test") {
      createPhaseTarget(project, phase, mavenCommand, goalsForPhase!!)
    } else {
      // Noop for test phase (will be orchestrated by atomized tests) or structural phases
      createNoopPhaseTarget(phase)
    }
    // Initialize dependsOn for all CI targets (for atomized tests or phase dependencies)
    ciTarget.dependsOn = ciTarget.dependsOn ?: objectMapper.createArrayNode()

    // Find the nearest previous phase that has a CI target
    val previousCiPhase = findPreviousCiPhase(phases, index, ciPhasesWithGoals)

    if (previousCiPhase != null) {
      log.info("CI phase '$phase' depends on previous CI phase: '$previousCiPhase'")
      val dependsOnNode = objectMapper.createObjectNode()
      dependsOnNode.put("target", "$previousCiPhase-ci")
      dependsOnNode.put("params", "forward")
      ciTarget.dependsOn?.add(dependsOnNode)
    }

    if (hasInstall) {
      val dependsOnNode = objectMapper.createObjectNode()
      dependsOnNode.put("target", "install-ci")
      dependsOnNode.put("dependencies", true)
      dependsOnNode.put("params", "forward")
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
    mavenCommand: String,
    nxTargets: ObjectNode
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

          val goalTargetName = "$goalPrefix:$goal@${execution.id}"
          val goalTarget = createSimpleGoalTarget(
            mavenCommand,
            project,
            pluginDescriptor,
            goalPrefix,
            goal,
            execution
          ) ?: return@forEach
          nxTargets.set<ObjectNode>(goalTargetName, goalTarget.toJSON(objectMapper))

          log.info("Created individual goal target: $goalTargetName")
        }
      }

      // Handle unbound goals (goals defined in plugin but not bound to any execution)
      pluginDescriptor.mojos?.forEach { mojoDescriptor ->
        val goal = mojoDescriptor.goal
        if (!boundGoals.contains(goal)) {
          val goalTargetName = "$goalPrefix:$goal"
          val goalTarget = createSimpleGoalTarget(
            mavenCommand,
            project,
            pluginDescriptor,
            goalPrefix,
            goal,
            null
          ) ?: return@forEach
          nxTargets.set<ObjectNode>(goalTargetName, goalTarget.toJSON(objectMapper))

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

  private fun buildTargetGroupsJson(targetGroups: Map<String, List<String>>): ObjectNode {
    val targetGroupsJson = objectMapper.createObjectNode()
    targetGroups.forEach { (groupName, targets) ->
      val targetsArray = objectMapper.createArrayNode()
      targets.forEach { target -> targetsArray.add(target) }
      targetGroupsJson.set<ArrayNode>(groupName, targetsArray)
    }
    return targetGroupsJson
  }

  private fun createNoopPhaseTarget(
    phase: String
  ): NxTarget {
    log.info("Creating noop target for phase '$phase' (no goals)")
    return NxTarget("nx:noop", null, cache = true, false, parallelism = true)
  }

  private fun createSimpleGoalTarget(
    mavenCommand: String,
    project: MavenProject,
    pluginDescriptor: PluginDescriptor,
    goalPrefix: String,
    goalName: String,
    execution: PluginExecution?
  ): NxTarget? {
    val options = objectMapper.createObjectNode()

    // Simple command without nx:apply/nx:record
    val mavenVersion = session.systemProperties.getProperty("maven.version") ?: ""
    val nonRecursiveFlag = if (mavenVersion.startsWith("4")) "-N" else ""
    val goalSpec = if (execution != null) "$goalPrefix:$goalName@${execution.id}" else "$goalPrefix:$goalName"
    val command =
      "$mavenCommand $goalSpec -pl ${project.groupId}:${project.artifactId} $nonRecursiveFlag".replace(
        "  ",
        " "
      )
    options.put("command", command)
    val analysis = mojoAnalyzer.analyzeMojo(pluginDescriptor, goalName, project)
      ?: return null

    val target = NxTarget("nx:run-commands", options, analysis.isCacheable, analysis.isContinuous, analysis.isThreadSafe)

    // Add inputs and outputs if cacheable
    if (analysis.isCacheable) {
      // Convert inputs to JsonNode array
      val inputsArray = objectMapper.createArrayNode()
      analysis.inputs.forEach { input -> inputsArray.add(input) }
      analysis.dependentTaskOutputInputs.forEach { input ->
        val obj = objectMapper.createObjectNode()
        obj.put("dependentTasksOutputFiles", input.path)
        if (input.transitive) obj.put("transitive", true)
        inputsArray.add(obj)
      }
      target.inputs = inputsArray

      // Convert outputs to JsonNode array
      val outputsArray = objectMapper.createArrayNode()
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
    mavenCommand: String,
    nxTargets: ObjectNode,
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
      val targetName = "${goalDescriptor.goalSpecifier}--${testClass.packagePath}.${testClass.className}"

      log.info("Generating target for test class: $targetName'")

      val options = objectMapper.createObjectNode()
      options.put(
        "command",
        "$mavenCommand $APPLY_GOAL ${goalDescriptor.goalSpecifier} $RECORD_GOAL -pl ${project.groupId}:${project.artifactId} -Dtest=${testClass.packagePath}.${testClass.className} -Dsurefire.failIfNoSpecifiedTests=false"
      )

      val target = NxTarget(
        "nx:run-commands",
        options,
        analysis.isCacheable,
        analysis.isContinuous,
        analysis.isThreadSafe,
        nxTargets["test-ci"].get("dependsOn").deepCopy() as ArrayNode,
        objectMapper.createArrayNode(),
        objectMapper.createArrayNode()
      )

      analysis.inputs.forEach { input -> target.inputs?.add(input) }
      analysis.outputs.forEach { output -> target.outputs?.add(output) }
      analysis.dependentTaskOutputInputs.forEach { input ->
        val obj = objectMapper.createObjectNode()
        obj.put("dependentTasksOutputFiles", input.path)
        if (input.transitive) obj.put("transitive", true)
        target.inputs?.add(obj)
      }

      targets[targetName] = target
      testCiTargetGroup.add(targetName)

      val dependsOnNode = objectMapper.createObjectNode()
      dependsOnNode.put("target", targetName)
      dependsOnNode.put("params", "forward")
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
      val obj = objectMapper.createObjectNode()
      obj.put("dependentTasksOutputFiles", input.path)
      if (input.transitive) obj.put("transitive", true)
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
