//! Strips terminal escape sequences that request a reply from the terminal
//! (DA1-3, DECID, DSR, DECRQM, XTVERSION, kitty keyboard, XTWINOPS reports,
//! OSC queries, XTGETTCAP/DECRQSS) out of captured task output. Recordings
//! are replayed when no process is consuming terminal replies anymore, so a
//! replayed query makes the terminal answer into a cooked-mode stdin and the
//! reply gets echoed as garbage next to the run summary. OSC 52 clipboard
//! sequences are stripped too.
//!
//! Sequences are delimited the way terminals parse them: C0 controls inside a
//! sequence leave it running, and ESC, CAN, SUB and UTF-8 encoded C1 controls
//! end it. A removed sequence that would otherwise join the unfinished
//! sequence before it to the bytes after it is replaced with CAN. Parsers
//! such as vte skip encoded C1 controls inside a sequence, so a sequence
//! ended by one is followed by CAN, and so is an OSC string still open at the
//! end of the output.

use std::borrow::Cow;

const MAX_PENDING: usize = 8 * 1024;
const CAN: u8 = 0x18;

enum Classification {
    /// A complete query sequence of this byte length — drop it.
    Query(usize),
    /// A complete non-query sequence of this byte length — keep it.
    NotQuery(usize),
    /// A sequence of this byte length cut short by the next byte — keep it.
    Aborted(usize),
    /// A sequence of this byte length ended by an encoded C1 control — keep
    /// it and follow it with CAN.
    Cut(usize),
    /// The chunk ends mid-sequence; hold the tail until more bytes arrive.
    Incomplete,
}

/// Streaming filter: pty output arrives in arbitrary read chunks, so a query
/// sequence can straddle a chunk boundary. A trailing partial escape sequence
/// is held back until the next `feed` (or `flush`) can classify it.
pub struct QueryFilter {
    pending: Vec<u8>,
    /// The last bytes emitted are an aborted sequence.
    open: bool,
    /// The last bytes emitted are an OSC string too long to hold, still
    /// open; true while the next byte starts one of its fields.
    osc: Option<bool>,
}

impl QueryFilter {
    pub fn new() -> Self {
        Self {
            pending: Vec::new(),
            open: false,
            osc: None,
        }
    }

    pub fn feed<'a>(&mut self, chunk: &'a [u8]) -> Cow<'a, [u8]> {
        // Fast path: nothing held over and nothing to remove or hold — the
        // caller's slice passes through without an allocation or copy.
        if self.pending.is_empty() && self.osc.is_none() && scan_is_clean(chunk) {
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
        let mut open = std::mem::take(&mut self.open);
        let mut i = 0;
        if let Some(field_start) = self.osc.take() {
            match self.stream_osc(&input, 0, field_start, &mut out) {
                Some((end, still_open)) => {
                    i = end;
                    open = still_open;
                }
                None => return Cow::Owned(out),
            }
        }
        while i < input.len() {
            if !matches!(input[i], 0x1b | 0xc2) {
                out.push(input[i]);
                open = false;
                i += 1;
                continue;
            }
            match classify(&input[i..]) {
                Classification::Query(len) => {
                    cancel_if_open(&mut out, &mut open);
                    i += len;
                }
                Classification::NotQuery(len) => {
                    out.extend_from_slice(&input[i..i + len]);
                    open = false;
                    i += len;
                }
                Classification::Aborted(len) => {
                    out.extend_from_slice(&input[i..i + len]);
                    open = true;
                    i += len;
                }
                Classification::Cut(len) => {
                    out.extend_from_slice(&input[i..i + len]);
                    out.push(CAN);
                    open = false;
                    i += len;
                }
                Classification::Incomplete => {
                    // An unterminated OSC/DCS could otherwise buffer forever.
                    if input.len() - i > MAX_PENDING {
                        let rest = &input[i..];
                        match introducer(rest) {
                            Ok((Kind::Osc, body)) if !drop_unterminated(rest) => {
                                out.extend_from_slice(&rest[..body]);
                                if let Some((end, still_open)) =
                                    self.stream_osc(&input, i + body, false, &mut out)
                                {
                                    i = end;
                                    open = still_open;
                                    continue;
                                }
                            }
                            _ => cancel_if_open(&mut out, &mut open),
                        }
                    } else {
                        self.pending = input[i..].to_vec();
                        self.open = open;
                    }
                    break;
                }
            }
        }
        Cow::Owned(out)
    }

    /// Streams an OSC string from `start`. Returns where scanning resumes and
    /// whether the output leaves a sequence open, or `None` when the input
    /// ends inside the string.
    fn stream_osc(
        &mut self,
        input: &[u8],
        start: usize,
        field_start: bool,
        out: &mut Vec<u8>,
    ) -> Option<(usize, bool)> {
        match stream_osc(input, start, field_start, out) {
            OscStream::Ended(end, still_open) => Some((end, still_open)),
            OscStream::Open(field_start) => {
                self.osc = Some(field_start);
                None
            }
            OscStream::Held(at, field_start) => {
                self.pending = input[at..].to_vec();
                self.osc = Some(field_start);
                None
            }
        }
    }

    /// Release whatever partial sequence is still held (call at EOF).
    pub fn flush(&mut self) -> Vec<u8> {
        let pending = std::mem::take(&mut self.pending);
        let mut open = std::mem::take(&mut self.open);
        if self.osc.take().is_some() {
            return vec![CAN];
        }
        if drop_unterminated(&pending) {
            let mut out = Vec::new();
            cancel_if_open(&mut out, &mut open);
            out
        } else if !pending.is_empty() && matches!(introducer(&pending), Ok((Kind::Osc, _))) {
            let mut out = pending;
            out.push(CAN);
            out
        } else {
            pending
        }
    }
}

