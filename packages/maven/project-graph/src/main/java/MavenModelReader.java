/**
 * MavenModelReader - Maven Project Analysis Tool for Nx Workspace Integration
 * 
 * This utility analyzes Maven projects within an Nx workspace and generates project graph
 * configurations that enable Nx to understand Maven project dependencies, build phases,
 * and plugin goals. It supports both single-project analysis and hierarchical workspace
 * traversal for comprehensive multi-module Maven project analysis.
 * 
 * KEY FEATURES:
 * 
 * 1. PROJECT DISCOVERY & ANALYSIS
 *    - Reads and parses Maven POM files using effective POM resolution
 *    - Supports both single-file and hierarchical module traversal
 *    - Identifies internal vs external dependencies within the workspace
 *    - Extracts project metadata (groupId, artifactId, packaging, etc.)
 * 
 * 2. DEPENDENCY GRAPH GENERATION
 *    - Analyzes Maven dependencies to build project dependency graphs
 *    - Filters internal dependencies (within workspace) from external ones
 *    - Generates cross-project target dependencies for proper build ordering
 *    - Supports dependency fallback chains (package -> compile -> validate)
 * 
 * 3. MAVEN LIFECYCLE & PHASE DETECTION
 *    - Detects relevant Maven phases based on project packaging type
 *    - Maps packaging types (jar, war, pom, maven-plugin) to appropriate phases
 *    - Analyzes plugin bindings to identify custom phase requirements
 *    - Generates phase-to-phase dependency mappings following Maven lifecycle
 * 
 * 4. PLUGIN GOAL ANALYSIS
 *    - Extracts plugin goals from Maven build configuration
 *    - Identifies useful goals for Nx target generation (build, test, serve, deploy)
 *    - Detects framework-specific goals (Quarkus, Spring Boot, Docker, etc.)
 *    - Organizes goals by their associated Maven phases
 *    - Generates goal-to-goal dependencies for proper execution order
 * 
 * 5. FRAMEWORK DETECTION
 *    - Automatically detects popular Java frameworks (Quarkus, Spring Boot)
 *    - Adds framework-specific goals and phases
 *    - Supports inherited plugin configurations from parent POMs
 * 
 * 6. OUTPUT FORMATS
 *    - Generates JSON output compatible with Nx project graph format
 *    - Default output location: target/maven-results.json (Maven's build directory)
 *    - Customizable via -Dmaven.output.file system property
 *    - Supports both lightweight (basic dependencies) and full analysis modes
 *    - Includes error reporting and processing statistics
 *    - Provides structured project configurations for Nx integration
 * 
 * USAGE MODES:
 * 
 * 1. Single File Analysis:
 *    java MavenModelReader path/to/pom.xml
 * 
 * 2. Nx Configuration Generation:
 *    java MavenModelReader --nx [--hierarchical] [pom-paths...]
 * 
 * 3. Hierarchical Workspace Traversal:
 *    java MavenModelReader --nx --hierarchical
 * 
 * 4. STDIN Input (Legacy):
 *    echo "path/to/pom.xml" | java MavenModelReader --nx --stdin
 * 
 * The tool is designed to integrate Maven projects seamlessly into Nx workspaces,
 * enabling Nx's powerful build orchestration, caching, and task scheduling
 * capabilities for Java/Maven-based projects.
 */

import org.apache.maven.model.Model;
import org.apache.maven.model.Plugin;
import org.apache.maven.model.PluginExecution;
import org.apache.maven.model.Dependency;
import org.apache.maven.model.io.xpp3.MavenXpp3Reader;
import org.apache.maven.model.building.*;
import org.apache.maven.model.resolution.ModelResolver;
import org.apache.maven.repository.internal.MavenRepositorySystemUtils;
import org.apache.maven.repository.internal.MavenResolverModule;
import org.eclipse.aether.DefaultRepositorySystemSession;
import org.eclipse.aether.RepositorySystem;
import org.eclipse.aether.RepositorySystemSession;
import org.eclipse.aether.repository.LocalRepository;
import org.eclipse.aether.repository.RemoteRepository;
import org.eclipse.aether.connector.basic.BasicRepositoryConnectorFactory;
import org.eclipse.aether.impl.DefaultServiceLocator;
import org.eclipse.aether.spi.connector.RepositoryConnectorFactory;
import org.eclipse.aether.transport.file.FileTransporterFactory;
import org.eclipse.aether.transport.http.HttpTransporterFactory;
import org.eclipse.aether.spi.connector.transport.TransporterFactory;
import org.codehaus.plexus.util.xml.Xpp3Dom;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;

public class MavenModelReader {

