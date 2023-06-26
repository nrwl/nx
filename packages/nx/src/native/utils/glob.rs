use globset::{GlobBuilder, GlobSet, GlobSetBuilder};

pub(crate) fn build_glob_set(globs: Vec<String>) -> anyhow::Result<GlobSet> {
    let mut glob_set_builder = GlobSetBuilder::new();
    for glob in globs {
        let glob = GlobBuilder::new(&glob)
            .literal_separator(true)
            .build()
            .map_err(anyhow::Error::from)?;
        glob_set_builder.add(glob);
    }

    glob_set_builder.build().map_err(anyhow::Error::from)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn should_detect_package_json() {
        let glob_set = build_glob_set(vec![String::from("packages/*/package.json")]).unwrap();
        assert!(glob_set.is_match("packages/nx/package.json"))
    }

    #[test]
    fn should_not_detect_deeply_nested_package_json() {
        let glob_set = build_glob_set(vec![String::from("packages/*/package.json")]).unwrap();
        assert!(!glob_set.is_match("packages/nx/test-files/package.json"))
    }

    #[test]
    fn should_detect_deeply_nested_package_json() {
        let glob_set = build_glob_set(vec![String::from("packages/**/package.json")]).unwrap();
        assert!(glob_set.is_match("packages/nx/test-files/package.json"))
    }

    #[test]
    fn should_detect_node_modules() {
        let glob_set = build_glob_set(vec![String::from("**/node_modules")]).unwrap();
        assert!(glob_set.is_match("node_modules"));
        assert!(glob_set.is_match("packages/nx/node_modules"));
    }
}