fn cancel_if_open(out: &mut Vec<u8>, open: &mut bool) {
    if std::mem::take(open) {
        out.push(CAN);
    }
}

enum OscStream {
    /// The string ended; scanning resumes at this index, and the flag says
    /// whether the output leaves a sequence open.
    Ended(usize, bool),
    /// The input ended inside the string; the flag says whether the next
    /// byte starts a field.
    Open(bool),
    /// The input ended before the bytes from this index could be judged.
    Held(usize, bool),
}

/// Passes through the rest of an OSC string whose start is already emitted,
/// from `start` on. A lone `?` field would make it a query, so the string is
/// ended with CAN in its place.
fn stream_osc(s: &[u8], start: usize, mut field_start: bool, out: &mut Vec<u8>) -> OscStream {
    let mut i = start;
    while i < s.len() {
        match (s[i], s.get(i + 1)) {
            (0x07, _) => {
                out.push(0x07);
                return OscStream::Ended(i + 1, false);
            }
            (0x18 | 0x1a, _) => return OscStream::Ended(i, false),
            (0x1b | 0xc2, None) => return OscStream::Held(i, field_start),
            (0x1b, Some(b'\\')) => {
                out.extend_from_slice(&s[i..i + 2]);
                return OscStream::Ended(i + 2, false);
            }
            (0xc2, Some(0x9c)) => {
                out.extend_from_slice(&s[i..i + 2]);
                out.push(CAN);
                return OscStream::Ended(i + 2, false);
            }
            (0x1b, _) => return OscStream::Ended(i, true),
            (0xc2, Some(0x80..=0x9f)) => {
                out.push(CAN);
                return OscStream::Ended(i, false);
            }
            (b'?', _) if field_start => {
                let next = s[i + 1..]
                    .iter()
                    .position(|b| !is_skipped_in_string(*b))
                    .map(|n| i + 1 + n);
                match next {
                    None if s.len() - i > MAX_PENDING => {
                        out.push(CAN);
                        return OscStream::Ended(s.len(), false);
                    }
                    None => return OscStream::Held(i, true),
                    Some(j) if j + 1 == s.len() && s[j] == 0xc2 => {
                        return OscStream::Held(i, true);
                    }
                    Some(j) if ends_field(s, j) => {
                        out.push(CAN);
                        return OscStream::Ended(j, false);
                    }
                    Some(_) => {
                        out.push(b'?');
                        field_start = false;
                    }
                }
            }
            (b';', _) => {
                out.push(b';');
                field_start = true;
            }
            (b, _) => {
                out.push(b);
                field_start &= is_skipped_in_string(b);
            }
        }
        i += 1;
    }
    OscStream::Open(field_start)
}

