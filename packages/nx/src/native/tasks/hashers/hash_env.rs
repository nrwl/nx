use crate::native::hasher::hash;
use std::collections::HashMap;

pub fn hash_env(env_name: &str, env: &HashMap<String, String>) -> String {
    let env_value = env.get(env_name).map(|s| s.as_str()).unwrap_or("");
    hash(env_value.as_bytes())
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn should_hash_env_given_they_exist() {
        let mut env = HashMap::new();
        env.insert("foo".to_string(), "bar".to_string());
        env.insert("baz".to_string(), "qux".to_string());
        let hash = hash_env("foo", &env);

        assert_eq!(hash, "15304296276065178466");
    }

    #[test]
    fn should_provide_a_default_hash_if_one_does_not_exist() {
        let env = HashMap::new();
        let hash = hash_env("foo", &env);

        assert_eq!(hash, "3244421341483603138");
    }
}
