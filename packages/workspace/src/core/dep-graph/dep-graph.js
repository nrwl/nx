function getProjectsByType(type) {
  return window.projects.filter((project) => project.type === type);
}

function groupProjectsByDirectory(projects) {
  let groups = {};

  projects.forEach((project) => {
    const split = project.data.root.split('/');
    const directory = split.slice(1, -1).join('/');

    if (!groups.hasOwnProperty(directory)) {
      groups[directory] = [];
    }
    groups[directory].push(project);
  });

  return groups;
}

function createProjectList(headerText, projects) {
  const header = document.createElement('h5');
  header.textContent = headerText;

  const formGroup = document.createElement('div');
  formGroup.className = 'form-group';

  let sortedProjects = [...projects];
  sortedProjects.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });

  projects.forEach((project) => {
    let formLine = document.createElement('div');
    formLine.className = 'form-line';

    let focusButton = document.createElement('button');
    focusButton.className = 'icon';

    let buttonIconContainer = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    let buttonIcon = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'use'
    );

    buttonIcon.setAttributeNS(
      'http://www.w3.org/1999/xlink',
      'xlink:href',
      '#crosshair'
    );

    buttonIconContainer.appendChild(buttonIcon);

    focusButton.append(buttonIconContainer);

    focusButton.onclick = () => {
      window.focusProject(project.name);
    };

    let label = document.createElement('label');
    label.className = 'form-checkbox';

    let checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'projectName';
    checkbox.value = project.name;
    checkbox.checked = false;

    checkbox.addEventListener('change', filterProjects);

    const labelText = document.createTextNode(project.name);

    formLine.append(focusButton);
    formLine.append(label);

    label.append(checkbox);
    label.append(labelText);

    formGroup.append(formLine);
  });

  const projectsListContainer = document.getElementById('project-lists');
  projectsListContainer.append(header);
  projectsListContainer.append(formGroup);
}

function addProjectCheckboxes() {
  const appProjects = getProjectsByType('app');
  const libProjects = getProjectsByType('lib');
  const e2eProjects = getProjectsByType('e2e');
  const npmProjects = getProjectsByType('npm');

  const libDirectoryGroups = groupProjectsByDirectory(libProjects);

  const projectsListContainer = document.getElementById('project-lists');

  const appsHeader = document.createElement('h4');
  appsHeader.textContent = 'app projects';
  projectsListContainer.append(appsHeader);
  createProjectList('apps', appProjects);

  const e2eHeader = document.createElement('h4');
  e2eHeader.textContent = 'e2e projects';
  projectsListContainer.append(e2eHeader);
  createProjectList('e2e', e2eProjects);

  const libHeader = document.createElement('h4');
  libHeader.textContent = 'lib projects';
  projectsListContainer.append(libHeader);

  const sortedDirectories = Object.keys(libDirectoryGroups).sort();

  sortedDirectories.forEach((directoryName) => {
    createProjectList(directoryName, libDirectoryGroups[directoryName]);
  });

  if (npmProjects.length > 0) {
    const npmHeader = document.createElement('h4');
    npmHeader.textContent = 'npm dependencies';
    projectsListContainer.append(npmHeader);
    createProjectList('npm', npmProjects);
  }
}

function autoExclude() {
  const dependencyCounts = {};

  window.projects.forEach((p) => {
    dependencyCounts[p.name] = 0;
  });

  Object.keys(graph.dependencies).forEach((p) => {
    graph.dependencies[p].forEach((d) => {
      dependencyCounts[d.target]++;
    });
  });

  Object.keys(dependencyCounts)
    .filter((d) => dependencyCounts[d] > 5 || dependencyCounts[d] === 0)
    .forEach((d) => {
      document.querySelector(
        `input[name=projectName][value=${d}]`
      ).checked = false;
    });
}

function hasPath(target, node, visited) {
  if (target === node) return true;

  for (let d of window.graph.dependencies[node] || []) {
    if (visited.indexOf(d.target) > -1) continue;
    visited.push(d.target);
    if (hasPath(target, d.target, visited)) return true;
  }
  return false;
}

function getProjectCheckboxes() {
  return Array.from(document.querySelectorAll('input[name=projectName]'));
}

function checkForAffected() {
  const isAffected = window.affected.length > 0;

  if (isAffected) {
    const selectedAffectedButton = document.getElementById(
      'select-affected-button'
    );
    selectedAffectedButton.classList.remove('hide');

    selectAffectedProjects();
  }
}

window.selectAffectedProjects = () => {
  window.focusedProject = null;
  document.getElementById('focused-project').hidden = true;
  document.getElementById('focused-project-name').innerText = '';

  getProjectCheckboxes().forEach((checkbox) => {
    checkbox.checked = window.affected.includes(checkbox.value);
  });

  window.filterProjects();
};

window.selectAllProjects = () => {
  window.focusedProject = null;
  document.getElementById('focused-project').hidden = true;
  document.getElementById('focused-project-name').innerText = '';

  getProjectCheckboxes().forEach((checkbox) => {
    checkbox.checked = true;
  });

  window.filterProjects();
};