/// C0 controls that terminals skip inside an OSC string.
fn is_skipped_in_string(b: u8) -> bool {
    b < 0x20 && !matches!(b, 0x07 | 0x18 | 0x1a | 0x1b)
}

/// Whether `s[j]` ends an OSC field: `;` or anything that ends the string.
fn ends_field(s: &[u8], j: usize) -> bool {
    matches!(
        (s[j], s.get(j + 1)),
        (b';' | 0x07 | 0x18 | 0x1a | 0x1b, _) | (0xc2, Some(0x80..=0x9f))
    )
}

/// Classify-only pass: true when the chunk needs no filtering — no query to
/// remove, no CAN to insert and no partial sequence to hold. Escape-free
/// chunks exit on the position scan without classifying anything.
fn scan_is_clean(chunk: &[u8]) -> bool {
    let mut i = 0;
    while let Some(esc) = chunk[i..].iter().position(|b| matches!(b, 0x1b | 0xc2)) {
        i += esc;
        match classify(&chunk[i..]) {
            Classification::NotQuery(len) | Classification::Aborted(len) => i += len,
            Classification::Query(_) | Classification::Cut(_) | Classification::Incomplete => {
                return false;
            }
        }
    }
    true
}

/// Filters a complete recording in one pass.
pub fn strip_queries(input: &[u8]) -> Vec<u8> {
    let mut filter = QueryFilter::new();
    let mut out = filter.feed(input).into_owned();
    out.extend(filter.flush());
    out
}

enum Kind {
    Csi,
    Osc,
    Dcs,
}

/// C0 controls other than CAN, SUB and ESC, DEL, and non-ASCII bytes other
/// than encoded C1 controls leave an escape sequence running.
fn is_inert(b: u8) -> bool {
    matches!(b, 0x00..=0x17 | 0x19 | 0x1c..=0x1f | 0x7f..=0xff)
}

/// `s` starts with ESC or 0xC2. Finds the kind of sequence it introduces and
/// where its body starts, or classifies it outright when it is neither CSI,
/// OSC nor DCS.
fn introducer(s: &[u8]) -> Result<(Kind, usize), Classification> {
    if s[0] == 0xc2 {
        return match s.get(1) {
            None => Err(Classification::Incomplete),
            Some(0x9b) => Ok((Kind::Csi, 2)),
            Some(0x9d) => Ok((Kind::Osc, 2)),
            Some(0x90) => Ok((Kind::Dcs, 2)),
            Some(_) => Err(Classification::NotQuery(1)),
        };
    }
    let mut i = 1;
    loop {
        match ends_sequence(s, i) {
            None => return Err(Classification::Incomplete),
            Some(true) => return Err(Classification::Aborted(i)),
            Some(false) if is_inert(s[i]) => i += 1,
            Some(false) => break,
        }
    }
    match s[i] {
        b'[' => Ok((Kind::Csi, i + 1)),
        b']' => Ok((Kind::Osc, i + 1)),
        b'P' => Ok((Kind::Dcs, i + 1)),
        // DECID, an old form of DA1
        b'Z' => Err(Classification::Query(i + 1)),
        _ => Err(Classification::NotQuery(i + 1)),
    }
}

/// Whether `s[i]` is ESC or a UTF-8 encoded C1 control, either of which ends
/// the sequence before it. `None` when that is not yet buffered.
fn ends_sequence(s: &[u8], i: usize) -> Option<bool> {
    match (s.get(i)?, s.get(i + 1)) {
        (0x1b, _) | (0xc2, Some(0x80..=0x9f)) => Some(true),
        (0xc2, None) => None,
        _ => Some(false),
    }
}

/// Decide whether the escape sequence `s` begins is a reply-eliciting query,
/// something else, or not yet fully buffered.
fn classify(s: &[u8]) -> Classification {
    let classification = match introducer(s) {
        Ok((Kind::Csi, body)) => classify_csi(s, body),
        Ok((Kind::Osc, body)) => classify_osc(s, body),
        Ok((Kind::Dcs, body)) => classify_dcs(s, body),
        Err(classification) => classification,
    };
    match classification {
        Classification::Aborted(len) if s[len] == 0xc2 => Classification::Cut(len),
        Classification::NotQuery(len) if s[..len].ends_with(&[0xc2, 0x9c]) => {
            Classification::Cut(len)
        }
        classification => classification,
    }
}

