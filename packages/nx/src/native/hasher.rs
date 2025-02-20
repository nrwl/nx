#[napi]
pub fn hash_array(input: Vec<Option<String>>) -> String {
    nx_hasher::hash_array_optional(input)
}

#[napi]
pub fn hash_file(file: String) -> Option<String> {
    nx_hasher::hash_file(file)
}


