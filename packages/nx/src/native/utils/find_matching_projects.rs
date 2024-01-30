use crate::native::glob::{build_glob_set, NxGlobSet};
use crate::native::project_graph::types::{Project, ProjectGraph};
use hashbrown::HashSet;
use std::collections::HashMap;

struct ProjectPattern<'a> {
    exclude: bool,
    pattern_type: ProjectPatternType,
    value: &'a str,
}
enum ProjectPatternType {
    Name,
    Tag,
    Directory,
    Unlabeled,
}
impl From<&str> for ProjectPatternType {
    fn from(value: &str) -> Self {
        match value {
            "name" => ProjectPatternType::Name,
            "tag" => ProjectPatternType::Tag,
            "directory" => ProjectPatternType::Directory,
            _ => ProjectPatternType::Unlabeled,
        }
    }
}

// Find matching project names given a list of potential project names or globs
pub fn find_matching_projects<'a>(
    patterns: &[&'a str],
    project_graph: &'a ProjectGraph,
) -> anyhow::Result<Vec<&'a str>> {
    if patterns.is_empty() {
        return Ok(vec![]);
    }

    let mut matched_projects: HashSet<&str> = HashSet::new();

    let project_names = project_graph
        .nodes
        .keys()
        .map(|k| k.as_str())
        .collect::<Vec<_>>();

    for pattern in patterns {
        let pattern = parse_string_pattern(pattern, &project_graph.nodes);
        if pattern.value == "*" {
            for project_name in &project_names {
                if pattern.exclude {
                    matched_projects.remove(project_name);
                } else {
                    matched_projects.insert(project_name);
                }
            }
            continue;
        }
        let projects = &project_graph.nodes;
        match pattern.pattern_type {
            ProjectPatternType::Name => add_matching_projects_by_name(
                &project_names,
                projects,
                &pattern,
                &mut matched_projects,
            )?,
            ProjectPatternType::Tag => add_matching_projects_by_tag(
                &project_names,
                projects,
                &pattern,
                &mut matched_projects,
            )?,

            ProjectPatternType::Directory => add_matching_projects_by_directory(
                &project_names,
                projects,
                &pattern,
                &mut matched_projects,
            )?,
            // we can waterfall through the different types until we find a match
            _ => {
                // The size of the selected and excluded projects set, before we
                // start updating it with this pattern. If the size changes, we
                // know we found a match and can skip the other types.
                let original_size = matched_projects.len();
                add_matching_projects_by_name(
                    &project_names,
                    projects,
                    &pattern,
                    &mut matched_projects,
                )?;
                if matched_projects.len() != original_size {
                    // There was some match by name, don't check other types
                    continue;
                }

                add_matching_projects_by_directory(
                    &project_names,
                    projects,
                    &pattern,
                    &mut matched_projects,
                )?;
                if matched_projects.len() != original_size {
                    // There was some match by directory, don't check other types
                    // Note - this doesn't do anything currently, but preps for future
                    // types
                    continue;
                }
            }
        }
    }

    Ok(matched_projects.iter().copied().collect())
}

fn parse_string_pattern<'a>(
    pattern: &'a str,
    projects: &HashMap<String, Project>,
) -> ProjectPattern<'a> {
    let is_exclude = pattern.starts_with('!');
    let pattern = if is_exclude { &pattern[1..] } else { pattern };

    let index_of_first_potential_separator = pattern.find(':');

    if projects.contains_key(pattern) {
        ProjectPattern {
            exclude: is_exclude,
            pattern_type: ProjectPatternType::Name,
            value: pattern,
        }
    } else if index_of_first_potential_separator.is_none() {
        ProjectPattern {
            exclude: is_exclude,
            pattern_type: ProjectPatternType::Unlabeled,
            value: pattern,
        }
    } else {
        let index_of_first_separator =
            index_of_first_potential_separator.expect("separator was already checked");
        let (prefix, value) = pattern.split_at(index_of_first_separator);
        ProjectPattern {
            exclude: is_exclude,
            pattern_type: prefix.into(),
            value: &value[1..],
        }
    }
}

fn add_matching_projects_by_name<'a>(
    project_names: &[&'a str],
    projects: &'a HashMap<String, Project>,
    pattern: &ProjectPattern,
    matched_projects: &mut HashSet<&'a str>,
) -> anyhow::Result<()> {
    let keys = projects.keys().map(|k| k.as_str()).collect::<Vec<_>>();
    if let Some(project_name) = keys.iter().find(|k| *k == &pattern.value) {
        if pattern.exclude {
            matched_projects.remove(pattern.value);
        } else {
            matched_projects.insert(project_name);
        }
        return Ok(());
    }

    get_matching_strings(
        pattern.value,
        &build_glob_set(&[pattern.value])?,
        project_names,
    )
    .iter()
    .for_each(|item| {
        if pattern.exclude {
            matched_projects.remove(item);
        } else {
            matched_projects.insert(item);
        }
    });

    Ok(())
}
fn add_matching_projects_by_directory<'a>(
    project_names: &[&'a str],
    projects: &HashMap<String, Project>,
    pattern: &ProjectPattern,
    matched_projects: &mut HashSet<&'a str>,
) -> anyhow::Result<()> {
    let glob = build_glob_set(&[pattern.value])?;
    for project_name in project_names {
        let Some(root) = projects.get(*project_name).map(|p| p.root.as_str()) else {
            continue;
        };

        if !get_matching_strings(pattern.value, &glob, &[root]).is_empty() {
            if pattern.exclude {
                matched_projects.remove(project_name);
            } else {
                matched_projects.insert(project_name);
            }
        }
    }

    Ok(())
}

fn add_matching_projects_by_tag<'a>(
    project_names: &[&'a str],
    projects: &HashMap<String, Project>,
    pattern: &ProjectPattern,
    matched_projects: &mut HashSet<&'a str>,
) -> anyhow::Result<()> {
    let glob = build_glob_set(&[pattern.value])?;
    for project_name in project_names {
        let project_tags = projects
            .get(*project_name)
            .and_then(|p| p.tags.as_ref())
            .map(|tags| tags.iter().map(|tag| tag.as_str()).collect::<Vec<_>>());
        let Some(tags) = project_tags else {
            continue;
        };

        if tags.contains(&pattern.value) {
            if pattern.exclude {
                matched_projects.remove(project_name);
            } else {
                matched_projects.insert(project_name);
            }
            continue;
        }

        if !get_matching_strings(pattern.value, &glob, &tags).is_empty() {
            if pattern.exclude {
                matched_projects.remove(project_name);
            } else {
                matched_projects.insert(project_name);
            }
        }
    }

    Ok(())
}

fn get_matching_strings<'a>(pattern: &str, glob: &NxGlobSet, items: &[&'a str]) -> Vec<&'a str> {
    items
        .iter()
        .filter(|item| *item == &pattern || glob.is_match(item))
        .copied()
        .collect()
}