window.deselectAllProjects = () => {
  window.focusedProject = null;
  document.getElementById('focused-project').hidden = true;
  document.getElementById('focused-project-name').innerText = '';

  getProjectCheckboxes().forEach((checkbox) => {
    checkbox.checked = false;
  });

  window.filterProjects();
};

function createDirectoryParents(g, directories) {
  let childDirectory = directories.join('/');
  let childDirectoryId = `dir-${childDirectory}`;

  if (!g.hasNode(childDirectoryId)) {
    g.setNode(childDirectoryId, {
      label: childDirectory,
      clusterLabelPos: 'top',
    });
  }

  if (directories.length > 1) {
    let parentDirectory = directories.slice(0, -1).join('/');
    let parentDirectoryId = `dir-${parentDirectory}`;
    if (!g.hasNode(parentDirectoryId)) {
      g.setNode(parentDirectoryId, {
        label: parentDirectory,
        clusterLabelPos: 'top',
      });
    }
    g.setParent(childDirectoryId, parentDirectoryId);

    createDirectoryParents(g, directories.slice(0, -1));
  }
}

function generateLayout() {
  const g = new window.dagreD3.graphlib.Graph({
    compound: true,
    orderRestarts: 10,
  });

  const groupByFolder = document.querySelector(
    'input[name=displayOptions][value=groupByFolder]'
  ).checked;

  g.setGraph({
    ranksep: 150,
    edgesep: 100,
  });

  g.setDefaultEdgeLabel(function () {
    return {};
  });

  window.filteredProjects.forEach((p) => {
    const shape =
      p.name === window.focusedProject
        ? p.type === 'app' || p.type === 'e2e'
          ? 'glowRect'
          : 'glowEllipse'
        : p.type === 'app' || p.type === 'e2e'
        ? 'rect'
        : 'ellipse';

    const clazz = window.affected.includes(p.name) ? 'affected' : 'no-affected';

    g.setNode(p.name, { label: p.name, shape: shape, class: clazz });

    if (
      groupByFolder &&
      p.type == 'lib' &&
      p.data.hasOwnProperty('sourceRoot')
    ) {
      const split = p.data.sourceRoot.split('/');
      let directories = split.slice(1, -2);

      if (directories.length > 0) {
        let directory = directories.join('/');

        createDirectoryParents(g, directories);

        let directoryId = `dir-${directory}`;

        g.setParent(p.name, directoryId);
      }
    }
  });

  Object.keys(graph.dependencies).forEach((p) => {
    const filteredProjectNames = window.filteredProjects.map((f) => f.name);
    graph.dependencies[p].forEach((d) => {
      if (
        filteredProjectNames.indexOf(p) > -1 &&
        filteredProjectNames.indexOf(d.target) > -1
      ) {
        let clazz =
          window.affected.indexOf(p) > -1 &&
          window.affected.indexOf(d.target) > -1
            ? 'affected'
            : 'no-affected';
        if (d.type === 'dynamic') {
          clazz += ' lazy';
        }

        const label = d.type === 'implicit' ? 'implicit' : undefined;

        g.setEdge(p, d.target, {
          label: label,
          class: clazz,
          curve: window.d3.curveBasis,
        });
      }
    });
  });

  return g;
}

function createRenderer() {
  var render = new dagreD3.render();

  render.shapes().glowRect = (parent, bbox, node) => {
    const filter = node.class.includes('no-affected')
      ? 'sofGlowFocus'
      : 'sofGlowFocusAffected';
    var shapeSvg = parent
      .insert('rect', ':first-child')
      .attr('x', -bbox.width / 2)
      .attr('y', -bbox.height / 2)
      .attr('width', bbox.width)
      .attr('height', bbox.height)
      .attr('filter', `url(#${filter})`);

    node.intersect = function (point) {
      return window.dagreD3.intersect.rect(node, point);
    };

    return shapeSvg;
  };

  render.shapes().glowEllipse = (parent, bbox, node) => {
    const filter = node.class.includes('no-affected')
      ? 'sofGlowFocus'
      : 'sofGlowFocusAffected';

    var rx = bbox.width / 2;
    var ry = bbox.height / 2;
    var shapeSvg = parent
      .insert('ellipse', ':first-child')
      .attr('x', -bbox.width / 2)
      .attr('y', -bbox.height / 2)
      .attr('rx', rx)
      .attr('ry', ry)
      .attr('filter', `url(#${filter})`);

    node.intersect = function (point) {
      return window.dagreD3.intersect.ellipse(node, rx, ry, point);
    };

    return shapeSvg;
  };

  return render;
}

function render() {
  tippy.hideAll();

  const g = generateLayout();
  const render = createRenderer();

  // Set up an SVG group so that we can translate the final graph.
  var svg = d3.select('#svg-canvas');
  svg.select('g').remove();
  let inner = svg.append('g');

  // Set up zoom support
  var zoom = d3.zoom().on('zoom', function () {
    inner.attr('transform', d3.event.transform);
  });
  svg.call(zoom);

  // Run the renderer. This is what draws the final graph.
  setTimeout(() => {
    render(inner, g);

    // Center the graph
    var initialScale = 0.75;

    const mainContent = document.getElementById('main-content');

    svg.call(
      zoom.transform,
      d3.zoomIdentity
        .translate((svg.attr('width') - g.graph().width * initialScale) / 2, 20)
        .scale(initialScale)
    );

    svg.attr('height', mainContent.offsetHeight);
    svg.attr('width', mainContent.offsetWidth);

    addTooltips(inner);
  });
}

