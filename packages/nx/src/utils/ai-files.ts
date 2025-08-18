// import {
//   readFileSync,
//   writeFileSync,
//   existsSync,
//   mkdirSync,
//   appendFileSync,
// } from 'fs';
// import { dirname, join } from 'path';
// import { promisify } from 'util';
// import { exec } from 'child_process';
// import {
//   packageRegistryPack,
//   createTempNpmDirectory,
//   resolvePackageVersionUsingRegistry,
//   getPackageManagerCommand,
//   detectPackageManager,
// } from './package-manager';
// import { extractFileFromTarball, writeJsonFile } from './fileutils';

// const execAsync = promisify(exec);

// function getAgentsRulesString(writeNxCloudRules: boolean): string {
//   let rules = generalAgentsRules;
//   if (writeNxCloudRules) {
//     rules += '\n\n' + nxCloudAgentsRules;
//   }
//   return rules;
// }

// const generalAgentsRules = `# General Guidelines for working with Nx

// - When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through \`nx\` (i.e. \`nx run\`,\`nx run-many\`, \`nx affected\`) instead of using the underlying tooling directly
// - You have access to the Nx MCP server and its tools, use them to help the user
// - When answering questions about the repository, use the \`nx_workspace\` tool first to gain an understanding of the workspace architecture where applicable.
// - When working in individual projects, use the \`nx_project\` mcp tool to analyze and understand the specific project structure and dependencies
// - For questions around nx configuration, best practices or if you're unsure, use the \`nx_docs\` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
// - If the user needs help with an Nx configuration or project graph error, use the \`nx_workspace\` tool to get any errors
// `;

// const nxCloudAgentsRules = `# CI Error Guidelines

// If the user wants help with fixing an error in their CI pipeline, use the following flow:

// - Retrieve the list of current CI Pipeline Executions (CIPEs) using the \`nx_cloud_cipe_details\` tool
// - If there are any errors, use the \`nx_cloud_fix_cipe_failure\` tool to retrieve the logs for a specific task
// - Use the task logs to see what's wrong and help the user fix their problem. Use the appropriate tools if necessary
// - Make sure that the problem is fixed by running the task that you passed into the \`nx_cloud_fix_cipe_failure\` tool
// `;

// const codexNxMcpConfig = `
// [mcp_servers.nx_mcp]
// command = "npx"
// args = ["nx", "mcp"]
// `;

// export type AiConfigFilesOptions = {
//   writeNxCloudRules: boolean;
//   inner?: boolean;
//   packageVersion?: string;
// };

// async function resolvePackageVersion(
//   packageName: string,
//   versionOrTag: string
// ): Promise<string> {
//   // Handle tags like 'latest', 'next', 'canary'
//   try {
//     return await resolvePackageVersionUsingRegistry(packageName, versionOrTag);
//   } catch {
//     // If resolution fails, pass through and let downstream handle it
//     return versionOrTag;
//   }
// }

// async function downloadAiFilesFromRegistry(
//   workspaceRoot: string,
//   packageName: string,
//   packageVersion: string
// ): Promise<any> {
//   const { dir, cleanup } = createTempNpmDirectory(workspaceRoot);

//   // Fix for pnpm compatibility
//   writeJsonFile(`${dir}/package.json`, { name: 'temp-ai-files' });

//   try {
//     // Download tarball using package manager
//     const { tarballPath } = await packageRegistryPack(
//       dir,
//       packageName,
//       packageVersion
//     );

//     // Try to extract .js file first, then .ts
//     let aiFilesPath: string;
//     aiFilesPath = await extractFileFromTarball(
//       join(dir, tarballPath),
//       'package/src/utils/ai-files.js',
//       join(dir, 'ai-files.js')
//     );

//     // Dynamically import the module
//     const module = require(aiFilesPath);
//     return module;
//   } finally {
//     await cleanup();
//   }
// }

// async function getAiFilesUsingInstall(
//   workspaceRoot: string,
//   packageName: string,
//   packageVersion: string
// ): Promise<any> {
//   const { dir, cleanup } = createTempNpmDirectory(workspaceRoot);

//   try {
//     // Get package manager command
//     const pmc = getPackageManagerCommand(detectPackageManager(dir), dir);

//     // Install the package
//     await execAsync(`${pmc.add} ${packageName}@${packageVersion}`, {
//       cwd: dir,
//     });

