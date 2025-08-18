#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the Maven projects JSON
const mavenProjectsPath = 'nx-maven-projects.json';
if (!fs.existsSync(mavenProjectsPath)) {
  console.error('❌ nx-maven-projects.json not found. Run Maven analyzer first:');
  console.error('mvn com.nx.maven:nx-maven-analyzer-plugin:1.0-SNAPSHOT:analyze');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(mavenProjectsPath, 'utf8'));
console.log(`📊 Found ${data.projects.length} Maven projects to process`);

let created = 0;
let skipped = 0;

for (const project of data.projects) {
  const { artifactId, groupId, packaging, root, sourceRoot, hasTests } = project;
  
  if (!artifactId || !root) {
    console.log(`⚠️  Skipping invalid project: ${JSON.stringify(project)}`);
    skipped++;
    continue;
  }
  
  // Skip parent POMs and test projects
  if (packaging === 'pom' || root.includes('/src/test/') || root.includes('/its/')) {
    console.log(`⏭️  Skipping parent/test project: ${artifactId}`);
    skipped++;
    continue;
  }
  
  const projectType = packaging === 'pom' ? 'library' : 'application';
  
  // Create targets based on reactor project data
  const targets = {
    compile: {
      executor: '@nx/maven:compile',
      options: { 
        goals: ['compile'],
        projectRoot: root
      }
    },
    clean: {
      executor: '@nx/maven:compile', 
      options: { 
        goals: ['clean'],
        projectRoot: root
      }
    }
  };
  
  // Add test target if project has tests
  if (hasTests) {
    targets.test = {
      executor: '@nx/maven:test',
      options: { 
        goals: ['test'],
        projectRoot: root
      }
    };
  }
  
  // Add package target for applications
  if (projectType === 'application') {
    targets.package = {
      executor: '@nx/maven:package',
      options: { 
        goals: ['package'],
        projectRoot: root
      }
    };
  }
  
  // Create Nx project configuration
  const projectConfig = {
    name: artifactId,
    '$schema': '../../node_modules/nx/schemas/project-schema.json',
    root: root,
    projectType: projectType,
    sourceRoot: sourceRoot,
    targets: targets,
    tags: project.tags || [`maven:${groupId}`, `maven:${packaging}`]
  };
  
  // Write project.json file
  const projectJsonPath = path.join(root, 'project.json');
  const projectDir = path.dirname(projectJsonPath);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  
  // Write the project.json file
  fs.writeFileSync(projectJsonPath, JSON.stringify(projectConfig, null, 2));
  console.log(`✅ Created: ${projectJsonPath}`);
  created++;
}

console.log(`\n🎯 Summary:`);
console.log(`   ✅ Created: ${created} project.json files`);
console.log(`   ⏭️  Skipped: ${skipped} projects`);
console.log(`\n🚀 Run 'nx show projects' to see all Maven projects!`);