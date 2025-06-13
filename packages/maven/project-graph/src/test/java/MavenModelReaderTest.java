import org.apache.maven.model.Model;
import org.apache.maven.model.Plugin;
import org.apache.maven.model.PluginExecution;
import org.apache.maven.model.Dependency;
import org.apache.maven.model.Build;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;
import java.util.*;

public class MavenModelReaderTest {

    private Model model;

    @Before
    public void setUp() {
        model = new Model();
        model.setGroupId("com.example");
        model.setArtifactId("test-project");
        model.setPackaging("jar");
        
        // Initialize Build object
        Build build = new Build();
        model.setBuild(build);
    }

    @Test
    public void testIsInternalDependency() {
        // Test internal Quarkus dependency
        assertTrue(MavenModelReader.isInternalDependency("io.quarkus", "quarkus-core"));

        // Test non-internal dependency
        assertFalse(MavenModelReader.isInternalDependency("org.springframework", "spring-core"));

        // Test null values
        assertFalse(MavenModelReader.isInternalDependency(null, "quarkus-core"));
        assertFalse(MavenModelReader.isInternalDependency("io.quarkus", null));

        // Test excluded artifacts
        assertFalse(MavenModelReader.isInternalDependency("io.quarkus", "quarkus-fs-util"));
        assertFalse(MavenModelReader.isInternalDependency("io.quarkus", "quarkus-spring-context-api"));
    }

    @Test
    public void testDetectRelevantPhases() {
        // Test basic jar packaging phases
        List<String> phases = MavenModelReader.detectRelevantPhases(model);
        assertTrue(phases.contains("clean"));
        assertTrue(phases.contains("validate"));
        assertTrue(phases.contains("compile"));
        assertTrue(phases.contains("test"));
        assertTrue(phases.contains("package"));
        assertTrue(phases.contains("install"));
        assertTrue(phases.contains("deploy"));

        // Test pom packaging phases
        model.setPackaging("pom");
        phases = MavenModelReader.detectRelevantPhases(model);
        assertTrue(phases.contains("clean"));
        assertTrue(phases.contains("validate"));
        assertTrue(phases.contains("install"));
        assertTrue(phases.contains("deploy"));
        assertFalse(phases.contains("compile")); // Should not have compile for pom packaging
    }

    @Test
    public void testDetectPluginGoals() {
        // Add a plugin with executions
        Plugin plugin = new Plugin();
        plugin.setGroupId("org.apache.maven.plugins");
        plugin.setArtifactId("maven-compiler-plugin");

        PluginExecution execution = new PluginExecution();
        execution.setId("default-test");
        execution.setPhase("test");
        execution.addGoal("test");

        plugin.addExecution(execution);
        model.getBuild().addPlugin(plugin);

        // Test plugin goal detection
        List<Map<String, Object>> goals = MavenModelReader.detectPluginGoals(model);
        assertFalse(goals.isEmpty());

        // Verify goal information
        boolean foundTestGoal = false;
        for (Map<String, Object> goal : goals) {
            if ("test".equals(goal.get("goal"))) {
                foundTestGoal = true;
                assertEquals("org.apache.maven.plugins:maven-compiler-plugin", goal.get("pluginKey"));
                assertEquals("test", goal.get("phase"));
                assertEquals("default-test", goal.get("executionId"));
                break;
            }
        }
        assertTrue("Should find test goal", foundTestGoal);
    }

    @Test
    public void testDetectPhaseDependencies() {
        List<String> phases = Arrays.asList("validate", "compile", "test", "package");
        Map<String, List<String>> dependencies = MavenModelReader.detectPhaseDependencies(phases);

        // Test basic phase dependencies
        assertTrue(dependencies.containsKey("compile"));
        assertTrue(dependencies.get("compile").contains("process-resources"));

        assertTrue(dependencies.containsKey("test"));
        assertTrue(dependencies.get("test").contains("process-test-classes"));

        assertTrue(dependencies.containsKey("package"));
        assertTrue(dependencies.get("package").contains("prepare-package"));
    }