//     // Try to read the compiled JS file first
//     let modulePath = join(
//       dir,
//       'node_modules',
//       packageName,
//       'src/utils/ai-files.js'
//     );

//     if (!existsSync(modulePath)) {
//       // Try the root level if not in src
//       modulePath = join(dir, 'node_modules', packageName, 'ai-files.js');
//     }

//     if (!existsSync(modulePath)) {
//       // Try TypeScript file (though this would require compilation)
//       const tsPath = join(
//         dir,
//         'node_modules',
//         packageName,
//         'src/utils/ai-files.ts'
//       );
//       if (existsSync(tsPath)) {
//         throw new Error(
//           'TypeScript compilation not supported in install fallback'
//         );
//       }
//       throw new Error(`AI files module not found at ${modulePath}`);
//     }

//     return await import(modulePath);
//   } finally {
//     await cleanup();
//   }
// }

// async function fetchAndExecuteAiFiles(
//   workspaceRoot: string,
//   version: string,
//   options: AiConfigFilesOptions
// ): Promise<boolean> {
//   let aiFilesModule;

//   try {
//     // Primary method: Download tarball and extract
//     aiFilesModule = await downloadAiFilesFromRegistry(
//       workspaceRoot,
//       'nx',
//       version
//     );
//   } catch (tarballError) {
//     console.info('Tarball download failed, trying package install method');

//     try {
//       // Fallback method: Install package and read from node_modules
//       aiFilesModule = await getAiFilesUsingInstall(
//         workspaceRoot,
//         'nx',
//         version
//       );
//     } catch (installError) {
//       throw new Error(`Failed to fetch AI files: ${installError.message}`);
//     }
//   }

//   // Execute the fetched module
//   return await aiFilesModule.writeAiConfigFiles(workspaceRoot, {
//     ...options,
//     inner: true,
//   });
// }

// function writeAiConfigFilesImpl(
//   workspaceRoot: string,
//   options: AiConfigFilesOptions
// ): boolean {
//   const rules = getAgentsRulesString(options.writeNxCloudRules);
//   writeFileSync(join(workspaceRoot, 'CLAUDE.md'), rules);
//   writeFileSync(join(workspaceRoot, 'AGENTS.md'), rules);
//   writeFileSync(join(workspaceRoot, 'GEMINI.md'), rules);

//   addMcpConfigToJson(join(workspaceRoot, '.mcp.json'));
//   addMcpConfigToJson(join(workspaceRoot, '.gemini/settings.json'));
//   // figure out parsing toml for adding to codex config
//   return true;
// }

// export async function writeAiConfigFiles(
//   workspaceRoot: string,
//   options: AiConfigFilesOptions
// ): Promise<boolean> {
//   // If inner flag is set, execute local implementation
//   if (options.inner) {
//     return writeAiConfigFilesImpl(workspaceRoot, options);
//   }

//   // Use environment variable to force local execution
//   if (process.env.NX_AI_FILES_USE_LOCAL === 'true') {
//     return writeAiConfigFilesImpl(workspaceRoot, options);
//   }

//   try {
//     // Resolve version tag to actual version
//     const version = await resolvePackageVersion(
//       'nx',
//       options.packageVersion || 'next' || 'latest'
//     );

//     // Try to fetch and execute from registry
//     const result = await fetchAndExecuteAiFiles(
//       workspaceRoot,
//       version,
//       options
//     );
//     return result;
//   } catch (error) {
//     console.warn(
//       'Failed to fetch AI files from registry, using local version:',
//       error.message
//     );
//     return writeAiConfigFilesImpl(workspaceRoot, options);
//   }
// }

// function addMcpConfigToJson(path: string) {
//   if (!existsSync(dirname(path))) {
//     mkdirSync(dirname(path), { recursive: true });
//   }
//   if (!existsSync(path)) {
//     writeFileSync(path, `{}`, {});
//   }
//   const mcpContent = readFileSync(path).toString();

//   const mcpConfig = JSON.parse(mcpContent);
//   if (mcpConfig.mcpServers) {
//     mcpConfig.mcpServers['nx-mcp'] = {
//       type: 'stdio',
//       command: 'npx',
//       args: ['nx', 'mcp'],
//     };
//   } else {
//     mcpConfig.mcpServers = {
//       'nx-mcp': {
//         type: 'stdio',
//         command: 'npx',
//         args: ['nx', 'mcp'],
//       },
//     };
//   }
//   writeFileSync(path, JSON.stringify(mcpConfig, null, 2));
// }
