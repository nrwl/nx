use crate::native::glob::glob_group::GlobGroup;
use crate::native::glob::glob_parser::parse_glob;
use itertools::Itertools;
use std::collections::HashSet;

#[derive(Debug)]
enum GlobType {
    Negative(String),
    Positive(String),
}

pub fn convert_glob(glob: &str) -> anyhow::Result<Vec<String>> {
    let (negated, parsed) = parse_glob(glob)?;
    let mut built_segments: Vec<Vec<GlobType>> = Vec::new();
    for (index, glob_segment) in parsed.iter().enumerate() {
        let is_last = index == parsed.len() - 1;
        built_segments.push(build_segment("", glob_segment, is_last, false));
    }

    let mut globs = built_segments
        .iter()
        .multi_cartesian_product()
        .map(|product| {
            let mut negative = false;
            let mut full_path = false;
            let mut path = String::from("");
            for (index, glob) in product.iter().enumerate() {
                full_path = index == product.len() - 1;
                match glob {
                    GlobType::Negative(s) if index != product.len() - 1 => {
                        path.push_str(&format!("{}/", s));
                        negative = true;
                        break;
                    }
                    GlobType::Negative(s) => {
                        path.push_str(&format!("{}/", s));
                        negative = true;
                    }
                    GlobType::Positive(s) => {
                        path.push_str(&format!("{}/", s));
                    }
                }
            }

            let modified_path = if full_path {
                &path[..path.len() - 1]
            } else {
                &path
            };

            if negative || negated {
                format!("!{}", modified_path)
            } else {
                modified_path.to_owned()
            }
        })
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    globs.sort();
    Ok(globs)
}

fn build_segment(
    existing: &str,
    group: &[GlobGroup],
    is_last_segment: bool,
    is_negative: bool,
) -> Vec<GlobType> {
    if let Some(glob_part) = group.iter().next() {
        let built_glob = format!("{}{}", existing, glob_part);
        match glob_part {
            GlobGroup::ZeroOrMore(_) | GlobGroup::ZeroOrOne(_) => {
                let existing = if !is_last_segment { "*" } else { existing };
                let off_group = build_segment(existing, &group[1..], is_last_segment, is_negative);
                let on_group =
                    build_segment(&built_glob, &group[1..], is_last_segment, is_negative);
                off_group.into_iter().chain(on_group).collect::<Vec<_>>()
            }
            GlobGroup::Negated(_) => {
                let existing = if !is_last_segment { "*" } else { existing };
                let off_group = build_segment(existing, &group[1..], is_last_segment, is_negative);
                let on_group = build_segment(&built_glob, &group[1..], is_last_segment, true);
                off_group.into_iter().chain(on_group).collect::<Vec<_>>()
            }
            GlobGroup::NegatedFileName(_) => {
                let off_group = build_segment("*.", &group[1..], is_last_segment, is_negative);
                let on_group = build_segment(&built_glob, &group[1..], is_last_segment, true);
                off_group.into_iter().chain(on_group).collect::<Vec<_>>()
            }
            GlobGroup::NegatedWildcard(_) => {
                let off_group = build_segment("*", &group[1..], is_last_segment, is_negative);
                let on_group = build_segment(&built_glob, &group[1..], is_last_segment, true);
                off_group.into_iter().chain(on_group).collect::<Vec<_>>()
            }
            GlobGroup::OneOrMore(_)
            | GlobGroup::ExactOne(_)
            | GlobGroup::NonSpecial(_)
            | GlobGroup::NonSpecialGroup(_) => {
                build_segment(&built_glob, &group[1..], is_last_segment, is_negative)
            }
        }
    } else if is_negative {
        vec![GlobType::Negative(existing.to_string())]
    } else {
        vec![GlobType::Positive(existing.to_string())]
    }
}

#[cfg(test)]
mod test {
    use super::convert_glob;

    #[test]
    fn convert_globs_full_convert() {
        let full_convert =
            convert_glob("dist/!(cache|cache2)/**/!(README|LICENSE).(js|ts)").unwrap();
        assert_eq!(
            full_convert,
            [
                "!dist/*/**/{README,LICENSE}.{js,ts}",
                "!dist/{cache,cache2}/",
                "dist/*/**/*.{js,ts}",
            ]
        );
    }

