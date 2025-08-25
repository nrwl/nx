package dev.nx.maven

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Tests based on real Maven project scenarios
 * 
 * These tests simulate what happens in actual Maven projects
 */
class RealWorldScenariosTest : TestBase() {
    
    @Test
    fun `typical Java library project compile phase`() {
        // Most Java libraries have: sources + resources + dependencies
        val project = testProject
            .withPlugin("maven-compiler-plugin", "compile", "compile")
            .withMainSources()
            .withMainResources() 
            .withDependency("org.slf4j", "slf4j-api", "1.7.36")
            .withDependency("com.google.guava", "guava", "31.1-jre")
        
        val result = analyzer.analyzeCacheability("compile", project.mockProject)
        
        // Should be cacheable with meaningful inputs
        assertTrue(result.cacheable)
        assertEquals("Deterministic based on plugin parameters", result.reason)
    }
    
    @Test
    fun `typical Spring Boot application test phase`() {
        // Spring Boot apps have lots of test dependencies
        val project = testProject
            .withPlugin("maven-surefire-plugin", "test", "test")
            .withTestSources()
            .withTestResources()
            .withDependency("org.springframework.boot", "spring-boot-starter-test", "2.7.0", "test")
            .withDependency("junit", "junit", "4.13.2", "test")
            .withDependency("org.mockito", "mockito-core", "4.6.1", "test")
        
        val result = analyzer.analyzeCacheability("test", project.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No meaningful inputs", result.reason)
    }
    
    @Test
    fun `multi-module parent pom project`() {
        // Parent POMs usually don't have sources, just configuration
        val result = analyzer.analyzeCacheability("compile", testProject.mockProject)
        
        // No plugins = no executions
        assertFalse(result.cacheable)
        assertEquals("No meaningful inputs", result.reason)
    }
    
    @Test
    fun `microservice with Docker packaging`() {
        // Microservices often package as jars and then create Docker images
        val project = testProject
            .withPlugin("maven-jar-plugin", "package", "jar")
            .withMainSources()
            .withMainResources()
            .withDependency("org.springframework.boot", "spring-boot-starter-web", "2.7.0")
        
        val result = analyzer.analyzeCacheability("package", project.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No meaningful inputs", result.reason)
    }
    
    @Test
    fun `integration test phase with failsafe plugin`() {
        // Integration tests use failsafe plugin instead of surefire
        val project = testProject
            .withPlugin("maven-failsafe-plugin", "integration-test", "integration-test")
            .withTestSources()
            .withDependency("org.testcontainers", "junit-jupiter", "1.17.3", "test")
        
        val result = analyzer.analyzeCacheability("integration-test", project.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No analysis available for phase 'integration-test'", result.reason)
    }
    
    @Test
    fun `library with sources and javadoc generation`() {
        // Libraries often generate sources and javadocs
        val project = testProject
            .withPlugin("maven-source-plugin", "package", "jar-no-fork")
            .withPlugin("maven-javadoc-plugin", "package", "jar")
            .withMainSources()
        
        // Test with the first plugin
        val result = analyzer.analyzeCacheability("package", project.mockProject)
        
        assertFalse(result.cacheable)
        assertEquals("No meaningful inputs", result.reason)
    }
    
    @Test
    fun `code quality checks with SpotBugs and Checkstyle`() {
        // Quality checks are common in enterprise projects
        val project = testProject
            .withPlugin("com.github.spotbugs:spotbugs-maven-plugin", "verify", "check")
            .withPlugin("org.apache.maven.plugins:maven-checkstyle-plugin", "verify", "check")
            .withMainSources()
        
        val result = analyzer.analyzeCacheability("verify", project.mockProject)
        
        // Should detect first plugin
        assertFalse(result.cacheable)
        assertEquals("No analysis available for phase 'verify'", result.reason)
    }
}