    @Test
    public void testDetectCrossProjectTargetDependencies() {
        List<String> internalDeps = Arrays.asList("com.example:dep1", "com.example:dep2");
        List<String> relevantPhases = Arrays.asList("compile", "test", "package");
        List<Map<String, Object>> pluginGoals = new ArrayList<>();

        Map<String, List<String>> deps = MavenModelReader.detectCrossProjectTargetDependencies(internalDeps,
                relevantPhases, pluginGoals);

        // Test compile phase dependencies
        assertTrue(deps.containsKey("compile"));
        List<String> compileDeps = deps.get("compile");
        assertTrue(compileDeps.contains("com.example:dep1:compile|validate"));
        assertTrue(compileDeps.contains("com.example:dep2:compile|validate"));

        // Test package phase dependencies
        assertTrue(deps.containsKey("package"));
        List<String> packageDeps = deps.get("package");
        assertTrue(packageDeps.contains("com.example:dep1:package|compile|validate"));
        assertTrue(packageDeps.contains("com.example:dep2:package|compile|validate"));
    }

    @Test
    public void testOrganizeGoalsByPhase() {
        List<Map<String, Object>> pluginGoals = new ArrayList<>();
        List<String> relevantPhases = Arrays.asList("validate", "compile", "test", "package");

        // Add a test goal
        Map<String, Object> testGoal = new HashMap<>();
        testGoal.put("targetName", "test:unit");
        testGoal.put("goal", "test");
        testGoal.put("phase", "test");
        testGoal.put("targetType", "test");
        pluginGoals.add(testGoal);

        // Add a compile goal
        Map<String, Object> compileGoal = new HashMap<>();
        compileGoal.put("targetName", "compile:main");
        compileGoal.put("goal", "compile");
        compileGoal.put("phase", "compile");
        compileGoal.put("targetType", "build");
        pluginGoals.add(compileGoal);

        Map<String, List<String>> organized = MavenModelReader.organizeGoalsByPhase(pluginGoals, relevantPhases);

        // Verify organization
        assertTrue(organized.containsKey("test"));
        assertTrue(organized.get("test").contains("test:unit"));

        assertTrue(organized.containsKey("compile"));
        assertTrue(organized.get("compile").contains("compile:main"));
    }

    @Test
    public void testGenerateGoalDependencies() {
        List<Map<String, Object>> pluginGoals = new ArrayList<>();
        List<String> relevantPhases = Arrays.asList("validate", "compile", "test", "package");

        // Add goals
        Map<String, Object> testGoal = new HashMap<>();
        testGoal.put("targetName", "test:unit");
        testGoal.put("goal", "test");
        testGoal.put("phase", "test");
        testGoal.put("targetType", "test");
        pluginGoals.add(testGoal);

        Map<String, Object> compileGoal = new HashMap<>();
        compileGoal.put("targetName", "compile:main");
        compileGoal.put("goal", "compile");
        compileGoal.put("phase", "compile");
        compileGoal.put("targetType", "build");
        pluginGoals.add(compileGoal);

        // Create goals by phase
        Map<String, List<String>> goalsByPhase = new HashMap<>();
        goalsByPhase.put("compile", Arrays.asList("compile:main"));
        goalsByPhase.put("test", Arrays.asList("test:unit"));

        // Create phase dependencies
        Map<String, List<String>> phaseDependencies = new HashMap<>();
        phaseDependencies.put("test", Arrays.asList("compile"));
        phaseDependencies.put("compile", Arrays.asList("validate"));

        Map<String, List<String>> goalDeps = MavenModelReader.generateGoalDependencies(pluginGoals, goalsByPhase,
                phaseDependencies, relevantPhases);

        // Verify dependencies
        assertTrue(goalDeps.containsKey("test:unit"));
        assertTrue(goalDeps.get("test:unit").contains("compile:main"));
    }
}
