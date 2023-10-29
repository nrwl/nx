use std::cmp::Ordering;

#[napi(object)]
#[derive(Clone)]
pub struct FileData {
    pub file: String,
    pub hash: String,
}

impl Eq for FileData {}

impl PartialEq<Self> for FileData {
    fn eq(&self, other: &Self) -> bool {
        self.file.eq(&other.file)
    }
}

impl PartialOrd<Self> for FileData {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        self.file.partial_cmp(&other.file)
    }
}

impl Ord for FileData {
    fn cmp(&self, other: &Self) -> Ordering {
        self.file.cmp(&other.file)
    }
}