/// Whether a sequence still open at EOF, or too long to hold, is dropped.
/// An OSC is judged on its payload so far; anything else is dropped.
fn drop_unterminated(s: &[u8]) -> bool {
    if s.is_empty() {
        return false;
    }
    match introducer(s) {
        Ok((Kind::Osc, body)) => {
            let payload = &s[body..];
            !payload.contains(&b';') || payload.iter().any(|b| *b < 0x20) || osc_is_query(payload)
        }
        Err(_) if s == [0xc2] => false,
        _ => true,
    }
}

fn classify_csi(s: &[u8], body: usize) -> Classification {
    let mut i = body;
    let mut ignored = false;
    let mut inert = false;
    let mut intermediate = false;
    let final_byte = loop {
        let Some(&b) = s.get(i) else {
            return Classification::Incomplete;
        };
        match ends_sequence(s, i) {
            None => return Classification::Incomplete,
            Some(true) => return Classification::Aborted(i),
            Some(false) => {}
        }
        match b {
            0x18 | 0x1a => return Classification::Aborted(i),
            0x20..=0x2f => intermediate = true,
            0x30..=0x3f => ignored |= intermediate,
            0x40..=0x7e => break b,
            _ => inert = true,
        }
        i += 1;
    };
    let len = i + 1;
    if ignored {
        return Classification::NotQuery(len);
    }
    let seq: Cow<[u8]> = if inert {
        Cow::Owned(
            s[body..i]
                .iter()
                .copied()
                .filter(|b| !is_inert(*b))
                .collect(),
        )
    } else {
        Cow::Borrowed(&s[body..i])
    };
    let split = seq
        .iter()
        .position(|b| (0x20..=0x2f).contains(b))
        .unwrap_or(seq.len());
    let (params, intermediates) = seq.split_at(split);
    if is_query_csi(params, intermediates, final_byte) {
        Classification::Query(len)
    } else {
        Classification::NotQuery(len)
    }
}

/// Matches as loosely as terminals do: they read the first parameter with
/// any leading zeros, stop it at `;` or `:`, and some ignore the rest.
fn is_query_csi(params: &[u8], intermediates: &[u8], final_byte: u8) -> bool {
    let first_param = params
        .split(|b| matches!(b, b';' | b':'))
        .next()
        .and_then(|p| std::str::from_utf8(p).ok()?.parse::<u32>().ok());
    match (final_byte, intermediates) {
        // DECRQM `CSI ? Ps $ p` / `CSI Ps $ p`; replies end in $y
        (b'p', _) if intermediates.contains(&b'$') => true,
        // DA1 `CSI Ps c`, DA2 `CSI > Ps c`, DA3 `CSI = Ps c`; replies carry `?`
        (b'c', _) => !params.starts_with(b"?"),
        // DSR `CSI Ps n` and `CSI ? Ps n`; `CSI > Ps n` sets key modifiers
        (b'n', _) => !params.starts_with(b">"),
        // XTVERSION `CSI > Ps q`
        (b'q', _) => params.starts_with(b">"),
        // Kitty keyboard protocol query `CSI ? u`
        (b'u', _) => params.starts_with(b"?"),
        // XTWINOPS report requests; other `t` values are window ops, kept
        (b't', b"") => matches!(first_param, Some(11 | 13..=16 | 18..=21)),
        _ => false,
    }
}

/// Where an OSC or DCS string whose body starts at `body` ends: the end of
/// its payload and the length of the whole sequence. ESC, CAN, SUB and C1
/// controls other than ST end the string without being part of it.
fn string_end(s: &[u8], body: usize) -> Option<(usize, usize)> {
    for i in body..s.len() {
        match (s[i], s.get(i + 1)) {
            (0x07, _) => return Some((i, i + 1)),
            (0x18 | 0x1a, _) => return Some((i, i)),
            (0x1b | 0xc2, None) => return None,
            (0x1b, Some(b'\\')) | (0xc2, Some(0x9c)) => return Some((i, i + 2)),
            (0x1b, _) | (0xc2, Some(0x80..=0x9f)) => return Some((i, i)),
            _ => {}
        }
    }
    None
}

