//! Strips terminal escape sequences that request a reply from the terminal
//! (DA1-3, DSR, DECRQM, XTVERSION, kitty keyboard, XTWINOPS reports, OSC
//! queries, XTGETTCAP/DECRQSS) out of captured task output. Recordings are
//! replayed when no process is consuming terminal replies anymore, so a
//! replayed query makes the terminal answer into a cooked-mode stdin and the
//! reply gets echoed as garbage next to the run summary.

use std::borrow::Cow;

const MAX_PENDING: usize = 8 * 1024;

enum Classification {
    /// A complete query sequence of this byte length — drop it.
    Query(usize),
    /// A complete non-query sequence of this byte length — keep it.
    NotQuery(usize),
    /// The chunk ends mid-sequence; hold the tail until more bytes arrive.
    Incomplete,
}

/// Streaming filter: pty output arrives in arbitrary read chunks, so a query
/// sequence can straddle a chunk boundary. A trailing partial escape sequence
/// is held back until the next `feed` (or `flush`) can classify it.
pub struct QueryFilter {
    pending: Vec<u8>,
}

impl QueryFilter {
    pub fn new() -> Self {
        Self {
            pending: Vec::new(),
        }
    }

    pub fn feed<'a>(&mut self, chunk: &'a [u8]) -> Cow<'a, [u8]> {
        // Fast path: nothing held over and nothing to remove or hold — the
        // caller's slice passes through without an allocation or copy.
        if self.pending.is_empty() && scan_is_clean(chunk) {
            return Cow::Borrowed(chunk);
        }

        let input: Vec<u8> = if self.pending.is_empty() {
            chunk.to_vec()
        } else {
            let mut held = std::mem::take(&mut self.pending);
            held.extend_from_slice(chunk);
            held
        };

        let mut out = Vec::with_capacity(input.len());
        let mut i = 0;
        while i < input.len() {
            if input[i] != 0x1b {
                out.push(input[i]);
                i += 1;
                continue;
            }
            match classify(&input[i..]) {
                Classification::Query(len) => i += len,
                Classification::NotQuery(len) => {
                    out.extend_from_slice(&input[i..i + len]);
                    i += len;
                }
                Classification::Incomplete => {
                    // An unterminated OSC/DCS could otherwise buffer forever.
                    if input.len() - i > MAX_PENDING {
                        out.extend_from_slice(&input[i..]);
                    } else {
                        self.pending = input[i..].to_vec();
                    }
                    break;
                }
            }
        }
        Cow::Owned(out)
    }

    /// Release whatever partial sequence is still held (call at EOF).
    pub fn flush(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.pending)
    }
}

/// Classify-only pass: true when the chunk needs no filtering — no query to
/// remove and no partial sequence to hold. Escape-free chunks exit on the
/// `memchr`-backed position scan without classifying anything.
fn scan_is_clean(chunk: &[u8]) -> bool {
    let mut i = 0;
    while let Some(esc) = chunk[i..].iter().position(|b| *b == 0x1b) {
        i += esc;
        match classify(&chunk[i..]) {
            Classification::NotQuery(len) => i += len,
            Classification::Query(_) | Classification::Incomplete => return false,
        }
    }
    true
}

/// `s` starts with ESC. Decide whether the escape sequence it begins is a
/// reply-eliciting query, something else, or not yet fully buffered.
fn classify(s: &[u8]) -> Classification {
    if s.len() < 2 {
        return Classification::Incomplete;
    }
    match s[1] {
        b'[' => classify_csi(s),
        b']' => classify_osc(s),
        b'P' => classify_dcs(s),
        _ => Classification::NotQuery(2),
    }
}

fn classify_csi(s: &[u8]) -> Classification {
    let mut i = 2;
    while i < s.len() && (0x30..=0x3f).contains(&s[i]) {
        i += 1;
    }
    let params_end = i;
    while i < s.len() && (0x20..=0x2f).contains(&s[i]) {
        i += 1;
    }
    if i >= s.len() {
        return Classification::Incomplete;
    }
    let final_byte = s[i];
    if !(0x40..=0x7e).contains(&final_byte) {
        // Malformed CSI; emit the ESC alone and rescan from the next byte.
        return Classification::NotQuery(1);
    }
    let params = &s[2..params_end];
    let intermediates = &s[params_end..i];
    let len = i + 1;
    if is_query_csi(params, intermediates, final_byte) {
        Classification::Query(len)
    } else {
        Classification::NotQuery(len)
    }
}

