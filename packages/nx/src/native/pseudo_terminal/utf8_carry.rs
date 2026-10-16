/// Holds back a code point cut by a chunk boundary until its remaining bytes
/// arrive, so it never turns into replacement characters.
#[derive(Default)]
pub struct Utf8Carry {
    pending: Vec<u8>,
}

impl Utf8Carry {
    pub fn feed(&mut self, chunk: &[u8]) -> String {
        self.pending.extend_from_slice(chunk);
        let complete = self.pending.len() - incomplete_tail_len(&self.pending);
        let text = String::from_utf8_lossy(&self.pending[..complete]).into_owned();
        self.pending.drain(..complete);
        text
    }

    pub fn flush(&mut self) -> String {
        let text = String::from_utf8_lossy(&self.pending).into_owned();
        self.pending.clear();
        text
    }
}

// Length of a trailing sequence that more bytes could still complete. Invalid
// bytes are left for the lossy conversion.
fn incomplete_tail_len(bytes: &[u8]) -> usize {
    bytes
        .utf8_chunks()
        .last()
        .map(|chunk| chunk.invalid())
        .filter(|tail| std::str::from_utf8(tail).is_err_and(|e| e.error_len().is_none()))
        .map_or(0, <[u8]>::len)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn holds_a_split_code_point_until_it_completes() {
        let mut carry = Utf8Carry::default();
        assert_eq!(carry.feed(&[0x72, 0xc3]), "r");
        assert_eq!(carry.feed(&[0xa9, 0x61, 0x64, 0x79]), "éady");
        assert_eq!(carry.flush(), "");
    }

    #[test]
    fn holds_three_and_four_byte_sequences() {
        let mut carry = Utf8Carry::default();
        let euro = "€".as_bytes();
        assert_eq!(carry.feed(&euro[..1]), "");
        assert_eq!(carry.feed(&euro[1..2]), "");
        assert_eq!(carry.feed(&euro[2..]), "€");
        let emoji = "😀".as_bytes();
        assert_eq!(carry.feed(&emoji[..3]), "");
        assert_eq!(carry.feed(&emoji[3..]), "😀");
    }

    #[test]
    fn passes_complete_and_invalid_input_through() {
        let mut carry = Utf8Carry::default();
        assert_eq!(carry.feed(b"plain"), "plain");
        assert_eq!(carry.feed("é".as_bytes()), "é");
        assert_eq!(carry.feed(&[0xff, 0x61]), "\u{FFFD}a");
        assert_eq!(carry.feed(&[0x61, 0x80]), "a\u{FFFD}");
    }

    #[test]
    fn flush_converts_a_dangling_lead_byte() {
        let mut carry = Utf8Carry::default();
        assert_eq!(carry.feed(&[0x61, 0xc3]), "a");
        assert_eq!(carry.flush(), "\u{FFFD}");
    }
}