fn classify_osc(s: &[u8], body: usize) -> Classification {
    match string_end(s, body) {
        Some((end, len)) if osc_is_query(&s[body..end]) => Classification::Query(len),
        Some((end, len)) if end == len => Classification::Aborted(len),
        Some((_, len)) => Classification::NotQuery(len),
        None => Classification::Incomplete,
    }
}

/// Color and other reads have a lone `?` field (e.g. `OSC 11;?`,
/// `OSC 10;?;?`), and `OSC 52` and kitty's `OSC 5522` read or write the
/// clipboard. Terminals skip C0 controls inside the string and read the number
/// with any leading zeros, and some skip a `;` before it. kitty takes only the
/// leading digits as the number, so `OSC 52c;...` is a clipboard write there.
fn osc_is_query(payload: &[u8]) -> bool {
    let payload: Vec<u8> = payload.iter().copied().filter(|b| *b >= 0x20).collect();
    let mut fields = payload.split(|b| *b == b';');
    let first = fields.next().unwrap_or_default();
    let number = if first.is_empty() {
        fields.clone().next().unwrap_or_default()
    } else {
        first
    };
    let digits = number.iter().take_while(|b| b.is_ascii_digit());
    let command: Vec<u8> = digits.skip_while(|b| **b == b'0').copied().collect();
    matches!(command.as_slice(), b"52" | b"5522") || fields.any(|f| f == b"?")
}

fn classify_dcs(s: &[u8], body: usize) -> Classification {
    let mut i = body;
    let mut intermediates = 0;
    let mut intermediate = 0;
    let final_byte = loop {
        let Some(&b) = s.get(i) else {
            return Classification::Incomplete;
        };
        match ends_sequence(s, i) {
            None => return Classification::Incomplete,
            Some(true) => return Classification::Aborted(i),
            Some(false) => {}
        }
        match b {
            0x18 | 0x1a => return Classification::Aborted(i),
            0x20..=0x2f => {
                intermediates += 1;
                intermediate = b;
            }
            0x40..=0x7e => break b,
            _ => {}
        }
        i += 1;
    };
    // XTGETTCAP (`DCS + q`) and DECRQSS (`DCS $ q`); replies start `DCS 1 + r`
    if !(intermediates == 1 && matches!(intermediate, b'+' | b'$') && final_byte == b'q') {
        return Classification::NotQuery(i + 1);
    }
    match string_end(s, i + 1) {
        Some((_, len)) => Classification::Query(len),
        None => Classification::Incomplete,
    }
}

#[cfg(test)]
mod tests {
    use super::strip_queries as strip;
    use super::*;

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
    fn strips_osc_52_clipboard_writes() {
        assert_eq!(strip(b"a\x1b]52;c;Y3VybA==\x07b"), b"ab");
        assert_eq!(strip(b"a\x1b]52;;Y3VybA==\x1b\\b"), b"ab");
    }

    #[test]
    fn strips_clipboard_writes_without_a_separator_after_the_number() {
        assert_eq!(strip(b"a\x1b]52c;Y3VybA==\x07b"), b"ab");
        assert_eq!(strip(b"a\x1b]52p;Y3VybA==\x07b"), b"ab");
        assert_eq!(strip(b"a\x1b]5522;type=write\x07b"), b"ab");
    }