fn is_query_csi(params: &[u8], intermediates: &[u8], final_byte: u8) -> bool {
    let digits_and_semis = |p: &[u8]| p.iter().all(|b| b.is_ascii_digit() || *b == b';');
    let has_digit = |p: &[u8]| p.iter().any(|b| b.is_ascii_digit());

    if intermediates == b"$" && final_byte == b'p' {
        // DECRQM mode query (`CSI ? Ps $ p` / `CSI Ps $ p`); replies end in $y
        let p = params.strip_prefix(b"?").unwrap_or(params);
        return has_digit(p) && digits_and_semis(p);
    }
    if !intermediates.is_empty() {
        return false;
    }
    match final_byte {
        // DA1 `CSI Ps c`, DA2 `CSI > Ps c`, DA3 `CSI = Ps c`; replies carry `?`
        b'c' => {
            let p = params
                .strip_prefix(b">")
                .or_else(|| params.strip_prefix(b"="))
                .unwrap_or(params);
            !params.starts_with(b"?") && digits_and_semis(p)
        }
        // DSR `CSI 5 n` / `CSI 6 n` and DEC variants `CSI ? Ps n`
        b'n' => {
            let p = params.strip_prefix(b"?").unwrap_or(params);
            has_digit(p) && digits_and_semis(p)
        }
        // XTVERSION `CSI > Ps q`
        b'q' => match params.strip_prefix(b">") {
            Some(rest) => rest.iter().all(|b| b.is_ascii_digit()),
            None => false,
        },
        // Kitty keyboard protocol query `CSI ? u`
        b'u' => params == b"?",
        // XTWINOPS report requests; other `t` values are window ops, kept
        b't' => matches!(
            params,
            b"11" | b"13" | b"14" | b"15" | b"16" | b"18" | b"19" | b"20" | b"21"
        ),
        _ => false,
    }
}

fn classify_osc(s: &[u8]) -> Classification {
    let mut i = 2;
    while i < s.len() {
        match s[i] {
            0x07 => return osc_verdict(&s[2..i], i + 1),
            0x1b => {
                if i + 1 >= s.len() {
                    return Classification::Incomplete;
                }
                return if s[i + 1] == b'\\' {
                    osc_verdict(&s[2..i], i + 2)
                } else {
                    // ESC inside an OSC only legally starts ST; bail out raw.
                    Classification::NotQuery(i)
                };
            }
            _ => i += 1,
        }
    }
    Classification::Incomplete
}

fn osc_verdict(payload: &[u8], len: usize) -> Classification {
    // Color/clipboard reads end their payload with `;?` (e.g. `OSC 11;?`)
    if payload.ends_with(b";?") {
        Classification::Query(len)
    } else {
        Classification::NotQuery(len)
    }
}