    #[test]
    fn convert_globs_no_dirs() {
        let no_dirs = convert_glob("dist/**/!(README|LICENSE).(js|ts)").unwrap();
        assert_eq!(
            no_dirs,
            ["!dist/**/{README,LICENSE}.{js,ts}", "dist/**/*.{js,ts}",]
        );
    }

    #[test]
    fn convert_globs_no_files() {
        let no_files = convert_glob("dist/!(cache|cache2)/**/*.(js|ts)").unwrap();
        assert_eq!(no_files, ["!dist/{cache,cache2}/", "dist/*/**/*.{js,ts}",]);
    }

    #[test]
    fn convert_globs_no_extensions() {
        let no_extensions = convert_glob("dist/!(cache|cache2)/**/*.js").unwrap();
        assert_eq!(no_extensions, ["!dist/{cache,cache2}/", "dist/*/**/*.js",]);
    }

    #[test]
    fn convert_globs_no_patterns() {
        let no_patterns = convert_glob("dist/**/*.js").unwrap();
        assert_eq!(no_patterns, ["dist/**/*.js",]);
    }

    #[test]
    fn convert_globs_single_negative() {
        let negative_single_dir = convert_glob("packages/!(package-a)*").unwrap();
        assert_eq!(negative_single_dir, ["!packages/package-a*", "packages/*"]);
    }

    #[test]
    fn convert_globs_single_negative_wildcard_directory() {
        let negative_single_dir = convert_glob("packages/!(package-a)*/package.json").unwrap();
        assert_eq!(
            negative_single_dir,
            ["!packages/package-a*/", "packages/*/package.json"]
        );
    }

    #[test]
    fn test_transforming_globs() {
        let globs = convert_glob("!(test|e2e)/?(*.)+(spec|test).[jt]s!(x)?(.snap)").unwrap();
        assert_eq!(
            globs,
            vec![
                "!*/*.{spec,test}.[jt]sx",
                "!*/*.{spec,test}.[jt]sx.snap",
                "!*/{spec,test}.[jt]sx",
                "!*/{spec,test}.[jt]sx.snap",
                "!{test,e2e}/",
                "*/*.{spec,test}.[jt]s",
                "*/*.{spec,test}.[jt]s.snap",
                "*/{spec,test}.[jt]s",
                "*/{spec,test}.[jt]s.snap"
            ]
        );

        let globs = convert_glob("**/!(package-a)*").unwrap();
        assert_eq!(globs, vec!["!**/package-a*", "**/*"]);

        let globs = convert_glob("dist/!(cache|cache2)/**/!(README|LICENSE).(js|ts)").unwrap();
        assert_eq!(
            globs,
            [
                "!dist/*/**/{README,LICENSE}.{js,ts}",
                "!dist/{cache,cache2}/",
                "dist/*/**/*.{js,ts}"
            ]
        );
    }

    #[test]
    fn should_convert_globs_with_invalid_groups() {
        let globs = convert_glob("libs/**/?(*.)+spec.ts?(.snap)").unwrap();
        assert_eq!(
            globs,
            [
                "libs/**/*.spec.ts",
                "libs/**/*.spec.ts.snap",
                "libs/**/spec.ts",
                "libs/**/spec.ts.snap"
            ]
        );

        let globs = convert_glob("libs/**/?(*.)@spec.ts?(.snap)").unwrap();
        assert_eq!(
            globs,
            [
                "libs/**/*.spec.ts",
                "libs/**/*.spec.ts.snap",
                "libs/**/spec.ts",
                "libs/**/spec.ts.snap"
            ]
        );
        let globs = convert_glob("libs/**/?(*.)?spec.ts?(.snap)").unwrap();
        assert_eq!(
            globs,
            [
                "libs/**/*.spec.ts",
                "libs/**/*.spec.ts.snap",
                "libs/**/spec.ts",
                "libs/**/spec.ts.snap"
            ]
        );
    }
}
