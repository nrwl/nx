const path = require('path');
const nxJson = require('@nrwl/workspace').readNxJson();
const workspaceJson = require('@nrwl/workspace').readWorkspaceJson();

function getProjectNameWithTag(projectsJson, tag) {
  return Object.keys(projectsJson.projects)
    .map((projectName) => ({
      ...projectsJson.projects[projectName],
      name: projectName,
    }))
    .filter((project) => project.tags && project.tags.includes(tag))
    .map((project) => project.name);
}

function getNxDevPurgePathList(nxJson, workspace) {
  return getProjectNameWithTag(nxJson, 'scope:nx-dev')
    .filter((projectName) => !['nx-dev', 'nx-dev-e2e'].includes(projectName))
    .map((projectName) => workspace.projects[projectName])
    .map((project) => path.join(project.sourceRoot, 'lib'))
    .map((projectLib) => projectLib.concat('/**/*.{js,ts,jsx,tsx}'));
}

module.exports = {
  mode: 'jit',
  purge: [
    './nx-dev/nx-dev/pages/**/*.{js,ts,jsx,tsx}',
    ...getNxDevPurgePathList(nxJson, workspaceJson),
  ],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        blue: {
          nx: 'rgba(3, 47, 86, 1)',
        },
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
};
