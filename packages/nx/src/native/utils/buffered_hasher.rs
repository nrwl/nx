use xxhash_rust::xxh3::Xxh3;

/// A buffered hasher that accumulates data before updating the underlying hasher.
/// This reduces the number of hasher update calls and improves performance.
pub struct BufferedHasher {
    hasher: Xxh3,
    buffer: Vec<u8>,
    capacity: usize,
}

impl BufferedHasher {
    /// Creates a new buffered hasher with the specified buffer capacity.
    pub fn new(capacity: usize) -> Self {
        Self {
            hasher: Xxh3::new(),
            buffer: Vec::with_capacity(capacity),
            capacity,
        }
    }

    /// Creates a new buffered hasher with a default 8KB buffer capacity.
    pub fn with_default_capacity() -> Self {
        Self::new(8192) // 8KB buffer
    }

    /// Adds data to the buffer, flushing to the hasher if needed.
    pub fn update(&mut self, data: &[u8]) {
        // If adding this data would exceed buffer capacity, flush first
        if self.buffer.len() + data.len() > self.capacity {
            self.flush();
        }

        // Add data to buffer
        self.buffer.extend_from_slice(data);
    }

    /// Adds multiple data chunks to the buffer, flushing as needed.
    pub fn update_multiple(&mut self, data_chunks: &[&[u8]]) {
        for chunk in data_chunks {
            self.update(chunk);
        }
    }

    /// Flushes any buffered data to the underlying hasher.
    pub fn flush(&mut self) {
        if !self.buffer.is_empty() {
            self.hasher.update(&self.buffer);
            self.buffer.clear();
        }
    }

    /// Finalizes the hash, flushing any remaining data.
    pub fn digest(mut self) -> String {
        self.flush();
        self.hasher.digest().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_buffered_hasher_single_update() {
        let mut hasher = BufferedHasher::with_default_capacity();
        hasher.update(b"hello");
        hasher.update(b"world");
        let result = hasher.digest();

        // Compare with direct hasher
        let mut direct_hasher = Xxh3::new();
        direct_hasher.update(b"hello");
        direct_hasher.update(b"world");
        let direct_result = direct_hasher.digest().to_string();

        assert_eq!(result, direct_result);
    }

    #[test]
    fn test_buffered_hasher_multiple_updates() {
        let mut hasher = BufferedHasher::with_default_capacity();
        hasher.update_multiple(&[b"hello", b"world", b"test"]);
        let result = hasher.digest();

        // Compare with direct hasher
        let mut direct_hasher = Xxh3::new();
        direct_hasher.update(b"hello");
        direct_hasher.update(b"world");
        direct_hasher.update(b"test");
        let direct_result = direct_hasher.digest().to_string();

        assert_eq!(result, direct_result);
    }

    #[test]
    fn test_buffered_hasher_large_data() {
        let mut hasher = BufferedHasher::new(100); // Small buffer to force flushes
        let large_data = vec![b'a'; 1000];
        hasher.update(&large_data);
        let result = hasher.digest();

        // Compare with direct hasher
        let mut direct_hasher = Xxh3::new();
        direct_hasher.update(&large_data);
        let direct_result = direct_hasher.digest().to_string();

        assert_eq!(result, direct_result);
    }

    #[test]
    fn test_buffered_hasher_empty() {
        let hasher = BufferedHasher::with_default_capacity();
        let result = hasher.digest();

        // Compare with direct hasher
        let direct_hasher = Xxh3::new();
        let direct_result = direct_hasher.digest().to_string();

        assert_eq!(result, direct_result);
    }
}
