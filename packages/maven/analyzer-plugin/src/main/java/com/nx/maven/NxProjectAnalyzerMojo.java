package com.nx.maven;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.model.Dependency;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugins.annotations.*;
import org.apache.maven.project.MavenProject;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Set;
import java.util.HashSet;

/**
 * Maven plugin to analyze project structure and generate JSON for Nx integration
 */
@Mojo(name = "analyze", 
      defaultPhase = LifecyclePhase.VALIDATE,
      aggregator = true,
      requiresDependencyResolution = ResolutionScope.NONE)
public class NxProjectAnalyzerMojo extends AbstractMojo {

    @Parameter(defaultValue = "${session}", readonly = true, required = true)
    private MavenSession session;

    @Parameter(defaultValue = "${project}", readonly = true, required = true)
    private MavenProject project;

    @Parameter(property = "nx.outputFile", defaultValue = "nx-maven-projects.json")
    private String outputFile;

    @Parameter(property = "nx.workspaceRoot", defaultValue = "${session.executionRootDirectory}")
    private String workspaceRoot;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void execute() throws MojoExecutionException {
        getLog().info("Analyzing Maven projects for Nx integration...");
        
        try {
            ObjectNode rootNode = objectMapper.createObjectNode();
            ArrayNode projectsArray = objectMapper.createArrayNode();
            
            // Get all projects in the reactor
            List<MavenProject> allProjects = session.getAllProjects();
            getLog().info("Found " + allProjects.size() + " Maven projects");
            
            for (MavenProject mavenProject : allProjects) {
                ObjectNode projectNode = analyzeProject(mavenProject);
                if (projectNode != null) {
                    projectsArray.add(projectNode);
                }
            }
            
            rootNode.set("projects", projectsArray);
            rootNode.put("generatedAt", System.currentTimeMillis());
            rootNode.put("workspaceRoot", workspaceRoot);
            rootNode.put("totalProjects", allProjects.size());
            
            // Write JSON file
            File outputPath = new File(workspaceRoot, outputFile);
            objectMapper.writerWithDefaultPrettyPrinter()
                       .writeValue(outputPath, rootNode);
            
            getLog().info("Generated Nx project analysis: " + outputPath.getAbsolutePath());
            getLog().info("Analyzed " + allProjects.size() + " Maven projects");
            
        } catch (IOException e) {
            throw new MojoExecutionException("Failed to generate Nx project analysis", e);
        }
    }

    private ObjectNode analyzeProject(MavenProject mavenProject) {
        try {
            ObjectNode projectNode = objectMapper.createObjectNode();
            
            // Basic project information
            projectNode.put("artifactId", mavenProject.getArtifactId());
            projectNode.put("groupId", mavenProject.getGroupId());
            projectNode.put("version", mavenProject.getVersion());
            projectNode.put("packaging", mavenProject.getPackaging());
            projectNode.put("name", mavenProject.getName());
            projectNode.put("description", 
                mavenProject.getDescription() != null ? mavenProject.getDescription() : "");
            
            // Calculate relative path from workspace root
            Path workspaceRootPath = Paths.get(workspaceRoot);
            Path projectPath = mavenProject.getBasedir().toPath();
            String relativePath = workspaceRootPath.relativize(projectPath).toString().replace("\\", "/");
            projectNode.put("root", relativePath);
            
            // Project type based on packaging
            String projectType = determineProjectType(mavenProject.getPackaging());
            projectNode.put("projectType", projectType);
            
            // Source root
            String sourceRoot = relativePath + "/src/main/java";
            projectNode.put("sourceRoot", sourceRoot);
            
            // Dependencies
            ArrayNode dependenciesArray = objectMapper.createArrayNode();
            for (Dependency dependency : mavenProject.getDependencies()) {
                if ("compile".equals(dependency.getScope()) || dependency.getScope() == null) {
                    ObjectNode depNode = objectMapper.createObjectNode();
                    depNode.put("groupId", dependency.getGroupId());
                    depNode.put("artifactId", dependency.getArtifactId());
                    depNode.put("version", dependency.getVersion());
                    depNode.put("scope", dependency.getScope() != null ? dependency.getScope() : "compile");
                    dependenciesArray.add(depNode);
                }
            }
            projectNode.set("dependencies", dependenciesArray);
            
            // Tags
            ArrayNode tagsArray = objectMapper.createArrayNode();
            tagsArray.add("maven:" + mavenProject.getGroupId());
            tagsArray.add("maven:" + mavenProject.getPackaging());
            if (mavenProject.getPackaging().equals("maven-plugin")) {
                tagsArray.add("maven:plugin");
            }
            projectNode.set("tags", tagsArray);
            
            // Modules (for parent POMs)
            if (mavenProject.getModules() != null && !mavenProject.getModules().isEmpty()) {
                ArrayNode modulesArray = objectMapper.createArrayNode();
                for (String module : mavenProject.getModules()) {
                    modulesArray.add(module);
                }
                projectNode.set("modules", modulesArray);
            }
            
            // Check if project has tests
            File testDir = new File(mavenProject.getBasedir(), "src/test/java");
            projectNode.put("hasTests", testDir.exists() && testDir.isDirectory());
            
            // Check if project has resources
            File resourcesDir = new File(mavenProject.getBasedir(), "src/main/resources");
            projectNode.put("hasResources", resourcesDir.exists() && resourcesDir.isDirectory());
            
            getLog().debug("Analyzed project: " + mavenProject.getArtifactId() + " at " + relativePath);
            
            return projectNode;
            
        } catch (Exception e) {
            getLog().warn("Failed to analyze project: " + mavenProject.getArtifactId(), e);
            return null;
        }
    }
    
    private String determineProjectType(String packaging) {
        switch (packaging.toLowerCase()) {
            case "pom":
                return "library";
            case "jar":
            case "war":
            case "ear":
                return "application";
            case "maven-plugin":
                return "library";
            default:
                return "library";
        }
    }
}