use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::project_graph::types::{Project, ProjectGraph};
use hashbrown::HashSet;
use std::collections::HashMap;
use std::sync::Arc;

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
    if let Some(project_name) = projects
        .get_key_value(pattern.value)
        .map(|(k, _)| k.as_str())
    {
        if pattern.exclude {
            matched_projects.remove(pattern.value);
        } else {
            matched_projects.insert(project_name);
        }
        return Ok(());
    }

    let glob = pattern_glob(pattern.value);
    get_matching_strings(pattern.value, glob.as_deref(), project_names)
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
    let glob = pattern_glob(pattern.value);
    for project_name in project_names {
        let Some(root) = projects.get(*project_name).map(|p| p.root.as_str()) else {
            continue;
        };

        if !get_matching_strings(pattern.value, glob.as_deref(), &[root]).is_empty() {
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
    let glob = pattern_glob(pattern.value);
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

        if !get_matching_strings(pattern.value, glob.as_deref(), &tags).is_empty() {
            if pattern.exclude {
                matched_projects.remove(project_name);
            } else {
                matched_projects.insert(project_name);
            }
        }
    }

    Ok(())
}

/// A pattern that is not a valid glob (`tag:wip(`) still matches exactly.
fn pattern_glob(pattern: &str) -> Option<Arc<NxGlobSet>> {
    build_glob_set(&[pattern]).ok()
}

fn get_matching_strings<'a>(
    pattern: &str,
    glob: Option<&NxGlobSet>,
    items: &[&'a str],
) -> Vec<&'a str> {
    items
        .iter()
        .filter(|item| *item == &pattern || glob.is_some_and(|glob| glob.is_match(item)))
        .copied()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn graph(projects: &[(&str, &str, &[&str])]) -> ProjectGraph {
        let nodes = projects
            .iter()
            .map(|(name, root, tags)| {
                let project = Project {
                    root: root.to_string(),
                    named_inputs: None,
                    tags: Some(tags.iter().map(|tag| tag.to_string()).collect()),
                    targets: HashMap::new(),
                };
                (name.to_string(), project)
            })
            .collect();
        ProjectGraph {
            nodes,
            dependencies: HashMap::new(),
            external_nodes: HashMap::new(),
        }
    }

    fn matching(patterns: &[&str], graph: &ProjectGraph) -> Vec<String> {
        let mut found: Vec<String> = find_matching_projects(patterns, graph)
            .unwrap()
            .into_iter()
            .map(String::from)
            .collect();
        found.sort();
        found
    }

    #[test]
    fn a_pattern_that_is_not_a_glob_matches_exactly() {
        let graph = graph(&[
            ("a", "libs/a", &["wip("]),
            ("b", "libs/b(", &[]),
            ("c", "libs/c", &["wip"]),
        ]);
        assert_eq!(matching(&["tag:wip("], &graph), ["a"]);
        assert_eq!(matching(&["directory:libs/b("], &graph), ["b"]);
        assert!(matching(&["name:a("], &graph).is_empty());
        assert!(matching(&["c("], &graph).is_empty());
    }
}