    public static void main(String[] args) {
        boolean generateNxConfig = false;
        boolean useStdin = false;
        boolean useHierarchical = false;
        List<String> pomPaths = new ArrayList<>();

        // Parse arguments
        for (String arg : args) {
            if ("--nx".equals(arg)) {
                generateNxConfig = true;
            } else if ("--stdin".equals(arg)) {
                useStdin = true;
            } else if ("--hierarchical".equals(arg)) {
                useHierarchical = true;
            } else {
                pomPaths.add(arg);
            }
        }

        try {
            if (generateNxConfig) {
                if (useHierarchical) {
                    // Start from root pom.xml and traverse modules hierarchically
                    generateHierarchicalNxProjectConfigurations();
                } else if (useStdin) {
                    // Read from stdin if requested (legacy mode)
                    pomPaths = readPomPathsFromStdin();
                    generateSequentialNxProjectConfigurations(pomPaths);
                } else if (pomPaths.isEmpty()) {
                    // Default to hierarchical traversal from workspace root
                    generateHierarchicalNxProjectConfigurations();
                } else {
                    // Process specific paths
                    generateSequentialNxProjectConfigurations(pomPaths);
                }
            } else {
                // Single file analysis mode (backwards compatibility)
                if (pomPaths.size() == 1) {
                    String pomPath = pomPaths.get(0);
                    System.err.println("DEBUG: Analyzing single POM file: " + pomPath);
                    Model model = readPomFile(pomPath);
                    System.out.println("Project: " + model.getGroupId() + ":" + model.getArtifactId());

                    // Also run phase and plugin detection for debugging
                    List<String> phases = detectRelevantPhases(model);
                    System.err.println("DEBUG: Detected phases: " + phases);
                    List<Map<String, Object>> pluginGoals = detectPluginGoals(model);
                    System.err.println("DEBUG: Detected " + pluginGoals.size() + " plugin goals:");
                    for (Map<String, Object> goal : pluginGoals) {
                        System.err.println("  - " + goal.get("pluginKey") + ":" + goal.get("goal"));
                    }
                }
            }

        } catch (Exception e) {
            System.err.println("ERROR: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static List<String> readPomPathsFromStdin() throws IOException {
        List<String> pomPaths = new ArrayList<>();
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line;

        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (!line.isEmpty()) {
                pomPaths.add(line);
            }
        }

        System.err.println("INFO: Read " + pomPaths.size() + " POM paths from stdin");
        return pomPaths;
    }

    private static void generateHierarchicalNxProjectConfigurations() {
        System.err.println("INFO: Starting hierarchical Maven module traversal");
        long startTime = System.currentTimeMillis();

        // Create output file in Maven's target directory (default build output)
        String defaultOutputFile = "target/maven-results.json";
        String outputFile = System.getProperty("maven.output.file", defaultOutputFile);
        
        // Ensure target directory exists
        File outputFileObj = new File(outputFile);
        File parentDir = outputFileObj.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
            System.err.println("INFO: Created output directory: " + parentDir.getPath());
        }
        
        System.err.println("INFO: Writing results to " + outputFile);

        try {
            // Start from workspace root pom.xml
            String workspaceRoot = System.getProperty("user.dir");
            String rootPomPath = workspaceRoot + "/pom.xml";
            File rootPomFile = new File(rootPomPath);

            if (!rootPomFile.exists()) {
                throw new Exception("Root pom.xml not found at: " + rootPomPath);
            }

            // PASS 1: Discover all project names first
            List<String> processedPomPaths = new ArrayList<>();
            List<String> discoveredProjects = new ArrayList<>();
            List<String> errors = new ArrayList<>();
            int[] stats = { 0, 0 }; // [processed, successful]

            System.err.println("INFO: Pass 1 - Discovering all project names");
            discoverAllProjects(rootPomPath, workspaceRoot, processedPomPaths, discoveredProjects, stats, errors);

            System.err.println("INFO: Pass 1 completed - Discovered " + discoveredProjects.size() + " projects");

            // PASS 2: Generate configurations with filtered dependencies
            try (FileWriter writer = new FileWriter(outputFile)) {
                writer.write("{\n");

                // Reset for second pass
                processedPomPaths.clear();
                stats[0] = 0;
                stats[1] = 0;
                boolean[] firstProject = { true };

                System.err.println("INFO: Pass 2 - Generating configurations with filtered dependencies");
                traverseModulesWithFiltering(rootPomPath, workspaceRoot, processedPomPaths, discoveredProjects, stats,
                        firstProject, writer, errors);

                // Add errors section to JSON
                writer.write(",\n  \"_errors\": [\n");
                for (int i = 0; i < errors.size(); i++) {
                    if (i > 0)
                        writer.write(",\n");
                    writer.write("    \"" + escapeJsonString(errors.get(i)) + "\"");
                }
                writer.write("\n  ],\n");
                writer.write("  \"_stats\": {\n");
                writer.write("    \"processed\": " + stats[0] + ",\n");
                writer.write("    \"successful\": " + stats[1] + ",\n");
                writer.write("    \"errors\": " + errors.size() + "\n");
                writer.write("  }\n");
                writer.write("}\n");
            }

            long duration = System.currentTimeMillis() - startTime;
            System.err.println("INFO: Hierarchical processing completed in " + duration + "ms");
            System.err.println("INFO: Final results - Total: " + stats[0] + ", Successful: " + stats[1] + ", Errors: "
                    + errors.size());
            System.err.println("INFO: Results written to " + outputFile);

            // Output success message to stdout for TypeScript
            System.out.println("SUCCESS: " + outputFile);

        } catch (Exception e) {
            System.err.println("ERROR: Failed to generate hierarchical configurations: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static void traverseModules(String pomPath, String workspaceRoot, List<String> processedPomPaths,
            List<String> discoveredProjects, int[] stats, boolean[] firstProject, FileWriter writer) throws Exception {

        // Skip if already processed (avoid cycles)
        if (processedPomPaths.contains(pomPath)) {
            return;
        }

        File pomFile = new File(pomPath);
        if (!pomFile.exists()) {
            System.err.println("WARN: POM file not found: " + pomPath);
            return;
        }

        // Read and process this POM
        try {
            stats[0]++; // increment processed count
            processedPomPaths.add(pomPath);

            Model model = readPomFile(pomPath);
            String packaging = model.getPackaging();

            // Process this project (even if it's a parent POM)
            processOneFileLightweightToFile(pomPath, firstProject[0], writer, stats[0]);
            stats[1]++; // increment successful count
            firstProject[0] = false;

            // Track the discovered project name for dependency filtering
            String artifactId = model.getArtifactId();
            String groupId = model.getGroupId();
            if (groupId == null && model.getParent() != null) {
                groupId = model.getParent().getGroupId();
            }
            String projectName = (groupId != null ? groupId : "unknown") + ":" + artifactId;
            discoveredProjects.add(projectName);

            // If this is a parent POM with modules, traverse child modules
            if ("pom".equals(packaging) && model.getModules() != null && !model.getModules().isEmpty()) {
                String parentDir = pomFile.getParent();

                System.err.println("INFO: Processing " + model.getModules().size() + " modules from " + pomPath);

                for (String module : model.getModules()) {
                    String childPomPath = parentDir + "/" + module + "/pom.xml";

                    // Recursively traverse child modules
                    traverseModules(childPomPath, workspaceRoot, processedPomPaths, discoveredProjects, stats,
                            firstProject, writer);
                }
            }

            // Progress reporting every 50 projects
            if (stats[0] % 50 == 0) {
                System.err.println("INFO: Progress: " + stats[0] + " processed, " + stats[1] + " successful");
                System.gc(); // Force cleanup
            }

        } catch (Exception e) {
            System.err.println("ERROR: Failed to process " + pomPath + ": " + e.getMessage());
            // Continue processing other modules
        }
    }

    private static void discoverAllProjects(String pomPath, String workspaceRoot, List<String> processedPomPaths,
            List<String> discoveredProjects, int[] stats, List<String> errors) throws Exception {
        // Skip if already processed (avoid cycles)
        if (processedPomPaths.contains(pomPath)) {
            return;
        }

        File pomFile = new File(pomPath);
        if (!pomFile.exists()) {
            return;
        }

        try {
            stats[0]++; // increment processed count
            processedPomPaths.add(pomPath);

            Model model = readPomFile(pomPath);

            // Get project name
            String artifactId = model.getArtifactId();
            String groupId = model.getGroupId();
            if (groupId == null && model.getParent() != null) {
                groupId = model.getParent().getGroupId();
            }
            String projectName = (groupId != null ? groupId : "unknown") + ":" + artifactId;
            discoveredProjects.add(projectName);

            // Traverse child modules if this is a parent POM
            String packaging = model.getPackaging();
            if ("pom".equals(packaging) && model.getModules() != null && !model.getModules().isEmpty()) {
                String parentDir = pomFile.getParent();
                for (String module : model.getModules()) {
                    String childPomPath = parentDir + "/" + module + "/pom.xml";
                    discoverAllProjects(childPomPath, workspaceRoot, processedPomPaths, discoveredProjects, stats,
                            errors);
                }
            }

        } catch (Exception e) {
            // Collect error but continue processing other modules
            String errorMsg = "Failed to process " + pomPath + ": " + e.getMessage();
            errors.add(errorMsg);
            System.err.println("ERROR: " + errorMsg);
        }
    }

    private static void traverseModulesWithFiltering(String pomPath, String workspaceRoot,
            List<String> processedPomPaths, List<String> discoveredProjects, int[] stats, boolean[] firstProject,
            FileWriter writer, List<String> errors) throws Exception {
        // Skip if already processed (avoid cycles)
        if (processedPomPaths.contains(pomPath)) {
            return;
        }

        File pomFile = new File(pomPath);
        if (!pomFile.exists()) {
            return;
        }

        try {
            stats[0]++; // increment processed count
            processedPomPaths.add(pomPath);

            Model model = readPomFile(pomPath);
            String packaging = model.getPackaging();

            // Process this project with filtered dependencies
            processOneFileLightweightToFileWithFiltering(pomPath, firstProject[0], writer, stats[0],
                    discoveredProjects);
            stats[1]++; // increment successful count
            firstProject[0] = false;

            // If this is a parent POM with modules, traverse child modules
            if ("pom".equals(packaging) && model.getModules() != null && !model.getModules().isEmpty()) {
                String parentDir = pomFile.getParent();
                for (String module : model.getModules()) {
                    String childPomPath = parentDir + "/" + module + "/pom.xml";
                    traverseModulesWithFiltering(childPomPath, workspaceRoot, processedPomPaths, discoveredProjects,
                            stats, firstProject, writer, errors);
                }
            }

        } catch (Exception e) {
            // Collect error but continue processing other modules
            String errorMsg = "Failed to process " + pomPath + ": " + e.getMessage();
            errors.add(errorMsg);
            System.err.println("ERROR: " + errorMsg);
        }
    }

    private static void generateSequentialNxProjectConfigurations(List<String> pomPaths) {
        System.err.println("INFO: Starting sequential processing of " + pomPaths.size() + " Maven projects");
        long startTime = System.currentTimeMillis();

        // Create output file in Maven's target directory (default build output)
        String defaultOutputFile = "target/maven-results.json";
        String outputFile = System.getProperty("maven.output.file", defaultOutputFile);
        
        // Ensure target directory exists
        File outputFileObj = new File(outputFile);
        File parentDir = outputFileObj.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
            System.err.println("INFO: Created output directory: " + parentDir.getPath());
        }
        
        System.err.println("INFO: Writing results to " + outputFile);

        try (FileWriter writer = new FileWriter(outputFile)) {
            // Output JSON start to file
            writer.write("{\n");

            int processed = 0;
            int successful = 0;
            boolean firstProject = true;

            for (String pomPath : pomPaths) {
                processed++;

                try {
                    // Process ONE file at a time with minimal memory footprint
                    processOneFileLightweightToFile(pomPath, firstProject, writer, processed);
                    successful++;
                    firstProject = false;

                    // Progress reporting and GC every 50 files
                    if (processed % 50 == 0) {
                        System.err.println("INFO: Progress: " + processed + "/" + pomPaths.size() + " ("
                                + (processed * 100 / pomPaths.size()) + "%) - Successful: " + successful);
                        System.gc(); // Force cleanup
                    }

                } catch (Exception e) {
                    System.err.println("ERROR: Failed to process " + pomPath + ": " + e.getMessage());
                    // Continue processing other files
                }
            }

            // Close JSON in file
            writer.write("\n}\n");

            long duration = System.currentTimeMillis() - startTime;
            System.err.println("INFO: Sequential processing completed in " + duration + "ms");
            System.err.println("INFO: Final results - Total: " + processed + ", Successful: " + successful);
            System.err.println("INFO: Results written to " + outputFile);

            // Output success message to stdout for TypeScript
            System.out.println("SUCCESS: " + outputFile);

        } catch (IOException e) {
            System.err.println("ERROR: Failed to write output file: " + e.getMessage());
            System.exit(1);
        }
    }

    private static void processOneFileLightweight(String pomPath, boolean isFirst) throws Exception {
        Model model = null;
        try {
            // Read and immediately process
            model = readPomFile(pomPath);
            String artifactId = model.getArtifactId();
            String groupId = model.getGroupId();

            // Use parent groupId if not defined locally
            if (groupId == null && model.getParent() != null) {
                groupId = model.getParent().getGroupId();
            }

            // Create unique project name: groupId:artifactId
            String projectName = (groupId != null ? groupId : "unknown") + ":" + artifactId;

            // Get project root
            File pomFile = new File(pomPath);
            String projectRoot = pomFile.getParent();
            if (projectRoot == null) {
                projectRoot = ".";
            }

            // Convert absolute path to relative path
            if (projectRoot.startsWith("/")) {
                String workspaceRoot = System.getProperty("user.dir");
                if (projectRoot.startsWith(workspaceRoot + "/")) {
                    projectRoot = projectRoot.substring(workspaceRoot.length() + 1);
                }
            }

            // Count internal dependencies only (no complex objects)
            int internalDepCount = 0;
            if (model.getDependencies() != null) {
                for (Dependency dep : model.getDependencies()) {
                    if (isInternalDependency(dep.getGroupId(), dep.getArtifactId())) {
                        internalDepCount++;
                    }
                }
            }

            // Output minimal JSON immediately
            if (!isFirst) {
                System.out.println(",");
            }

            System.out.print("  \"" + escapeJsonString(projectRoot) + "\": {");
            System.out.print("\"name\":\"" + escapeJsonString(projectName) + "\",");
            System.out.print("\"projectType\":\"library\",");
            System.out.print("\"internalDeps\":" + internalDepCount);
            System.out.print("}");

        } finally {
            // Explicitly clear references
            model = null;
        }
    }

    private static void processOneFileLightweightToFile(String pomPath, boolean isFirst, FileWriter writer,
            int processed) throws Exception {
        Model model = null;
        try {
            // Only log every 10 projects to reduce output
            if (processed % 10 == 1) {
                System.err.println("DEBUG: Processing " + pomPath);
            }

            // Read and immediately process
            model = readPomFile(pomPath);
            String artifactId = model.getArtifactId();
            String groupId = model.getGroupId();

            // Use parent groupId if not defined locally
            if (groupId == null && model.getParent() != null) {
                groupId = model.getParent().getGroupId();
            }

            // Create unique project name: groupId:artifactId
            String projectName = (groupId != null ? groupId : "unknown") + ":" + artifactId;

            // Get project root
            File pomFile = new File(pomPath);
            String projectRoot = pomFile.getParent();
            if (projectRoot == null) {
                projectRoot = ".";
            }

            // Convert absolute path to relative path
            if (projectRoot.startsWith("/")) {
                String workspaceRoot = System.getProperty("user.dir");
                if (projectRoot.startsWith(workspaceRoot + "/")) {
                    projectRoot = projectRoot.substring(workspaceRoot.length() + 1);
                }
            }

            // Count internal dependencies and collect their names
            List<String> internalDeps = new ArrayList<>();
            if (model.getDependencies() != null) {
                for (Dependency dep : model.getDependencies()) {
                    if (isInternalDependency(dep.getGroupId(), dep.getArtifactId())) {
                        // Use the same groupId:artifactId format for dependencies
                        String depName = dep.getGroupId() + ":" + dep.getArtifactId();
                        internalDeps.add(depName);
                    }
                }
            }

            // Write to file
            if (!isFirst) {
                writer.write(",\n");
            }

            writer.write("  \"" + escapeJsonString(projectRoot) + "\": {\n");
            writer.write("    \"name\": \"" + escapeJsonString(projectName) + "\",\n");
            writer.write("    \"projectType\": \"library\",\n");
            writer.write("    \"implicitDependencies\": {\n");
            writer.write("      \"projects\": [");
            for (int i = 0; i < internalDeps.size(); i++) {
                if (i > 0)
                    writer.write(", ");
                writer.write("\"" + escapeJsonString(internalDeps.get(i)) + "\"");
            }
            writer.write("]\n");
            writer.write("    }\n");
            writer.write("  }");

            // Only log every 25 projects to reduce output
            if (processed % 25 == 0 || processed == 1) {
                System.err.println("DEBUG: Processed " + projectName + " (" + processed + " total)");
            }

        } finally {
            // Explicitly clear references
            model = null;
        }
    }

    private static void processOneFileLightweightToFileWithFiltering(String pomPath, boolean isFirst, FileWriter writer,
            int processed, List<String> discoveredProjects) throws Exception {
        Model model = null;
        try {
            // Only log every 10 projects to reduce output
            if (processed % 10 == 1) {
                System.err.println("DEBUG: Processing " + pomPath);
            }

            // Read and immediately process
            model = readPomFile(pomPath);
            String artifactId = model.getArtifactId();
            String groupId = model.getGroupId();

            // Use parent groupId if not defined locally
            if (groupId == null && model.getParent() != null) {
                groupId = model.getParent().getGroupId();
            }

            // Create unique project name: groupId:artifactId
            String projectName = (groupId != null ? groupId : "unknown") + ":" + artifactId;

            // Get project root
            File pomFile = new File(pomPath);
            String projectRoot = pomFile.getParent();
            if (projectRoot == null) {
                projectRoot = ".";
            }

            // Convert absolute path to relative path
            if (projectRoot.startsWith("/")) {
                String workspaceRoot = System.getProperty("user.dir");
                if (projectRoot.startsWith(workspaceRoot + "/")) {
                    projectRoot = projectRoot.substring(workspaceRoot.length() + 1);
                }
            }

            // Filter internal dependencies to only include discovered projects
            List<String> internalDeps = new ArrayList<>();
            if (model.getDependencies() != null) {
                for (Dependency dep : model.getDependencies()) {
                    if (isInternalDependency(dep.getGroupId(), dep.getArtifactId())) {
                        String depName = dep.getGroupId() + ":" + dep.getArtifactId();
                        // Only include if the dependency is in our discovered projects list
                        if (discoveredProjects.contains(depName)) {
                            internalDeps.add(depName);
                        }
                    }
                }
            }

            // Detect relevant phases and plugin goals
            System.err.println("DEBUG: About to detect phases for " + projectName);
            List<String> relevantPhases = detectRelevantPhases(model);
            System.err.println("DEBUG: Found " + relevantPhases.size() + " phases: " + relevantPhases);
            List<Map<String, Object>> pluginGoals = detectPluginGoals(model);
            System.err.println("DEBUG: Found " + pluginGoals.size() + " plugin goals");

            // Detect phase dependencies using Maven lifecycle information
            Map<String, List<String>> phaseDependencies = detectPhaseDependencies(relevantPhases);
            System.err.println("DEBUG: Detected phase dependencies for " + phaseDependencies.size() + " phases");

            // Detect cross-project target dependencies
            Map<String, List<String>> crossProjectDependencies = detectCrossProjectTargetDependencies(internalDeps,
                    relevantPhases, pluginGoals);
            System.err.println(
                    "DEBUG: Detected cross-project dependencies for " + crossProjectDependencies.size() + " targets");

            // NEW: Organize goals by phase for better task graph structure
            // First pass: organize goals and identify missing phases
            Map<String, List<String>> goalsByPhase = organizeGoalsByPhase(pluginGoals, relevantPhases);
            System.err.println("DEBUG: Organized goals by phase for " + goalsByPhase.size() + " phases");

            // Add missing phases that goals need (like test-compile)
            addMissingPhasesForGoals(pluginGoals, relevantPhases, goalsByPhase);

            // Regenerate phase dependencies with new phases
            Map<String, List<String>> updatedPhaseDependencies = detectPhaseDependencies(relevantPhases);

            // NEW: Generate goal-to-goal dependencies (goals depend on goals from prerequisite phases)
            Map<String, List<String>> goalDependencies = generateGoalDependencies(pluginGoals, goalsByPhase,
                    updatedPhaseDependencies, relevantPhases);
            System.err.println("DEBUG: Generated goal dependencies for " + goalDependencies.size() + " goals");

            // Write to file
            if (!isFirst) {
                writer.write(",\n");
            }

            writer.write("  \"" + escapeJsonString(projectRoot) + "\": {\n");
            writer.write("    \"name\": \"" + escapeJsonString(projectName) + "\",\n");
            writer.write("    \"projectType\": \"library\",\n");
            writer.write("    \"implicitDependencies\": {\n");
            writer.write("      \"projects\": [");
            for (int i = 0; i < internalDeps.size(); i++) {
                if (i > 0)
                    writer.write(", ");
                writer.write("\"" + escapeJsonString(internalDeps.get(i)) + "\"");
            }
            writer.write("]\n");
            writer.write("    },\n");

            // Add relevant phases
            writer.write("    \"relevantPhases\": [");
            for (int i = 0; i < relevantPhases.size(); i++) {
                if (i > 0)
                    writer.write(", ");
                writer.write("\"" + escapeJsonString(relevantPhases.get(i)) + "\"");
            }
            writer.write("],\n");

            // Add plugin goals
            writer.write("    \"pluginGoals\": [\n");
            for (int i = 0; i < pluginGoals.size(); i++) {
                if (i > 0)
                    writer.write(",\n");
                writer.write("      " + mapToJson(pluginGoals.get(i)));
            }
            writer.write("\n    ],\n");

            // Add phase dependencies (use updated ones)
            Map<String, Object> phaseDepsAsObjects = new LinkedHashMap<>();
            for (Map.Entry<String, List<String>> entry : updatedPhaseDependencies.entrySet()) {
                phaseDepsAsObjects.put(entry.getKey(), entry.getValue());
            }
            writer.write("    \"phaseDependencies\": " + mapToJson(phaseDepsAsObjects) + ",\n");

            // Add cross-project target dependencies
            Map<String, Object> crossProjectDepsAsObjects = new LinkedHashMap<>();
            for (Map.Entry<String, List<String>> entry : crossProjectDependencies.entrySet()) {
                crossProjectDepsAsObjects.put(entry.getKey(), entry.getValue());
            }
            writer.write("    \"crossProjectDependencies\": " + mapToJson(crossProjectDepsAsObjects) + ",\n");

            // Add goals organized by phase
            Map<String, Object> goalsByPhaseAsObjects = new LinkedHashMap<>();
            for (Map.Entry<String, List<String>> entry : goalsByPhase.entrySet()) {
                goalsByPhaseAsObjects.put(entry.getKey(), entry.getValue());
            }
            writer.write("    \"goalsByPhase\": " + mapToJson(goalsByPhaseAsObjects) + ",\n");

            // Add goal-to-goal dependencies
            Map<String, Object> goalDepsAsObjects = new LinkedHashMap<>();
            for (Map.Entry<String, List<String>> entry : goalDependencies.entrySet()) {
                goalDepsAsObjects.put(entry.getKey(), entry.getValue());
            }
            writer.write("    \"goalDependencies\": " + mapToJson(goalDepsAsObjects) + "\n");
            writer.write("  }");

            // Only log every 25 projects to reduce output
            if (processed % 25 == 0 || processed == 1) {
                System.err.println("DEBUG: Processed " + projectName + " with " + internalDeps.size()
                        + " filtered dependencies (" + processed + " total)");
            }

        } finally {
            // Explicitly clear references
            model = null;
        }
    }

    private static Model readPomFile(String pomPath) throws Exception {
        // Try effective POM first, fall back to raw POM if that fails
        try {
            return readEffectivePomFile(pomPath);
        } catch (Exception e) {
            System.err.println("WARNING: Failed to read effective POM, falling back to raw POM: " + e.getMessage());
            MavenXpp3Reader reader = new MavenXpp3Reader();
            return reader.read(new FileReader(pomPath));
        }
    }

    /**
     * Read effective POM using Maven ModelBuilder API with full inheritance and interpolation
     */
    private static Model readEffectivePomFile(String pomPath) throws Exception {
        // Create ModelBuilder
        ModelBuilder modelBuilder = new DefaultModelBuilderFactory().newInstance();

        // Create model building request with minimal validation for now
        DefaultModelBuildingRequest request = new DefaultModelBuildingRequest();
        request.setPomFile(new File(pomPath));
        request.setValidationLevel(ModelBuildingRequest.VALIDATION_LEVEL_MINIMAL);
        request.setProcessPlugins(true);
        request.setTwoPhaseBuilding(false);

        // For now, try without ModelResolver to see basic functionality
        // This will work for POMs without parent references or imports
        try {
            ModelBuildingResult result = modelBuilder.build(request);
            return result.getEffectiveModel();
        } catch (Exception e) {
            // If that fails, try with a basic model resolver
            RepositorySystem repositorySystem = createRepositorySystem();
            RepositorySystemSession repositorySession = createRepositorySession(repositorySystem);
            ModelResolver modelResolver = createModelResolver(repositorySystem, repositorySession);

            request.setModelResolver(modelResolver);
            ModelBuildingResult result = modelBuilder.build(request);
            return result.getEffectiveModel();
        }
    }

    /**
     * Create repository system for resolving Maven artifacts
     */
    private static RepositorySystem createRepositorySystem() {
        DefaultServiceLocator locator = MavenRepositorySystemUtils.newServiceLocator();
        locator.addService(RepositoryConnectorFactory.class, BasicRepositoryConnectorFactory.class);
        locator.addService(TransporterFactory.class, FileTransporterFactory.class);
        locator.addService(TransporterFactory.class, HttpTransporterFactory.class);

        return locator.getService(RepositorySystem.class);
    }

    /**
     * Create repository session with local repository
     */
    private static RepositorySystemSession createRepositorySession(RepositorySystem repositorySystem) {
        DefaultRepositorySystemSession session = MavenRepositorySystemUtils.newSession();

        // Set local repository (use Maven's default location)
        String userHome = System.getProperty("user.home");
        LocalRepository localRepo = new LocalRepository(userHome + "/.m2/repository");
        session.setLocalRepositoryManager(repositorySystem.newLocalRepositoryManager(session, localRepo));

        return session;
    }

    /**
     * Create model resolver for resolving parent POMs and imports
     */
    private static ModelResolver createModelResolver(RepositorySystem repositorySystem,
            RepositorySystemSession repositorySession) {
        // Define remote repositories (Maven Central, etc.)
        List<RemoteRepository> repositories = new ArrayList<>();
        repositories.add(new RemoteRepository.Builder("central", "default", "https://repo1.maven.org/maven2/").build());

        // Try multiple constructor signatures for different Maven versions
        try {
            Class<?> resolverClass = Class.forName("org.apache.maven.repository.internal.DefaultModelResolver");

            // Try constructor with RepositorySystemSession, RequestTrace, String, ArtifactResolver,
            // RemoteRepositoryManager, List
            try {
                Class<?> requestTraceClass = Class.forName("org.eclipse.aether.RequestTrace");
                Class<?> artifactResolverClass = Class.forName("org.eclipse.aether.resolution.ArtifactResolver");
                Class<?> remoteRepoManagerClass = Class.forName("org.eclipse.aether.impl.RemoteRepositoryManager");

                java.lang.reflect.Constructor<?> constructor = resolverClass.getDeclaredConstructor(
                        RepositorySystemSession.class, requestTraceClass, String.class, artifactResolverClass,
                        remoteRepoManagerClass, List.class);
                constructor.setAccessible(true);

                // Get components from RepositorySystem
                Object artifactResolver = repositorySystem.getClass().getMethod("getService", Class.class)
                        .invoke(repositorySystem, artifactResolverClass);
                Object remoteRepoManager = repositorySystem.getClass().getMethod("getService", Class.class)
                        .invoke(repositorySystem, remoteRepoManagerClass);

                return (ModelResolver) constructor.newInstance(repositorySession, null, "project", artifactResolver,
                        remoteRepoManager, repositories);

            } catch (Exception e1) {
                // Try simpler constructor signature
                try {
                    java.lang.reflect.Constructor<?> constructor = resolverClass
                            .getDeclaredConstructor(RepositorySystemSession.class, List.class);
                    constructor.setAccessible(true);
                    return (ModelResolver) constructor.newInstance(repositorySession, repositories);
                } catch (Exception e2) {
                    throw new RuntimeException(
                            "No compatible DefaultModelResolver constructor found. Tried multiple signatures.", e2);
                }
            }

        } catch (ClassNotFoundException e) {
            throw new RuntimeException("DefaultModelResolver class not found: " + e.getMessage(), e);
        }
    }

    private static Map<String, Object> generateNxProjectConfigurationMap(Model model) {
        Map<String, Object> config = new LinkedHashMap<>();

        // Basic project info
        String artifactId = model.getArtifactId();
        String projectName = artifactId.replace("quarkus-", "").replace("-", "_");
        config.put("name", projectName);
        config.put("projectType", "library");

        // Dependencies analysis
        Map<String, Object> implicitDependencies = new LinkedHashMap<>();
        List<String> projects = new ArrayList<>();
        List<String> inheritsFrom = new ArrayList<>();

        // Analyze Maven dependencies
        if (model.getDependencies() != null) {
            System.err
                    .println("DEBUG: Analyzing " + model.getDependencies().size() + " dependencies for " + artifactId);

            for (Dependency dep : model.getDependencies()) {
                if (isInternalDependency(dep)) {
                    String depName = dep.getArtifactId().replace("quarkus-", "").replace("-", "_");
                    projects.add(depName);
                    System.err.println(
                            "DEBUG: Found internal dependency: " + dep.getGroupId() + ":" + dep.getArtifactId());
                }
            }
        }

        // Add parent dependency if exists
        if (model.getParent() != null
                && isInternalDependency(model.getParent().getGroupId(), model.getParent().getArtifactId())) {
            String parentName = model.getParent().getArtifactId().replace("quarkus-", "").replace("-", "_");
            inheritsFrom.add(parentName);
        }

        implicitDependencies.put("projects", projects);
        implicitDependencies.put("inheritsFrom", inheritsFrom);
        config.put("implicitDependencies", implicitDependencies);

        // Detect relevant phases for this project
        List<String> relevantPhases = detectRelevantPhases(model);
        config.put("relevantPhases", relevantPhases);

        // Detect plugin goals that can be useful targets
        List<Map<String, Object>> pluginGoals = detectPluginGoals(model);
        config.put("pluginGoals", pluginGoals);

        // Targets - generate based on detected phases and plugin goals
        Map<String, Object> targets = new LinkedHashMap<>();
        targets.put("build", createBuildTarget());
        targets.put("test", createTestTarget());
        config.put("targets", targets);

        return config;
    }

    private static boolean isInternalDependency(Dependency dep) {
        return isInternalDependency(dep.getGroupId(), dep.getArtifactId());
    }

    static boolean isInternalDependency(String groupId, String artifactId) {
        if (groupId == null || artifactId == null) {
            return false;
        }

        // More conservative check for Quarkus internal dependencies
        // Only include artifacts that are likely to be in the workspace
        if (!groupId.equals("io.quarkus")) {
            return false;
        }

        // Exclude known external dependencies that are not part of the workspace
        if (artifactId.equals("quarkus-fs-util") || artifactId.equals("quarkus-spring-context-api")
                || artifactId.equals("quarkus-spring-data-rest-api")
                || artifactId.contains("-api") && !artifactId.endsWith("-deployment")) {
            return false;
        }

        return artifactId.startsWith("quarkus-") || artifactId.equals("arc");
    }

    /**
     * Detect relevant Maven phases for a project based on packaging, plugins, and framework
     */
    static List<String> detectRelevantPhases(Model model) {
        List<String> phases = new ArrayList<>();
        String packaging = model.getPackaging();
        if (packaging == null) {
            packaging = "jar"; // Default packaging
        }

        // Add standard phases based on packaging type
        phases.addAll(getPackagingSpecificPhases(packaging));

        // Add phases from plugin executions
        phases.addAll(getPluginBoundPhases(model));

        // Add framework-specific phases
        phases.addAll(detectFrameworkPhases(model));

        // Remove duplicates and sort
        List<String> uniquePhases = new ArrayList<>();
        for (String phase : phases) {
            if (!uniquePhases.contains(phase)) {
                uniquePhases.add(phase);
            }
        }

        return uniquePhases;
    }

    /**
     * Get standard phases for different packaging types
     */
    private static List<String> getPackagingSpecificPhases(String packaging) {
        List<String> phases = new ArrayList<>();

        // Common phases for all packaging types
        phases.add("clean");
        phases.add("validate");

        switch (packaging.toLowerCase()) {
            case "pom":
                // Parent POMs typically only need basic phases
                phases.add("install");
                phases.add("deploy");
                break;
            case "jar":
            case "bundle": // OSGi bundles
                phases.add("compile");
                phases.add("test-compile");
                phases.add("test");
                phases.add("package");
                phases.add("verify");
                phases.add("install");
                phases.add("deploy");
                break;
            case "war":
                phases.add("compile");
                phases.add("process-resources");
                phases.add("process-classes");
                phases.add("test-compile");
                phases.add("test");
                phases.add("package");
                phases.add("verify");
                phases.add("install");
                phases.add("deploy");
                break;
            case "maven-plugin":
                phases.add("compile");
                phases.add("process-classes");
                phases.add("test-compile");
                phases.add("test");
                phases.add("package");
                phases.add("verify");
                phases.add("install");
                phases.add("deploy");
                break;
            default:
                // For unknown packaging, include common phases
                phases.add("compile");
                phases.add("test");
                phases.add("package");
                phases.add("install");
                break;
        }

        return phases;
    }

    /**
     * Detect phases that have explicit plugin bindings
     */
    private static List<String> getPluginBoundPhases(Model model) {
        List<String> phases = new ArrayList<>();

        if (model.getBuild() != null && model.getBuild().getPlugins() != null) {
            for (Plugin plugin : model.getBuild().getPlugins()) {
                if (plugin.getExecutions() != null) {
                    for (PluginExecution execution : plugin.getExecutions()) {
                        String phase = execution.getPhase();
                        if (phase != null && !phase.trim().isEmpty()) {
                            phases.add(phase.trim());
                        }
                    }
                }
            }
        }

        return phases;
    }

    /**
     * Detect framework-specific phases based on dependencies and plugins
     */
    private static List<String> detectFrameworkPhases(Model model) {
        List<String> phases = new ArrayList<>();

        // Check for Spring Boot
        if (hasSpringBootPlugin(model) || hasSpringBootDependency(model)) {
            phases.add("spring-boot:run");
            phases.add("spring-boot:build-image");
        }

        // Check for Quarkus
        if (hasQuarkusPlugin(model) || hasQuarkusDependency(model)) {
            phases.add("quarkus:dev");
            phases.add("quarkus:build");
            phases.add("generate-code");
        }

        // Check for common test frameworks
        if (hasSurefirePlugin(model) || hasFailsafePlugin(model)) {
            phases.add("integration-test");
        }

        return phases;
    }

    private static boolean hasSpringBootPlugin(Model model) {
        if (model.getBuild() != null && model.getBuild().getPlugins() != null) {
            for (Plugin plugin : model.getBuild().getPlugins()) {
                if ("org.springframework.boot".equals(plugin.getGroupId())
                        && "spring-boot-maven-plugin".equals(plugin.getArtifactId())) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean hasQuarkusPlugin(Model model) {
        if (model.getBuild() != null && model.getBuild().getPlugins() != null) {
            for (Plugin plugin : model.getBuild().getPlugins()) {
                if ("io.quarkus".equals(plugin.getGroupId()) && "quarkus-maven-plugin".equals(plugin.getArtifactId())) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean hasSurefirePlugin(Model model) {
        if (model.getBuild() != null && model.getBuild().getPlugins() != null) {
            for (Plugin plugin : model.getBuild().getPlugins()) {
                if ("org.apache.maven.plugins".equals(plugin.getGroupId())
                        && "maven-surefire-plugin".equals(plugin.getArtifactId())) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean hasFailsafePlugin(Model model) {
        if (model.getBuild() != null && model.getBuild().getPlugins() != null) {
            for (Plugin plugin : model.getBuild().getPlugins()) {
                if ("org.apache.maven.plugins".equals(plugin.getGroupId())
                        && "maven-failsafe-plugin".equals(plugin.getArtifactId())) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean hasSpringBootDependency(Model model) {
        if (model.getDependencies() != null) {
            for (Dependency dep : model.getDependencies()) {
                if ("org.springframework.boot".equals(dep.getGroupId())) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean hasQuarkusDependency(Model model) {
        if (model.getDependencies() != null) {
            for (Dependency dep : model.getDependencies()) {
                if ("io.quarkus".equals(dep.getGroupId())) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Detect phase dependencies using Maven's default lifecycle
     */
    static Map<String, List<String>> detectPhaseDependencies(List<String> relevantPhases) {
        Map<String, List<String>> dependencies = new LinkedHashMap<>();

        // Define Maven's standard lifecycle order and dependencies
        Map<String, List<String>> standardLifecycle = new LinkedHashMap<>();
        standardLifecycle.put("validate", new ArrayList<>());
        standardLifecycle.put("initialize", new ArrayList<String>() {
            {
                add("validate");
            }
        });
        standardLifecycle.put("generate-sources", new ArrayList<String>() {
            {
                add("initialize");
            }
        });
        standardLifecycle.put("process-sources", new ArrayList<String>() {
            {
                add("generate-sources");
            }
        });
        standardLifecycle.put("generate-resources", new ArrayList<String>() {
            {
                add("process-sources");
            }
        });
        standardLifecycle.put("process-resources", new ArrayList<String>() {
            {
                add("generate-resources");
            }
        });
        standardLifecycle.put("compile", new ArrayList<String>() {
            {
                add("process-resources");
            }
        });
        standardLifecycle.put("process-classes", new ArrayList<String>() {
            {
                add("compile");
            }
        });
        standardLifecycle.put("generate-test-sources", new ArrayList<String>() {
            {
                add("process-classes");
            }
        });
        standardLifecycle.put("process-test-sources", new ArrayList<String>() {
            {
                add("generate-test-sources");
            }
        });
        standardLifecycle.put("generate-test-resources", new ArrayList<String>() {
            {
                add("process-test-sources");
            }
        });
        standardLifecycle.put("process-test-resources", new ArrayList<String>() {
            {
                add("generate-test-resources");
            }
        });
        standardLifecycle.put("test-compile", new ArrayList<String>() {
            {
                add("process-test-resources");
            }
        });
        standardLifecycle.put("process-test-classes", new ArrayList<String>() {
            {
                add("test-compile");
            }
        });
        standardLifecycle.put("test", new ArrayList<String>() {
            {
                add("process-test-classes");
            }
        });
        standardLifecycle.put("prepare-package", new ArrayList<String>() {
            {
                add("test");
            }
        });
        standardLifecycle.put("package", new ArrayList<String>() {
            {
                add("prepare-package");
            }
        });
        standardLifecycle.put("pre-integration-test", new ArrayList<String>() {
            {
                add("package");
            }
        });
        standardLifecycle.put("integration-test", new ArrayList<String>() {
            {
                add("pre-integration-test");
            }
        });
        standardLifecycle.put("post-integration-test", new ArrayList<String>() {
            {
                add("integration-test");
            }
        });
        standardLifecycle.put("verify", new ArrayList<String>() {
            {
                add("post-integration-test");
            }
        });
        standardLifecycle.put("install", new ArrayList<String>() {
            {
                add("verify");
            }
        });
        standardLifecycle.put("deploy", new ArrayList<String>() {
            {
                add("install");
            }
        });

        // Clean lifecycle
        standardLifecycle.put("pre-clean", new ArrayList<>());
        standardLifecycle.put("clean", new ArrayList<String>() {
            {
                add("pre-clean");
            }
        });
        standardLifecycle.put("post-clean", new ArrayList<String>() {
            {
                add("clean");
            }
        });

        // Site lifecycle
        standardLifecycle.put("pre-site", new ArrayList<>());
        standardLifecycle.put("site", new ArrayList<String>() {
            {
                add("pre-site");
            }
        });
        standardLifecycle.put("post-site", new ArrayList<String>() {
            {
                add("site");
            }
        });
        standardLifecycle.put("site-deploy", new ArrayList<String>() {
            {
                add("post-site");
            }
        });

        // Add framework-specific phase dependencies
        standardLifecycle.put("generate-code", new ArrayList<String>() {
            {
                add("validate");
            }
        });
        standardLifecycle.put("quarkus:dev", new ArrayList<String>() {
            {
                add("compile");
            }
        });
        standardLifecycle.put("quarkus:build", new ArrayList<String>() {
            {
                add("test");
            }
        });
        standardLifecycle.put("spring-boot:run", new ArrayList<String>() {
            {
                add("compile");
            }
        });
        standardLifecycle.put("spring-boot:build-image", new ArrayList<String>() {
            {
                add("package");
            }
        });

        // Include ALL standard Maven phases in dependencies, not just relevant ones
        // This allows recursive goal dependency traversal to work through the full lifecycle
        for (Map.Entry<String, List<String>> entry : standardLifecycle.entrySet()) {
            dependencies.put(entry.getKey(), new ArrayList<>(entry.getValue()));
        }

        // Then add any relevant phases that might not be in the standard lifecycle
        for (String phase : relevantPhases) {
            if (!dependencies.containsKey(phase)) {
                dependencies.put(phase, new ArrayList<>());
            }
        }

        return dependencies;
    }

    /**
     * Detect cross-project target dependencies based on Maven dependencies
     */
    static Map<String, List<String>> detectCrossProjectTargetDependencies(List<String> internalDeps,
            List<String> relevantPhases, List<Map<String, Object>> pluginGoals) {

        Map<String, List<String>> crossProjectDeps = new LinkedHashMap<>();

        if (internalDeps.isEmpty()) {
            return crossProjectDeps;
        }

        // For each target (phase or goal), determine what dependency project targets it should wait for

        // Phase target dependencies
        for (String phase : relevantPhases) {
            List<String> targetDeps = new ArrayList<>();

            switch (phase) {
                case "compile":
                case "test-compile":
                    // Compilation phases should wait for dependency projects to be compiled
                    // Use fallback to 'validate' if 'compile' doesn't exist
                    for (String dep : internalDeps) {
                        targetDeps.add(dep + ":compile|validate");
                    }
                    break;
                case "test":
                    // Test phase should wait for dependency projects to be compiled
                    // Use fallback to 'validate' if 'compile' doesn't exist
                    for (String dep : internalDeps) {
                        targetDeps.add(dep + ":compile|validate");
                    }
                    break;
                case "package":
                case "verify":
                case "install":
                case "deploy":
                    // Packaging/deployment phases should wait for dependency projects to be packaged
                    // Use fallback chain: package -> compile -> validate
                    for (String dep : internalDeps) {
                        targetDeps.add(dep + ":package|compile|validate");
                    }
                    break;
                case "integration-test":
                    // Integration tests need dependency projects to be packaged
                    // Use fallback chain: package -> compile -> validate
                    for (String dep : internalDeps) {
                        targetDeps.add(dep + ":package|compile|validate");
                    }
                    break;
                // For other phases like clean, validate, process-resources, etc., usually no cross-project deps needed
            }

            if (!targetDeps.isEmpty()) {
                crossProjectDeps.put(phase, targetDeps);
            }
        }

        // Plugin goal dependencies
        for (Map<String, Object> goalInfo : pluginGoals) {
            String targetName = (String) goalInfo.get("targetName");
            String targetType = (String) goalInfo.get("targetType");

            if (targetName != null && targetType != null) {
                List<String> targetDeps = new ArrayList<>();

                switch (targetType) {
                    case "serve":
                        // Serve goals (like quarkus:dev) need dependency projects compiled
                        // Use fallback to 'validate' if 'compile' doesn't exist
                        for (String dep : internalDeps) {
                            targetDeps.add(dep + ":compile|validate");
                        }
                        break;
                    case "build":
                        // Build goals need dependency projects packaged
                        // Use fallback chain: package -> compile -> validate
                        for (String dep : internalDeps) {
                            targetDeps.add(dep + ":package|compile|validate");
                        }
                        break;
                    case "test":
                        // Test goals need dependency projects compiled
                        // Use fallback to 'validate' if 'compile' doesn't exist
                        for (String dep : internalDeps) {
                            targetDeps.add(dep + ":compile|validate");
                        }
                        break;
                    case "deploy":
                        // Deploy goals need dependency projects packaged
                        // Use fallback chain: package -> compile -> validate
                        for (String dep : internalDeps) {
                            targetDeps.add(dep + ":package|compile|validate");
                        }
                        break;
                }

                if (!targetDeps.isEmpty()) {
                    crossProjectDeps.put(targetName, targetDeps);
                }
            }
        }

        return crossProjectDeps;
    }

    /**
     * Detect plugin goals that would be useful as NX targets
     */
    static List<Map<String, Object>> detectPluginGoals(Model model) {
        List<Map<String, Object>> pluginGoals = new ArrayList<>();

        if (model.getBuild() != null && model.getBuild().getPlugins() != null) {
            for (Plugin plugin : model.getBuild().getPlugins()) {
                String pluginKey = plugin.getGroupId() + ":" + plugin.getArtifactId();

                // Process plugin executions
                if (plugin.getExecutions() != null) {
                    for (PluginExecution execution : plugin.getExecutions()) {
                        List<String> goals = execution.getGoals();
                        if (goals != null && !goals.isEmpty()) {
                            for (String goal : goals) {
                                Map<String, Object> goalInfo = createPluginGoalInfo(plugin, execution, goal,
                                        execution.getPhase());
                                if (goalInfo != null) {
                                    pluginGoals.add(goalInfo);
                                }
                            }
                        }
                    }
                }

                // Also check for common framework-specific goals even if not in executions
                pluginGoals.addAll(detectFrameworkSpecificGoals(plugin));
            }
        }

        // Also detect framework goals based on dependencies (for inherited plugins)
        pluginGoals.addAll(detectFrameworkGoalsByDependencies(model));

        return pluginGoals;
    }

    /**
     * Create goal information for useful plugin goals
     */
    private static Map<String, Object> createPluginGoalInfo(Plugin plugin, PluginExecution execution, String goal,
            String phase) {
        String pluginKey = plugin.getGroupId() + ":" + plugin.getArtifactId();

        // Filter for goals that would be useful as NX targets
        if (!isUsefulPluginGoal(pluginKey, goal)) {
            return null;
        }

        Map<String, Object> goalInfo = new LinkedHashMap<>();
        goalInfo.put("pluginKey", pluginKey);
        goalInfo.put("goal", goal);
        goalInfo.put("phase", phase);
        goalInfo.put("executionId", execution.getId());

        // Create a target name
        String targetName = createTargetNameFromGoal(pluginKey, goal);
        goalInfo.put("targetName", targetName);

        // Determine target type
        String targetType = determineTargetType(pluginKey, goal);
        goalInfo.put("targetType", targetType);

        // Add suggested phase dependencies based on goal type and plugin
        List<String> suggestedDependencies = getSuggestedPhaseDependencies(pluginKey, goal, targetType, phase);
        goalInfo.put("suggestedDependencies", suggestedDependencies);

        return goalInfo;
    }

    /**
     * Detect framework-specific goals that should be available as targets
     */
    private static List<Map<String, Object>> detectFrameworkSpecificGoals(Plugin plugin) {
        List<Map<String, Object>> goals = new ArrayList<>();
        String pluginKey = plugin.getGroupId() + ":" + plugin.getArtifactId();

        System.err.println("DEBUG: Checking framework goals for plugin: " + pluginKey);

        // Spring Boot goals
        if ("org.springframework.boot:spring-boot-maven-plugin".equals(pluginKey)) {
            System.err.println("DEBUG: Found Spring Boot plugin, adding goals");
            goals.add(createFrameworkGoal(pluginKey, "run", "serve"));
            goals.add(createFrameworkGoal(pluginKey, "build-image", "build"));
            goals.add(createFrameworkGoal(pluginKey, "repackage", "build"));
        }

        // Quarkus goals - be more flexible with detection
        if (pluginKey.contains("quarkus-maven-plugin") || "io.quarkus:quarkus-maven-plugin".equals(pluginKey)) {
            System.err.println("DEBUG: Found Quarkus plugin, adding goals");
            goals.add(createFrameworkGoal(pluginKey, "dev", "serve"));
            goals.add(createFrameworkGoal(pluginKey, "build", "build"));
            goals.add(createFrameworkGoal(pluginKey, "generate-code", "build"));
            goals.add(createFrameworkGoal(pluginKey, "test", "test"));
        }

        // Also detect Quarkus by checking if it's a Quarkus project via dependencies
        // This handles cases where the plugin might be inherited from parent

        // Docker/Container goals
        if ("com.spotify:dockerfile-maven-plugin".equals(pluginKey)
                || "io.fabric8:docker-maven-plugin".equals(pluginKey) || pluginKey.contains("docker-maven-plugin")) {
            System.err.println("DEBUG: Found Docker plugin, adding goals");
            goals.add(createFrameworkGoal(pluginKey, "build", "build"));
            goals.add(createFrameworkGoal(pluginKey, "push", "deploy"));
        }

        // Code generation plugins
        if (pluginKey.contains("protobuf") || pluginKey.contains("avro")
                || "org.openapitools:openapi-generator-maven-plugin".equals(pluginKey)
                || pluginKey.contains("generator")) {
            System.err.println("DEBUG: Found code generation plugin, adding goals");
            goals.add(createFrameworkGoal(pluginKey, "generate", "build"));
        }

        // Maven Compiler Plugin - for compilation goals
        if ("org.apache.maven.plugins:maven-compiler-plugin".equals(pluginKey)) {
            goals.add(createFrameworkGoal(pluginKey, "compile", "build"));
            goals.add(createFrameworkGoal(pluginKey, "testCompile", "build"));
        }

        // Surefire Plugin - for test goals
        if ("org.apache.maven.plugins:maven-surefire-plugin".equals(pluginKey)) {
            goals.add(createFrameworkGoal(pluginKey, "test", "test"));
        }

        // Failsafe Plugin - for integration test goals
        if ("org.apache.maven.plugins:maven-failsafe-plugin".equals(pluginKey)) {
            goals.add(createFrameworkGoal(pluginKey, "integration-test", "test"));
            goals.add(createFrameworkGoal(pluginKey, "verify", "test"));
        }

        System.err.println("DEBUG: Added " + goals.size() + " framework goals for " + pluginKey);
        return goals;
    }

    /**
     * Detect framework goals based on project dependencies (for cases where plugins are inherited)
     */
    private static List<Map<String, Object>> detectFrameworkGoalsByDependencies(Model model) {
        List<Map<String, Object>> goals = new ArrayList<>();

        // Check if this is a Quarkus project by looking at dependencies
        boolean isQuarkusProject = false;
        if (model.getDependencies() != null) {
            for (Dependency dep : model.getDependencies()) {
                if (dep.getGroupId() != null && dep.getGroupId().startsWith("io.quarkus")) {
                    isQuarkusProject = true;
                    break;
                }
            }
        }

        if (isQuarkusProject) {
            System.err.println("DEBUG: Detected Quarkus project via dependencies, adding Quarkus goals");
            // Use a generic quarkus plugin key since the actual plugin might be inherited
            String quarkusPluginKey = "io.quarkus:quarkus-maven-plugin";
            goals.add(createFrameworkGoal(quarkusPluginKey, "dev", "serve"));
            goals.add(createFrameworkGoal(quarkusPluginKey, "build", "build"));
            goals.add(createFrameworkGoal(quarkusPluginKey, "generate-code", "build"));
            goals.add(createFrameworkGoal(quarkusPluginKey, "test", "test"));
        }

        // Check for Spring Boot projects
        boolean isSpringBootProject = false;
        if (model.getDependencies() != null) {
            for (Dependency dep : model.getDependencies()) {
                if (dep.getGroupId() != null && dep.getGroupId().startsWith("org.springframework.boot")) {
                    isSpringBootProject = true;
                    break;
                }
            }
        }

        if (isSpringBootProject) {
            System.err.println("DEBUG: Detected Spring Boot project via dependencies, adding Spring Boot goals");
            String springBootPluginKey = "org.springframework.boot:spring-boot-maven-plugin";
            goals.add(createFrameworkGoal(springBootPluginKey, "run", "serve"));
            goals.add(createFrameworkGoal(springBootPluginKey, "build-image", "build"));
            goals.add(createFrameworkGoal(springBootPluginKey, "repackage", "build"));
        }

        System.err.println("DEBUG: Added " + goals.size() + " dependency-based framework goals");
        return goals;
    }

    /**
     * Get suggested phase dependencies for a plugin goal
     */
    private static List<String> getSuggestedPhaseDependencies(String pluginKey, String goal, String targetType,
            String phase) {
        List<String> dependencies = new ArrayList<>();

        // Framework-specific dependencies
        if (pluginKey.contains("quarkus")) {
            switch (goal) {
                case "dev":
                    dependencies.add("compile");
                    break;
                case "build":
                    dependencies.add("test");
                    break;
                case "generate-code":
                    dependencies.add("validate");
                    break;
                case "test":
                    dependencies.add("test-compile");
                    break;
            }
        } else if (pluginKey.contains("spring-boot")) {
            switch (goal) {
                case "run":
                    dependencies.add("compile");
                    break;
                case "build-image":
                    dependencies.add("package");
                    break;
                case "repackage":
                    dependencies.add("test");
                    break;
            }
        } else {
            // Generic dependencies based on target type
            switch (targetType) {
                case "serve":
                    dependencies.add("compile");
                    break;
                case "build":
                    dependencies.add("test");
                    break;
                case "test":
                    dependencies.add("test-compile");
                    break;
                case "deploy":
                    dependencies.add("package");
                    break;
                case "utility":
                    dependencies.add("compile");
                    break;
            }
        }

        // If the goal is explicitly bound to a phase, use that phase's prerequisites instead
        if (phase != null && !phase.trim().isEmpty() && !"null".equals(phase)) {
            // Use standard Maven lifecycle dependencies for bound goals
            switch (phase) {
                case "compile":
                    dependencies.clear();
                    dependencies.add("process-resources");
                    break;
                case "test":
                    dependencies.clear();
                    dependencies.add("process-test-classes");
                    break;
                case "package":
                    dependencies.clear();
                    dependencies.add("test");
                    break;
                case "verify":
                    dependencies.clear();
                    dependencies.add("package");
                    break;
                case "install":
                    dependencies.clear();
                    dependencies.add("verify");
                    break;
                case "deploy":
                    dependencies.clear();
                    dependencies.add("install");
                    break;
            }
        }

        return dependencies;
    }

    /**
     * Create framework-specific goal info
     */
    private static Map<String, Object> createFrameworkGoal(String pluginKey, String goal, String targetType) {
        Map<String, Object> goalInfo = new LinkedHashMap<>();
        goalInfo.put("pluginKey", pluginKey);
        goalInfo.put("goal", goal);
        goalInfo.put("phase", null); // Framework goals often aren't bound to phases
        goalInfo.put("executionId", "default");
        goalInfo.put("targetName", createTargetNameFromGoal(pluginKey, goal));
        goalInfo.put("targetType", targetType);

        // Add suggested dependencies
        List<String> suggestedDependencies = getSuggestedPhaseDependencies(pluginKey, goal, targetType, null);
        goalInfo.put("suggestedDependencies", suggestedDependencies);

        return goalInfo;
    }

    /**
     * Check if a plugin goal would be useful as an NX target
     */
    private static boolean isUsefulPluginGoal(String pluginKey, String goal) {
        // Skip internal Maven goals that aren't useful for users
        if (goal.equals("compile") || goal.equals("testCompile") || goal.equals("process-classes")
                || goal.equals("process-test-classes")) {
            return false;
        }

        // Include development/serving goals
        if (goal.equals("run") || goal.equals("dev") || goal.equals("serve")) {
            return true;
        }

        // Include build/packaging goals
        if (goal.equals("build") || goal.equals("package") || goal.equals("repackage") || goal.equals("build-image")
                || goal.equals("docker-build")) {
            return true;
        }

        // Include code generation goals
        if (goal.equals("generate") || goal.equals("generate-sources") || goal.equals("generate-code")
                || goal.contains("generate")) {
            return true;
        }

        // Include test goals
        if (goal.equals("test") || goal.equals("integration-test") || goal.contains("test")) {
            return true;
        }

        // Include deployment goals
        if (goal.equals("deploy") || goal.equals("push") || goal.contains("deploy")) {
            return true;
        }

        return false;
    }

    /**
     * Create a target name from plugin and goal
     */
    private static String createTargetNameFromGoal(String pluginKey, String goal) {
        // Extract short plugin name
        String pluginName = "";
        if (pluginKey.contains("spring-boot")) {
            pluginName = "spring-boot";
        } else if (pluginKey.contains("quarkus")) {
            pluginName = "quarkus";
        } else if (pluginKey.contains("docker")) {
            pluginName = "docker";
        } else {
            // Extract from artifactId
            String[] parts = pluginKey.split(":");
            if (parts.length > 1) {
                pluginName = parts[1].replace("-maven-plugin", "").replace("-plugin", "");
            }
        }

        // Create target name
        if (pluginName.isEmpty()) {
            return goal;
        } else if (goal.equals("run") || goal.equals("dev")) {
            return "serve"; // Map to common NX convention
        } else if (goal.equals("build") || goal.equals("package") || goal.equals("repackage")) {
            return "build"; // Map to common NX convention
        } else {
            return pluginName + ":" + goal;
        }
    }

    /**
     * Determine target type for categorization
     */
    private static String determineTargetType(String pluginKey, String goal) {
        if (goal.equals("run") || goal.equals("dev") || goal.equals("serve")) {
            return "serve";
        } else if (goal.equals("test") || goal.contains("test")) {
            return "test";
        } else if (goal.equals("build") || goal.equals("package") || goal.equals("compile") || goal.contains("generate")
                || goal.equals("repackage")) {
            return "build";
        } else if (goal.equals("deploy") || goal.equals("push")) {
            return "deploy";
        } else {
            return "utility";
        }
    }

    private static Map<String, Object> createBuildTarget() {
        Map<String, Object> target = new LinkedHashMap<>();
        target.put("executor", "@nx/maven:build");

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("command", "compile");
        target.put("options", options);

        return target;
    }

    private static Map<String, Object> createTestTarget() {
        Map<String, Object> target = new LinkedHashMap<>();
        target.put("executor", "@nx/maven:test");

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("command", "test");
        target.put("options", options);

        return target;
    }

    private static String mapToJson(Map<String, Object> map) {
        StringBuilder json = new StringBuilder();
        json.append("{");

        boolean first = true;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (!first)
                json.append(",");
            json.append("\"").append(escapeJsonString(entry.getKey())).append("\":");
            json.append(objectToJson(entry.getValue()));
            first = false;
        }

        json.append("}");
        return json.toString();
    }

    private static String objectToJson(Object obj) {
        if (obj == null) {
            return "null";
        } else if (obj instanceof String) {
            return "\"" + escapeJsonString((String) obj) + "\"";
        } else if (obj instanceof Number || obj instanceof Boolean) {
            return obj.toString();
        } else if (obj instanceof List) {
            List<?> list = (List<?>) obj;
            StringBuilder json = new StringBuilder("[");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0)
                    json.append(",");
                json.append(objectToJson(list.get(i)));
            }
            json.append("]");
            return json.toString();
        } else if (obj instanceof Map) {
            return mapToJson((Map<String, Object>) obj);
        } else {
            return "\"" + escapeJsonString(obj.toString()) + "\"";
        }
    }

    private static String escapeJsonString(String str) {
        if (str == null)
            return "";
        return str.replace("\\", "\\\\").replace("\"", "\\\"").replace("\b", "\\b").replace("\f", "\\f")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    /**
     * Organize plugin goals by their associated Maven phases This determines which phase each goal logically belongs to
     */
    static Map<String, List<String>> organizeGoalsByPhase(List<Map<String, Object>> pluginGoals,
            List<String> relevantPhases) {
        Map<String, List<String>> goalsByPhase = new LinkedHashMap<>();

        // Initialize all phases with empty lists
        for (String phase : relevantPhases) {
            goalsByPhase.put(phase, new ArrayList<>());
        }

        // Assign each goal to a phase
        for (Map<String, Object> goalInfo : pluginGoals) {
            String targetName = (String) goalInfo.get("targetName");
            String goalPhase = (String) goalInfo.get("phase");
            String goal = (String) goalInfo.get("goal");
            String targetType = (String) goalInfo.get("targetType");
            String pluginKey = (String) goalInfo.get("pluginKey");

            if (targetName == null)
                continue;

            String assignedPhase = null;

            // Try explicit phase binding first
            if (goalPhase != null && !goalPhase.equals("null") && relevantPhases.contains(goalPhase)) {
                assignedPhase = goalPhase;
            } else {
                // Assign based on target type and goal patterns
                if ("build".equals(targetType)) {
                    if (goal.contains("testCompile") || goal.equals("testCompile")) {
                        assignedPhase = "test-compile";
                    } else if (goal.contains("compile") && !goal.contains("test")) {
                        assignedPhase = "compile";
                    } else if (goal.equals("compile")) {
                        assignedPhase = "compile";
                    } else if (pluginKey.contains("compiler")) {
                        assignedPhase = goal.contains("test") ? "test-compile" : "compile";
                    } else {
                        assignedPhase = "package"; // Default for build goals
                    }
                } else if ("test".equals(targetType)) {
                    assignedPhase = "test";
                } else if ("serve".equals(targetType)) {
                    assignedPhase = "compile"; // Dev servers need compiled code
                } else if ("deploy".equals(targetType)) {
                    assignedPhase = "deploy";
                } else if ("utility".equals(targetType)) {
                    assignedPhase = "validate";
                } else {
                    // Infer from goal name
                    if (goal.contains("compile")) {
                        assignedPhase = goal.contains("test") ? "test-compile" : "compile";
                    } else if (goal.contains("test")) {
                        assignedPhase = "test";
                    } else {
                        assignedPhase = "package"; // Default fallback
                    }
                }
            }

            // Ensure assigned phase exists in relevant phases
            if (assignedPhase != null && relevantPhases.contains(assignedPhase)) {
                goalsByPhase.get(assignedPhase).add(targetName);
            } else if (assignedPhase != null && !relevantPhases.isEmpty()) {
                // Better fallback logic: find a suitable alternative phase
                String fallbackPhase = findBestFallbackPhase(assignedPhase, relevantPhases);
                if (fallbackPhase != null) {
                    goalsByPhase.get(fallbackPhase).add(targetName);
                }
                // If no suitable fallback, skip this goal rather than misplace it
            }
        }

        return goalsByPhase;
    }

    /**
     * Add missing phases that goals actually need (like test-compile for testCompile goals)
     */
    private static void addMissingPhasesForGoals(List<Map<String, Object>> pluginGoals, List<String> relevantPhases,
            Map<String, List<String>> goalsByPhase) {
        Set<String> neededPhases = new LinkedHashSet<>();

        // Identify phases that goals actually need
        for (Map<String, Object> goalInfo : pluginGoals) {
            String goal = (String) goalInfo.get("goal");
            String targetType = (String) goalInfo.get("targetType");
            String targetName = (String) goalInfo.get("targetName");

            if (targetName == null)
                continue;

            // Determine ideal phase for this goal
            String idealPhase = null;
            if ("build".equals(targetType)) {
                if (goal.contains("testCompile") || goal.equals("testCompile")) {
                    idealPhase = "test-compile";
                } else if (goal.contains("compile") && !goal.contains("test")) {
                    idealPhase = "compile";
                }
            } else if ("test".equals(targetType)) {
                idealPhase = "test";
            }

            // If the ideal phase is missing, add it
            if (idealPhase != null && !relevantPhases.contains(idealPhase)) {
                neededPhases.add(idealPhase);
            }
        }

        // Add missing phases and reorganize goals
        for (String phase : neededPhases) {
            relevantPhases.add(phase);
            goalsByPhase.put(phase, new ArrayList<>());
            System.err.println("DEBUG: Added missing phase: " + phase);
        }

        // Re-organize goals now that we have the right phases
        if (!neededPhases.isEmpty()) {
            // Clear existing assignments for re-assignment
            for (List<String> goals : goalsByPhase.values()) {
                goals.clear();
            }

            // Re-assign goals with proper phases available
            for (Map<String, Object> goalInfo : pluginGoals) {
                String targetName = (String) goalInfo.get("targetName");
                String goal = (String) goalInfo.get("goal");
                String targetType = (String) goalInfo.get("targetType");

                if (targetName == null)
                    continue;

                String assignedPhase = null;
                if ("build".equals(targetType)) {
                    if (goal.contains("testCompile") || goal.equals("testCompile")) {
                        assignedPhase = "test-compile";
                    } else if (goal.contains("compile") && !goal.contains("test")) {
                        assignedPhase = "compile";
                    } else {
                        assignedPhase = "package";
                    }
                } else if ("test".equals(targetType)) {
                    assignedPhase = "test";
                } else if ("serve".equals(targetType)) {
                    assignedPhase = "compile";
                } else {
                    assignedPhase = "validate";
                }

                // Assign to phase if it exists
                if (assignedPhase != null && relevantPhases.contains(assignedPhase)) {
                    goalsByPhase.get(assignedPhase).add(targetName);
                } else {
                    // Fallback logic
                    String fallbackPhase = findBestFallbackPhase(assignedPhase, relevantPhases);
                    if (fallbackPhase != null) {
                        goalsByPhase.get(fallbackPhase).add(targetName);
                    }
                }
            }
        }
    }

    /**
     * Find the best fallback phase when the ideal phase doesn't exist
     */
    private static String findBestFallbackPhase(String idealPhase, List<String> availablePhases) {
        // Define fallback mappings for common cases
        Map<String, String[]> fallbackMap = new LinkedHashMap<>();
        fallbackMap.put("test-compile", new String[] { "compile", "validate" });
        fallbackMap.put("test", new String[] { "compile", "validate" });
        fallbackMap.put("package", new String[] { "compile", "validate" });
        fallbackMap.put("verify", new String[] { "package", "compile", "validate" });
        fallbackMap.put("install", new String[] { "package", "compile", "validate" });
        fallbackMap.put("deploy", new String[] { "install", "package", "compile", "validate" });
        fallbackMap.put("integration-test", new String[] { "package", "compile", "validate" });

        // Try fallback options in order
        String[] fallbacks = fallbackMap.get(idealPhase);
        if (fallbacks != null) {
            for (String fallback : fallbacks) {
                if (availablePhases.contains(fallback)) {
                    return fallback;
                }
            }
        }

        // If no specific fallback found, use general fallbacks based on phase type
        if (idealPhase.contains("test")) {
            // Test-related phases fall back to compile if available
            if (availablePhases.contains("compile")) {
                return "compile";
            }
        } else if (idealPhase.contains("compile")) {
            // Compile phases fall back to validate
            if (availablePhases.contains("validate")) {
                return "validate";
            }
        }

        // Last resort: use validate if available, otherwise null (skip goal)
        return availablePhases.contains("validate") ? "validate" : null;
    }

    /**
     * Generate goal-to-goal dependencies where goals depend on goals from prerequisite phases
     */
    static Map<String, List<String>> generateGoalDependencies(List<Map<String, Object>> pluginGoals,
            Map<String, List<String>> goalsByPhase, Map<String, List<String>> phaseDependencies,
            List<String> relevantPhases) {

        Map<String, List<String>> goalDependencies = new LinkedHashMap<>();

        // For each goal, find which phase it belongs to and make it depend on goals from prerequisite phases
        for (Map<String, Object> goalInfo : pluginGoals) {
            String targetName = (String) goalInfo.get("targetName");
            if (targetName == null)
                continue;

            // Find which phase this goal belongs to
            String goalPhase = null;
            for (Map.Entry<String, List<String>> entry : goalsByPhase.entrySet()) {
                if (entry.getValue().contains(targetName)) {
                    goalPhase = entry.getKey();
                    break;
                }
            }

            if (goalPhase != null) {
                List<String> prerequisiteGoals = new ArrayList<>();

                // Traverse the full phase dependency chain to find phases with actual goals
                Set<String> visitedPhases = new LinkedHashSet<>();
                findPrerequisiteGoalsRecursively(goalPhase, phaseDependencies, goalsByPhase, relevantPhases,
                        prerequisiteGoals, visitedPhases);

                // Remove duplicates and add to dependencies
                if (!prerequisiteGoals.isEmpty()) {
                    Set<String> uniqueGoals = new LinkedHashSet<>(prerequisiteGoals);
                    goalDependencies.put(targetName, new ArrayList<>(uniqueGoals));
                }
            }
        }
        return goalDependencies;
    }

    /**
     * Recursively find prerequisite goals by traversing the phase dependency chain
     */
    private static void findPrerequisiteGoalsRecursively(String phase, Map<String, List<String>> phaseDependencies,
            Map<String, List<String>> goalsByPhase, List<String> relevantPhases, List<String> prerequisiteGoals,
            Set<String> visitedPhases) {

        // Avoid infinite loops
        if (visitedPhases.contains(phase)) {
            return;
        }
        visitedPhases.add(phase);

        // Get immediate prerequisite phases
        List<String> immediatePrereqs = phaseDependencies.get(phase);

        if (immediatePrereqs != null) {
            for (String prereqPhase : immediatePrereqs) {
                // Check if this prerequisite phase has goals (regardless of whether it's in relevantPhases)
                List<String> goalsInPhase = goalsByPhase.get(prereqPhase);

                if (goalsInPhase != null && !goalsInPhase.isEmpty()) {
                    // Found goals in this phase - add them
                    prerequisiteGoals.addAll(goalsInPhase);
                } else {
                    // No goals in this phase - continue traversing (even if not in relevantPhases)
                    findPrerequisiteGoalsRecursively(prereqPhase, phaseDependencies, goalsByPhase, relevantPhases,
                            prerequisiteGoals, visitedPhases);
                }
            }
        }
    }
}