function addTooltips(inner) {
  const createTipTemplate = (project) => {
    return `
      <h4><span class="tag">${project.type}</span>${project.name}</h4>
      <p><strong>tags</strong><br> ${project.data.tags.join(', ')}</p>
      <div class="flex">
        <button onclick="window.focusProject('${project.name}')">Focus</button>
        <button onclick="window.excludeProject('${
          project.name
        }')">Exclude</button>
      </div>
  `;
  };

  inner.selectAll('g.node').each(function (id) {
    const project = window.projects.find((p) => p.name === id);
    tippy(this, {
      content: createTipTemplate(project),
      interactive: true,
      appendTo: document.body,
      interactiveBorder: 10,
      trigger: 'click',
    });
  });
}

window.focusProject = (id, doFilter = true) => {
  window.focusedProject = id;

  document.getElementById('focused-project').hidden = false;
  document.getElementById('focused-project-name').innerText = id;

  Array.from(document.querySelectorAll('input[name=projectName]')).forEach(
    (checkbox) => {
      const showProject =
        hasPath(id, checkbox.value, []) || hasPath(checkbox.value, id, []);
      checkbox.checked = showProject;
      checkbox.parentElement.hidden = !showProject;
    }
  );

  if (doFilter) {
    window.filterProjects();
  }
};

window.unfocusProject = () => {
  window.focusedProject = null;
  document.getElementById('focused-project').hidden = true;
  document.getElementById('focused-project-name').innerText = '';

  Array.from(document.querySelectorAll('input[name=projectName]')).forEach(
    (checkbox) => {
      checkbox.checked = false;
      checkbox.parentElement.hidden = false;
    }
  );

  window.filterProjects();
};

window.excludeProject = (id, doFilter = true) => {
  document.querySelector(
    `input[name=projectName][value=${id}]`
  ).checked = false;

  if (doFilter) {
    window.filterProjects();
  }
};

window.filterProjects = () => {
  const checkboxes = Array.from(
    document.querySelectorAll('input[name=projectName]')
  );

  const selectedProjects = checkboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);

  const unselectedProjects = checkboxes
    .filter((checkbox) => !checkbox.checked)
    .map((checkbox) => checkbox.value);

  if (selectedProjects.length === window.projects.length) {
    window.filteredProjects = window.projects;
  } else {
    window.filteredProjects = window.projects.filter((p) => {
      const filtered = selectedProjects.find(
        (f) => hasPath(f, p.name, []) || hasPath(p.name, f, [])
      );

      return unselectedProjects.indexOf(p.name) === -1 && filtered;
    });
  }

  if (window.filteredProjects.length === 0) {
    document.getElementById('no-projects-chosen').style.display = 'flex';
  } else {
    document.getElementById('no-projects-chosen').style.display = 'none';
  }
  render();
};

function listenForTextFilterChanges() {
  const textFilterInput = document.getElementById('textFilterInput');
  const textFilterButton = document.getElementById('textFilterButton');

  textFilterButton.addEventListener('click', () => {
    filterProjectsByText(textFilterInput.value.toLowerCase());
  });

  textFilterInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
      filterProjectsByText(textFilterInput.value.toLowerCase());
    }
  });
}

function filterProjectsByText(text) {
  const checkboxes = Array.from(
    document.querySelectorAll('input[name=projectName]')
  );

  checkboxes.forEach((checkbox) => (checkbox.checked = false));

  const split = text.split(',').map((splitItem) => splitItem.trim());

  const matchedProjects = checkboxes
    .map((checkbox) => checkbox.value)
    .filter(
      (project) =>
        split.findIndex((splitItem) => project.includes(splitItem)) > -1
    );

  const includeInPath = document.querySelector('input[name=textFilterCheckbox]')
    .checked;

  matchedProjects.forEach((project) => {
    checkboxes.forEach((checkbox) => {
      if (
        checkbox.value === project ||
        (includeInPath &&
          (hasPath(project, checkbox.value, []) ||
            hasPath(checkbox.value, project, [])))
      ) {
        checkbox.checked = true;
      }
    });
  });

  window.filterProjects();
}

setTimeout(() => {
  addProjectCheckboxes();
  checkForAffected();

  document
    .querySelector('input[name=displayOptions][value=groupByFolder]')
    .addEventListener('change', () => window.filterProjects());

  window.addEventListener('resize', () => render());

  if (window.groupByFolder) {
    document.querySelector(
      'input[name=displayOptions][value=groupByFolder]'
    ).checked = true;
  }

  if (window.focusedProject !== null) {
    focusProject(window.focusedProject, false);
  }

  if (window.exclude.length > 0) {
    window.exclude.forEach((project) => excludeProject(project, false));
  }

  listenForTextFilterChanges();

  filterProjects();
});
