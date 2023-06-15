pub trait Normalize {
    fn to_normalized_string(&self) -> String;
}

impl Normalize for std::path::Path {
    fn to_normalized_string(&self) -> String {
        // convert back-slashes in Windows paths, since the js expects only forward-slash path separators
        if cfg!(windows) {
            self.display().to_string().replace('\\', "/")
        } else {
            self.display().to_string()
        }
    }
}