fn classify_dcs(s: &[u8]) -> Classification {
    if s.len() < 4 {
        return Classification::Incomplete;
    }
    // XTGETTCAP (`DCS + q`) and DECRQSS (`DCS $ q`); replies start `DCS 1 + r`
    if !((s[2] == b'+' || s[2] == b'$') && s[3] == b'q') {
        return Classification::NotQuery(2);
    }
    let mut i = 4;
    while i < s.len() {
        match s[i] {
            0x07 => return Classification::Query(i + 1),
            0x1b => {
                if i + 1 >= s.len() {
                    return Classification::Incomplete;
                }
                if s[i + 1] == b'\\' {
                    return Classification::Query(i + 2);
                }
                return Classification::NotQuery(i);
            }
            _ => i += 1,
        }
    }
    Classification::Incomplete
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strip(input: &[u8]) -> Vec<u8> {
        let mut f = QueryFilter::new();
        let mut out = f.feed(input).into_owned();
        out.extend(f.flush());
        out
    }

    #[test]
    fn strips_da_queries_but_keeps_replies() {
        assert_eq!(strip(b"a\x1b[cb"), b"ab");
        assert_eq!(strip(b"\x1b[0c\x1b[>c\x1b[>0c\x1b[=c"), b"");
        assert_eq!(strip(b"\x1b[?62;22;52c"), b"\x1b[?62;22;52c");
    }

    #[test]
    fn strips_dsr_and_decrqm() {
        assert_eq!(strip(b"\x1b[5n\x1b[6n\x1b[?25n"), b"");
        assert_eq!(strip(b"\x1b[?2026$p\x1b[4$p"), b"");
        // DECRPM replies end in $y and are kept
        assert_eq!(strip(b"\x1b[?2026;2$y"), b"\x1b[?2026;2$y");
    }

    #[test]
    fn strips_xtversion_and_kitty() {
        assert_eq!(strip(b"\x1b[>q\x1b[>0q\x1b[?u"), b"");
        // kitty push/pop are not queries
        assert_eq!(strip(b"\x1b[>1u\x1b[<u"), b"\x1b[>1u\x1b[<u");
    }

    #[test]
    fn strips_xtwinops_reports_keeps_window_ops() {
        assert_eq!(strip(b"\x1b[14t\x1b[18t\x1b[21t"), b"");
        assert_eq!(strip(b"\x1b[22t\x1b[23t"), b"\x1b[22t\x1b[23t");
    }

    #[test]
    fn strips_osc_queries_keeps_osc_sets() {
        assert_eq!(strip(b"\x1b]10;?\x07\x1b]11;?\x1b\\\x1b]52;c;?\x07"), b"");
        assert_eq!(strip(b"\x1b]0;my title\x07"), b"\x1b]0;my title\x07");
        assert_eq!(
            strip(b"\x1b]11;rgb:2121/2121/2121\x07"),
            b"\x1b]11;rgb:2121/2121/2121\x07"
        );
    }

    #[test]
    fn strips_xtgettcap_and_decrqss_keeps_replies() {
        assert_eq!(strip(b"\x1bP+q544e\x1b\\\x1bP$qm\x1b\\"), b"");
        assert_eq!(strip(b"\x1bP1+r4D73=5C\x1b\\"), b"\x1bP1+r4D73=5C\x1b\\");
    }

    #[test]
    fn keeps_ordinary_output_and_sgr() {
        let s = b"\x1b[32mHello\x1b[0m\nworld\x1b[2J\x1b[1;1H";
        assert_eq!(strip(s), s);
    }

    #[test]
    fn strips_nvim_exit_burst() {
        let burst =
            b"bye\x1b[?2027$p\x1b[?2031$p\x1b[?2048$p\x1b[?u\x1b[c\x1b]11;?\x07\x1bP+q4d73\x1b\\\x1b[c";
        assert_eq!(strip(burst), b"bye");
    }

    #[test]
    fn handles_queries_split_across_chunks() {
        let mut f = QueryFilter::new();
        assert_eq!(f.feed(b"start\x1b[?20").as_ref(), b"start");
        assert_eq!(f.feed(b"26$pend").as_ref(), b"end");
        assert_eq!(f.flush(), b"");
    }

    #[test]
    fn handles_osc_split_across_chunks() {
        let mut f = QueryFilter::new();
        assert_eq!(f.feed(b"a\x1b]11;").as_ref(), b"a");
        assert_eq!(f.feed(b"?\x1b").as_ref(), b"");
        assert_eq!(f.feed(b"\\b").as_ref(), b"b");
    }

    #[test]
    fn split_non_query_is_preserved() {
        let mut f = QueryFilter::new();
        assert_eq!(f.feed(b"a\x1b[3").as_ref(), b"a");
        assert_eq!(f.feed(b"2mred").as_ref(), b"\x1b[32mred");
    }

    #[test]
    fn flush_releases_partial_sequence_at_eof() {
        let mut f = QueryFilter::new();
        assert_eq!(f.feed(b"tail\x1b[?20").as_ref(), b"tail");
        assert_eq!(f.flush(), b"\x1b[?20");
    }

    #[test]
    fn oversized_pending_is_released_verbatim() {
        let mut f = QueryFilter::new();
        let mut osc = b"\x1b]".to_vec();
        osc.extend(std::iter::repeat(b'x').take(MAX_PENDING + 10));
        assert_eq!(f.feed(&osc).as_ref(), osc.as_slice());
        assert_eq!(f.flush(), b"");
    }

    #[test]
    fn clean_chunks_are_borrowed_not_copied() {
        let mut f = QueryFilter::new();
        assert!(matches!(f.feed(b"plain output"), Cow::Borrowed(_)));
        // escape sequences that are kept still qualify for the fast path
        assert!(matches!(f.feed(b"\x1b[32mgreen\x1b[0m"), Cow::Borrowed(_)));
        assert!(matches!(f.feed(b"strip\x1b[c"), Cow::Owned(_)));
        // held-over state forces the merge path even for a clean chunk
        assert_eq!(f.feed(b"x\x1b[?20").as_ref(), b"x");
        assert!(matches!(f.feed(b"26$py"), Cow::Owned(_)));
    }
}