    #[test]
    fn keeps_osc_commands_that_only_start_with_52() {
        assert_eq!(strip(b"a\x1b]520;x\x07b"), b"a\x1b]520;x\x07b");
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
    fn flush_judges_partial_sequence_at_eof() {
        let mut f = QueryFilter::new();
        assert_eq!(f.feed(b"tail\x1b[?20").as_ref(), b"tail");
        assert_eq!(f.flush(), b"");
        assert_eq!(strip(b"a\x1b]52;c;Y3VybA=="), b"a");
        assert_eq!(strip(b"a\x1b]11;?"), b"a");
        assert_eq!(strip(b"a\x1b]0;title"), b"a\x1b]0;title\x18");
        assert_eq!(strip(b"a\x1bP+q544e"), b"a");
        assert_eq!(strip("a\u{a9}".as_bytes()), "a\u{a9}".as_bytes());
    }

    #[test]
    fn oversized_pending_is_judged_as_if_terminated() {
        let filler = || std::iter::repeat_n(b'x', MAX_PENDING + 10);

        let mut f = QueryFilter::new();
        let osc: Vec<u8> = b"\x1b]1337;File=".iter().copied().chain(filler()).collect();
        assert_eq!(f.feed(&osc).as_ref(), osc.as_slice());
        assert_eq!(f.feed(b"xx").as_ref(), b"xx");
        assert_eq!(f.flush(), b"\x18");

        let mut f = QueryFilter::new();
        let osc: Vec<u8> = b"\x1b]52;c;".iter().copied().chain(filler()).collect();
        assert_eq!(f.feed(&osc).as_ref(), b"");
        assert_eq!(f.feed(b"xx\x07b").as_ref(), b"xx\x07b");

        let mut f = QueryFilter::new();
        let csi: Vec<u8> = b"\x1b["
            .iter()
            .copied()
            .chain(filler().map(|_| b'0'))
            .collect();
        assert_eq!(f.feed(&csi).as_ref(), b"");
        assert_eq!(f.feed(b"0cb").as_ref(), b"0cb");
    }

    #[test]
    fn esc_can_and_sub_end_osc_and_dcs_strings() {
        assert_eq!(strip(b"a\x1b]52;c;Y3VybA==\x1bXb"), b"a\x1bXb");
        assert_eq!(strip(b"a\x1b]52;c;Y3VybA==\x18b"), b"a\x18b");
        assert_eq!(strip(b"a\x1b]52;c;Y3VybA==\x1ab"), b"a\x1ab");
        assert_eq!(strip(b"a\x1b]11;?\x1bXb"), b"a\x1bXb");
        assert_eq!(strip(b"a\x1bP+q544e\x18b"), b"a\x18b");
        assert_eq!(strip(b"a\x1b]0;title\x1bXb"), b"a\x1b]0;title\x1bXb");
    }

    #[test]
    fn controls_inside_a_sequence_do_not_hide_it() {
        assert_eq!(strip(b"a\x1b[\x00cb"), b"ab");
        assert_eq!(strip(b"a\x1b\x00[cb"), b"ab");
        assert_eq!(strip(b"a\x1b[?20\x7f26$pb"), b"ab");
        assert_eq!(strip(b"a\x1b]5\x002;c;Y3VybA==\x07b"), b"ab");
        assert_eq!(strip(b"a\x1bP\x00+q544e\x1b\\b"), b"ab");
        // CAN aborts the sequence, so what follows is plain text
        assert_eq!(strip(b"a\x1b[\x18cb"), b"a\x1b[\x18cb");
    }

    #[test]
    fn removing_a_sequence_cancels_the_unfinished_one_before_it() {
        assert_eq!(
            strip(b"a\x1b]\x1b[c52;c;Y3VybA==\x07b"),
            b"a\x1b]\x1852;c;Y3VybA==\x07b"
        );
        assert_eq!(
            strip(b"a\x1b]5\x1b[c2;c;Y3VybA==\x07b"),
            b"a\x1b]5\x182;c;Y3VybA==\x07b"
        );
        assert_eq!(
            strip(b"a\x1b\x1b[c]52;c;Y3VybA==\x07b"),
            b"a\x1b\x18]52;c;Y3VybA==\x07b"
        );
        assert_eq!(strip(b"a\x1b[1\x1b[5n;cb"), b"a\x1b[1\x18;cb");
        assert_eq!(
            strip(b"a\x1bP\x1b[c+q544e\x1b\\b"),
            b"a\x1bP\x18+q544e\x1b\\b"
        );

        let mut f = QueryFilter::new();
        assert_eq!(f.feed(b"a\x1b]5\x1b[").as_ref(), b"a\x1b]5");
        assert_eq!(
            f.feed(b"c2;c;Y3VybA==\x07").as_ref(),
            b"\x182;c;Y3VybA==\x07"
        );

        let mut f = QueryFilter::new();
        assert_eq!(f.feed(b"a\x1b]5\x1b[").as_ref(), b"a\x1b]5");
        assert_eq!(f.flush(), b"\x18");
    }

    #[test]
    fn c1_controls_end_a_sequence_like_esc() {
        assert_eq!(strip(b"a\x1b\xc2\x9d52;c;Y3VybA==\x07b"), b"a\x1b\x18b");
        assert_eq!(
            strip(b"a\x1b]0;x\xc2\x9d52;c;Y3VybA==\x07b"),
            b"a\x1b]0;x\x18b"
        );
        assert_eq!(strip(b"a\x1b[1\xc2\x9bcb"), b"a\x1b[1\x18b");
        assert_eq!(strip(b"a\x1bP\xc2\x9d52;c;Y3VybA==\x07b"), b"a\x1bP\x18b");
        assert_eq!(
            strip("a\x1b[1\u{a9}mb".as_bytes()),
            "a\x1b[1\u{a9}mb".as_bytes()
        );
    }

    #[test]
    fn sequences_ended_by_c1_controls_are_followed_by_can() {
        assert_eq!(
            strip(b"a\x1b\xc2\x80]52;c;Y3VybA==\x07b"),
            b"a\x1b\x18\xc2\x80]52;c;Y3VybA==\x07b"
        );
        assert_eq!(strip(b"a\x1b[6\xc2\x80nb"), b"a\x1b[6\x18\xc2\x80nb");
        assert_eq!(
            strip(b"\x1b]10;x\xc2\x80;?\x07"),
            b"\x1b]10;x\x18\xc2\x80;?\x07"
        );
        assert_eq!(
            strip(b"\x1b]0;t\xc2\x9c;?\x07"),
            b"\x1b]0;t\xc2\x9c\x18;?\x07"
        );
    }

    #[test]
    fn matches_queries_as_loosely_as_terminals() {
        assert_eq!(
            strip(b"\x1b[14;2t\x1b[014t\x1b[6:1n\x1b[$p\x1b[?1u\x1b[>$c\x1b[:c\x1bZ"),
            b""
        );
        assert_eq!(
            strip(b"\x1b]10;?;rgb:0/0/0\x07\x1b];52;c;Y3VybA==\x07"),
            b""
        );
        let kept =
            b"\x1b[2 q\x1b[>4n\x1b[>1u\x1b[22;0t\x1b[8;24;80t\x1b]8;;https://nx.dev/?a\x1b\\";
        assert_eq!(strip(kept), kept);
    }

    #[test]
    fn oversized_osc_cannot_become_a_query_later() {
        let osc: Vec<u8> = b"\x1b]10;"
            .iter()
            .copied()
            .chain(std::iter::repeat_n(b'x', MAX_PENDING + 10))
            .collect();

        let mut f = QueryFilter::new();
        assert_eq!(f.feed(&osc).as_ref(), osc.as_slice());
        assert_eq!(f.feed(b";").as_ref(), b";");
        assert_eq!(f.feed(b"?").as_ref(), b"");
        assert_eq!(f.feed(b"\x07b").as_ref(), b"\x18\x07b");

        let mut f = QueryFilter::new();
        assert_eq!(f.feed(&osc).as_ref(), osc.as_slice());
        assert_eq!(f.feed(b"\x1b[c;?\x07").as_ref(), b"\x18;?\x07");
    }

    #[test]
    fn strips_osc_52_with_leading_zeros_and_c1_framing() {
        assert_eq!(strip(b"a\x1b]052;c;Y3VybA==\x07b"), b"ab");
        assert_eq!(strip(b"a\xc2\x9d52;c;Y3VybA==\xc2\x9cb"), b"ab");
        assert_eq!(strip(b"a\xc2\x9bcb"), b"ab");
        assert_eq!(
            strip(b"\x1bPtmux;\x1b\x1b]52;c;Y3VybA==\x07\x1b\\"),
            b"\x1bPtmux;\x1b\x18\x1b\\"
        );
        assert_eq!(strip("\u{a9} 2026".as_bytes()), "\u{a9} 2026".as_bytes());
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
