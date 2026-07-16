use super::components::link::display_width;
use super::scroll_momentum::{ScrollDirection, ScrollMomentum};
use super::utils::normalize_newlines;
use crossterm::event::{KeyCode, KeyEvent};
use parking_lot::{Mutex, RwLock, RwLockReadGuard};
use std::{
    io::{self, Write},
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
};
use tracing::debug;
use vt100_ctt::Parser;
use wrap_ansi::wrap_ansi;

/// A wrapper that provides access to the terminal screen without cloning
///
/// This struct uses a read lock guard internally to maintain the lock on the parser while
/// allowing access to just the screen through deref coercion. This approach avoids the need to
/// clone the entire screen while still providing safe access to it. The guard is kept private
/// to ensure the lock is held for the lifetime of this reference.
///
/// Using Deref allows callers to treat this as if it were a direct reference to Screen.
pub struct PtyScreenRef<'a> {
    _guard: RwLockReadGuard<'a, Parser>,
}

impl std::ops::Deref for PtyScreenRef<'_> {
    type Target = vt100_ctt::Screen;

    fn deref(&self) -> &Self::Target {
        self._guard.screen()
    }
}

/// Shared state for background scrollback processing.
///
/// The background thread tracks its own cursor (`bg_scrollback_cursor`) into the
/// scrollback region and appends newly-discovered lines to `pending_lines`.
/// The render thread drains `pending_lines` each frame and renders them via
/// `insert_before`. This decouples the two timelines so there are no gaps or
/// duplicates even though the live PTY continues to advance.
struct ScrollbackState {
    /// Lines produced by the background thread, waiting for the main thread to render.
    pending_lines: Vec<String>,
    /// Latest known total scrollback row count
    scrollback_count: usize,
    /// Background thread's own cursor: how many scrollback visual rows it has
    /// already extracted. New lines are visual_rows[bg_cursor..scrollback].
    bg_scrollback_cursor: usize,
    /// Whether a background job is currently running
    processing: bool,
    /// Raw output length that the current/last background job was started for
    last_dispatched_raw_len: usize,
    /// Incremental wrapping state
    processed_logical_lines: usize,
    total_visual_rows: usize,
    last_line_visual_rows: usize,
    cols: u16,
}

#[derive(Clone)]
pub struct PtyInstance {
    parser: Arc<RwLock<Parser>>,
    writer: Option<Arc<Mutex<Box<dyn Write + Send>>>>,
    dimensions: Arc<RwLock<(u16, u16)>>,
    scroll_momentum: Arc<Mutex<ScrollMomentum>>,
    /// Generation counter for async resize. Incremented on each resize request
    /// so that stale background resize threads can detect they've been superseded.
    resize_generation: Arc<AtomicU64>,
    /// Last value returned by `output_generation()`. Read every frame while a
    /// pane search is active; using a non-blocking `try_read` plus this cache
    /// keeps the render thread from stalling on the parser write lock (held by
    /// the PTY writer during heavy output, and by the async resize swap).
    output_generation_cache: Arc<AtomicU64>,
    /// Cached result of cursor-movement detection. Flips true on first hit and
    /// stays true — so subsequent arrow key events skip the O(n) buffer scan.
    handles_cursor_movement: Arc<AtomicBool>,
    /// Shared state for background scrollback processing in inline mode
    scrollback_state: Arc<Mutex<ScrollbackState>>,
}

/// Byte index where the `n`th char of `line` begins, or the line's byte length
/// when `n` is past the end. Used to slice a char range for width measurement.
fn char_boundary(line: &str, n: usize) -> usize {
    line.char_indices()
        .nth(n)
        .map(|(byte, _)| byte)
        .unwrap_or(line.len())
}

/// Count how many visual rows a single logical line produces when wrapped.
///
/// Uses a fast path for lines that are definitely short enough to fit in one row
/// (by byte length, which is always >= display width). Only calls wrap_ansi for
/// lines that might actually need wrapping.
fn wrap_logical_line(line: &str, cols: usize) -> usize {
    if cols == 0 || line.is_empty() {
        return 1;
    }
    // Fast path: if the byte length fits, the display width definitely fits too
    // (since each displayed character is at least 1 byte in UTF-8, and ANSI escape
    // sequences add bytes without adding display width)
    if line.len() <= cols {
        return 1;
    }
    let options = wrap_ansi::WrapOptions::builder()
        .hard_wrap(true)
        .trim_whitespace(false)
        .word_wrap(false)
        .build();
    wrap_ansi(line, cols, Some(options)).lines().count()
}

/// Extract only the buffered visual rows needed for rendering.
///
/// The needed region [last_rendered_lines..scrollback_rows] is always near the END
/// of the scrollback (the newest content that just scrolled off the visible screen).
/// We walk backward from the end of the logical lines to find and wrap only the
/// lines that contribute to this region, avoiding O(total) wrapping.
fn extract_buffered_visual_rows(
    logical_lines: &[&str],
    cols: usize,
    screen_rows: usize,
    last_rendered_lines: usize,
    total_visual_rows: usize,
) -> Vec<String> {
    let scrollback_rows = total_visual_rows.saturating_sub(screen_rows);
    if scrollback_rows <= last_rendered_lines {
        return Vec::new();
    }

    let options = wrap_ansi::WrapOptions::builder()
        .hard_wrap(true)
        .trim_whitespace(false)
        .word_wrap(false)
        .build();

    // Walk backward from the end of logical lines. We know total_visual_rows,
    // so we can count backward to find the logical lines that produce the
    // visual rows in our target range. We store (line_visual_start, logical_idx).
    let mut visual_end = total_visual_rows;
    let mut lines_in_range: Vec<(usize, usize)> = Vec::new(); // (visual_start, logical_idx)

    for (i, line) in logical_lines.iter().enumerate().rev() {
        let row_count = wrap_logical_line(line, cols);
        let line_start = visual_end - row_count;

        // If this line's end is before our target region, stop scanning
        if visual_end <= last_rendered_lines {
            break;
        }

        // If this line overlaps the scrollback region, include it
        if line_start < scrollback_rows {
            lines_in_range.push((line_start, i));
        }

        visual_end = line_start;
    }

    // Reverse to chronological order (we walked backward)
    lines_in_range.reverse();

    // Wrap only the identified lines and extract the visual rows we need
    let mut result = Vec::new();
    for &(line_visual_start, idx) in &lines_in_range {
        let line = logical_lines[idx];
        let row_count = wrap_logical_line(line, cols);

        if row_count == 1 {
            // Fast path: single visual row, no wrapping needed
            if line_visual_start >= last_rendered_lines && line_visual_start < scrollback_rows {
                result.push(if line.is_empty() {
                    String::new()
                } else {
                    line.to_string()
                });
            }
        } else {
            let wrapped = wrap_ansi(line, cols, Some(options.clone()));
            for (j, visual_row) in wrapped.lines().enumerate() {
                let abs_pos = line_visual_start + j;
                if abs_pos >= last_rendered_lines && abs_pos < scrollback_rows {
                    result.push(visual_row.to_string());
                }
            }
        }
    }

    result
}

fn split_formatted_into_visual_rows(content: &str, cols: usize) -> Vec<String> {
    if cols == 0 {
        return content.lines().map(|s| s.to_string()).collect();
    }

    // Use wrap-ansi to wrap each logical line while preserving ANSI codes
    // The crate correctly handles escape sequences, Unicode width, and hyperlinks
    let options = wrap_ansi::WrapOptions::builder()
        .hard_wrap(true) // Break long words/sequences at column boundary
        .trim_whitespace(false) // Preserve spacing
        .word_wrap(false) // Don't break at word boundaries - match terminal behavior
        .build();

    content
        .lines()
        .flat_map(|line| {
            if line.is_empty() {
                vec![String::new()]
            } else {
                wrap_ansi(line, cols, Some(options.clone()))
                    .lines()
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
            }
        })
        .collect()
}

impl PtyInstance {
    /// Maximum rows kept in the scrollback buffer. Larger values let the user
    /// scroll further back but make `all_contents_formatted()` (used by inline
    /// scrollback rendering) and resize reparse more expensive. 1000 rows is
    /// roughly 40 screenfuls at a typical 24-row terminal.
    const SCROLLBACK_SIZE: usize = 1000;

    /// Get buffered scrollback content that should be displayed above the current screen.
    ///
    /// All expensive work (all_contents_formatted + wrapping) runs on a background
    /// thread. The background thread tracks its own cursor (`bg_scrollback_cursor`)
    /// and appends newly-discovered scrollback lines to `pending_lines`. This method
    /// drains `pending_lines` each frame — O(1) on the event loop.
    ///
    /// Returns a tuple of `(buffered_lines, total_scrollback_row_count)`.
    pub fn get_buffered_scrollback_content_for_inline(
        &self,
        max_lines: usize,
    ) -> (Vec<String>, usize) {
        // Quick dimension check: skip if async resize is in-flight
        let target = *self.dimensions.read();
        {
            if let Some(guard) = self.parser.try_read() {
                let size = guard.screen().size();
                if size != target {
                    let state = self.scrollback_state.lock();
                    return (Vec::new(), state.scrollback_count);
                }
            } else {
                // Parser is write-locked (resize/output in progress), return cached count
                let state = self.scrollback_state.lock();
                return (Vec::new(), state.scrollback_count);
            }
        };

        // Check raw_len to detect new content (brief read lock)
        let raw_len = self
            .parser
            .try_read()
            .map(|p| p.get_raw_output().len())
            .unwrap_or(0);

        let mut state = self.scrollback_state.lock();

        // If no new content since last dispatch and not processing, just drain pending
        if raw_len == state.last_dispatched_raw_len && !state.processing {
            let drain_count = state.pending_lines.len().min(max_lines);
            let drained: Vec<String> = state.pending_lines.drain(..drain_count).collect();
            return (drained, state.scrollback_count);
        }

        // Dispatch background job if not already running and there's new content
        if !state.processing && raw_len != state.last_dispatched_raw_len {
            state.processing = true;
            state.last_dispatched_raw_len = raw_len;

            // Snapshot incremental wrapping state for the background thread
            let prev_processed = state.processed_logical_lines;
            let prev_total_visual = state.total_visual_rows;
            let prev_last_line_rows = state.last_line_visual_rows;
            let prev_cols = state.cols;
            let bg_cursor = state.bg_scrollback_cursor;

            let parser_arc = self.parser.clone();
            let state_arc = self.scrollback_state.clone();
            let generation_arc = self.resize_generation.clone();
            let generation_at_dispatch = generation_arc.load(Ordering::SeqCst);

            std::thread::spawn(move || {
                // Brief read lock: grab formatted content and dimensions, then release.
                // This keeps the parser available for process_output() so the live
                // PTY stays responsive while we do the expensive wrapping work.
                let (content_string, s_rows, s_cols) = {
                    let parser = parser_arc.read();
                    let screen = parser.screen();
                    let (rows, cols) = screen.size();
                    let all_formatted = screen.all_contents_formatted();
                    let content = String::from_utf8_lossy(&all_formatted).into_owned();
                    (content, rows, cols)
                };
                // Parser lock is released here — process_output() can proceed

                let logical_lines: Vec<&str> = content_string.lines().collect();
                let total_logical = logical_lines.len();

                // Determine if incremental cache is still valid
                let cols_changed = prev_cols != s_cols;
                let cache_valid = !cols_changed && prev_processed <= total_logical;

                let (total_visual, processed, last_line_rows) = if !cache_valid {
                    // Full re-wrap needed (cols changed or logical lines shrank)
                    let visual_rows =
                        split_formatted_into_visual_rows(&content_string, s_cols as usize);
                    let total = visual_rows.len();
                    let last = logical_lines
                        .last()
                        .map(|l| wrap_logical_line(l, s_cols as usize))
                        .unwrap_or(0);
                    (total, total_logical, last)
                } else {
                    // Incremental: only wrap new/changed logical lines
                    let reprocess_from = prev_processed.saturating_sub(1);
                    let new_rows: usize = logical_lines[reprocess_from..]
                        .iter()
                        .map(|line| wrap_logical_line(line, s_cols as usize))
                        .sum();
                    let total = prev_total_visual.saturating_sub(prev_last_line_rows) + new_rows;
                    let last = logical_lines
                        .last()
                        .map(|l| wrap_logical_line(l, s_cols as usize))
                        .unwrap_or(0);
                    (total, total_logical, last)
                };

                let scrollback = total_visual.saturating_sub(s_rows as usize);

                // Determine the effective cursor: if cache was invalidated (cols changed),
                // reset cursor to 0 so we re-extract everything from the beginning.
                let effective_cursor = if !cache_valid { 0 } else { bg_cursor };

                // Extract only the NEW scrollback lines: [effective_cursor..scrollback]
                let new_lines = if scrollback > effective_cursor {
                    extract_buffered_visual_rows(
                        &logical_lines,
                        s_cols as usize,
                        s_rows as usize,
                        effective_cursor,
                        total_visual,
                    )
                } else {
                    Vec::new()
                };

                // Update shared state — but discard if a resize happened while
                // we were processing (the dimensions we wrapped at are stale)
                let mut state = state_arc.lock();
                if generation_arc.load(Ordering::SeqCst) != generation_at_dispatch {
                    state.processing = false;
                    return;
                }
                state.pending_lines.extend(new_lines);
                state.scrollback_count = scrollback;
                state.bg_scrollback_cursor = scrollback;
                state.processing = false;
                state.processed_logical_lines = processed;
                state.total_visual_rows = total_visual;
                state.last_line_visual_rows = last_line_rows;
                state.cols = s_cols;
            });
        }

        // Drain up to max_lines from pending — leave the rest for next frame
        let drain_count = state.pending_lines.len().min(max_lines);
        let drained: Vec<String> = state.pending_lines.drain(..drain_count).collect();
        (drained, state.scrollback_count)
    }

    pub fn interactive(
        parser: Arc<RwLock<Parser>>,
        writer: Arc<Mutex<Box<dyn Write + Send>>>,
    ) -> Self {
        // Read the dimensions from the parser
        let (rows, cols) = parser.read().screen().size();
        Self {
            parser,
            writer: Some(writer),
            dimensions: Arc::new(RwLock::new((rows, cols))),
            scroll_momentum: Arc::new(Mutex::new(ScrollMomentum::new())),
            resize_generation: Arc::new(AtomicU64::new(0)),
            output_generation_cache: Arc::new(AtomicU64::new(0)),
            handles_cursor_movement: Arc::new(AtomicBool::new(false)),
            scrollback_state: Arc::new(Mutex::new(ScrollbackState {
                pending_lines: Vec::new(),
                scrollback_count: 0,
                bg_scrollback_cursor: 0,
                processing: false,
                last_dispatched_raw_len: 0,
                processed_logical_lines: 0,
                total_visual_rows: 0,
                last_line_visual_rows: 0,
                cols: 0,
            })),
        }
    }

    pub fn non_interactive() -> Self {
        // Use sane defaults for rows, cols and scrollback buffer size. The dimensions will be adjusted dynamically later.
        let rows = 24;
        let cols = 80;
        let parser = Arc::new(RwLock::new(Parser::new(rows, cols, Self::SCROLLBACK_SIZE)));
        Self {
            parser,
            writer: None,
            dimensions: Arc::new(RwLock::new((rows, cols))),
            scroll_momentum: Arc::new(Mutex::new(ScrollMomentum::new())),
            resize_generation: Arc::new(AtomicU64::new(0)),
            output_generation_cache: Arc::new(AtomicU64::new(0)),
            handles_cursor_movement: Arc::new(AtomicBool::new(false)),
            scrollback_state: Arc::new(Mutex::new(ScrollbackState {
                pending_lines: Vec::new(),
                scrollback_count: 0,
                bg_scrollback_cursor: 0,
                processing: false,
                last_dispatched_raw_len: 0,
                processed_logical_lines: 0,
                total_visual_rows: 0,
                last_line_visual_rows: 0,
                cols: 0,
            })),
        }
    }

    pub fn non_interactive_with_dimensions(rows: u16, cols: u16) -> Self {
        let parser = Arc::new(RwLock::new(Parser::new(rows, cols, Self::SCROLLBACK_SIZE)));
        Self {
            parser,
            writer: None,
            dimensions: Arc::new(RwLock::new((rows, cols))),
            scroll_momentum: Arc::new(Mutex::new(ScrollMomentum::new())),
            resize_generation: Arc::new(AtomicU64::new(0)),
            output_generation_cache: Arc::new(AtomicU64::new(0)),
            handles_cursor_movement: Arc::new(AtomicBool::new(false)),
            scrollback_state: Arc::new(Mutex::new(ScrollbackState {
                pending_lines: Vec::new(),
                scrollback_count: 0,
                bg_scrollback_cursor: 0,
                processing: false,
                last_dispatched_raw_len: 0,
                processed_logical_lines: 0,
                total_visual_rows: 0,
                last_line_visual_rows: 0,
                cols: 0,
            })),
        }
    }

    pub fn can_be_interactive(&self) -> bool {
        self.writer.is_some()
    }

    /// Returns true if an async resize is in-flight (target dimensions differ from
    /// the parser's actual dimensions). Callers can use this to skip work that
    /// depends on correct dimensions until the background resize completes.
    pub fn is_resize_pending(&self) -> bool {
        let target = *self.dimensions.read();
        if let Some(guard) = self.parser.try_read() {
            let actual = guard.screen().size();
            actual != target
        } else {
            // Parser is write-locked (resize swap in progress)
            true
        }
    }

    pub fn resize(&mut self, rows: u16, cols: u16) -> io::Result<()> {
        // Ensure minimum sizes
        let rows = rows.max(3);
        let cols = cols.max(20);

        // Check dimensions and get old values in a single lock scope
        let (should_resize, old_rows, old_scrollback) = {
            let dimensions_guard = self.dimensions.read();
            let current_dimensions = *dimensions_guard;

            // Skip resize if dimensions haven't changed
            if rows == current_dimensions.0 && cols == current_dimensions.1 {
                return Ok(());
            }

            let old_scrollback = self.parser.read().screen().scrollback();

            (true, current_dimensions.0, old_scrollback)
        };

        if !should_resize {
            return Ok(());
        }

        // Update dimensions
        let mut dimensions_guard = self.dimensions.write();
        *dimensions_guard = (rows, cols);

        // Create a new parser with the new dimensions while preserving state
        {
            let mut parser_guard = self.parser.write();
            let raw_output = parser_guard.get_raw_output().to_vec();

            // Create new parser with new dimensions
            let mut new_parser = Parser::new(rows, cols, Self::SCROLLBACK_SIZE);
            new_parser.process(&raw_output);

            // Preserve scroll position when possible
            // Calculate target scroll position based on dimension changes
            let target_scrollback = if rows < old_rows {
                // If we lost height and were scrolled up, adjust scroll position
                if old_scrollback > 0 {
                    old_scrollback.saturating_sub((old_rows - rows) as usize)
                } else {
                    0 // Keep at bottom
                }
            } else {
                // If we gained height or stayed the same, preserve exact scroll position
                old_scrollback
            };

            // Set target scroll position before processing
            new_parser.screen_mut().set_scrollback(target_scrollback);

            *parser_guard = new_parser;
        }

        Ok(())
    }

    /// Resize the PTY asynchronously to avoid blocking the event loop.
    ///
    /// The expensive work (copying all raw terminal output and reprocessing it through
    /// a new vt100 parser at the new dimensions) happens on a background thread with
    /// no locks held. Rendering continues using the current parser during the resize.
    ///
    /// A generation counter ensures that if multiple resizes are requested in quick
    /// succession (e.g., during window resize), only the latest one completes the swap.
    ///
    /// The swap itself is fast: take a brief write lock, replay any output that arrived
    /// during the background reparse, and replace the parser.
    pub fn resize_async(&self, rows: u16, cols: u16) {
        let rows = rows.max(3);
        let cols = cols.max(20);

        // Quick check: skip if dimensions haven't changed
        {
            let current = self.dimensions.read();
            if rows == current.0 && cols == current.1 {
                return;
            }
        }

        // Increment generation to cancel any in-flight resize
        let generation = self.resize_generation.fetch_add(1, Ordering::SeqCst) + 1;

        // Update dimensions immediately so subsequent resize calls see the new
        // target and early-return instead of spawning redundant threads
        *self.dimensions.write() = (rows, cols);

        // Clone Arcs for the background thread
        let parser_arc = self.parser.clone();
        let generation_arc = self.resize_generation.clone();

        std::thread::spawn(move || {
            // Snapshot raw output under a read lock, then release.
            // The O(n) copy + reparse happen here on the background thread,
            // keeping the event loop free.
            let (snapshot, old_rows, old_scrollback) = {
                let parser = parser_arc.read();
                let raw = parser.get_raw_output().to_vec();
                let scrollback = parser.screen().scrollback();
                let (r, _) = parser.screen().size();
                (raw, r, scrollback)
            };
            let snapshot_len = snapshot.len();

            // Check if this resize has been superseded before doing expensive work
            if generation_arc.load(Ordering::SeqCst) != generation {
                return;
            }

            // Expensive work: create new parser and reparse all output (no locks held!)
            let mut new_parser = Parser::new(rows, cols, Self::SCROLLBACK_SIZE);
            new_parser.process(&snapshot);

            // Preserve scroll position
            let target_scrollback = if rows < old_rows {
                if old_scrollback > 0 {
                    old_scrollback.saturating_sub((old_rows - rows) as usize)
                } else {
                    0
                }
            } else {
                old_scrollback
            };
            new_parser.screen_mut().set_scrollback(target_scrollback);

            // Check if this resize has been superseded by a newer one
            if generation_arc.load(Ordering::SeqCst) != generation {
                return;
            }

            // Quick: take write lock, replay any new output that arrived during
            // the background reparse, then swap the parser
            let mut parser_guard = parser_arc.write();

            // Double-check generation under the lock
            if generation_arc.load(Ordering::SeqCst) != generation {
                return;
            }

            let current_raw = parser_guard.get_raw_output();
            if current_raw.len() > snapshot_len {
                new_parser.process(&current_raw[snapshot_len..]);
            }

            *parser_guard = new_parser;
        });
    }

    pub fn write_input(&mut self, input: &[u8]) -> io::Result<()> {
        if let Some(writer) = &self.writer {
            let mut writer_guard = writer.lock();
            debug!("Writing input: {:?}", input);
            writer_guard.write_all(input)?;
            writer_guard.flush()?;
        } else {
            debug!("Swallowing input: {:?}", input);
        }

        Ok(())
    }

    pub fn get_dimensions(&self) -> (u16, u16) {
        *self.dimensions.read()
    }

    pub fn handle_arrow_keys(&mut self, event: KeyEvent) {
        let handles_arrow_keys = self.handles_arrow_keys();
        debug!(
            "Handling arrow keys: {:?}, Interactive: {}",
            event, handles_arrow_keys
        );

        if handles_arrow_keys {
            // Interactive program (enquirer, vim, git log, etc.) - send keys to program
            match event.code {
                KeyCode::Up => {
                    self.write_input(b"\x1b[A").ok();
                }
                KeyCode::Down => {
                    self.write_input(b"\x1b[B").ok();
                }
                _ => {}
            }
        } else {
            // Non-interactive program - handle scrolling ourselves
            match event.code {
                KeyCode::Up => {
                    let amount = self
                        .scroll_momentum
                        .lock()
                        .calculate_momentum(ScrollDirection::Up);
                    self.scroll_up(amount);
                }
                KeyCode::Down => {
                    let amount = self
                        .scroll_momentum
                        .lock()
                        .calculate_momentum(ScrollDirection::Down);
                    self.scroll_down(amount);
                }
                _ => {}
            }
        }
    }

    /// Get the terminal screen for rendering.
    /// Uses try_read() to avoid blocking - if the lock is contended,
    /// returns None and the frame can be skipped.
    pub fn get_screen(&'_ self) -> Option<PtyScreenRef<'_>> {
        self.parser
            .try_read()
            .map(|guard| PtyScreenRef { _guard: guard })
    }

    pub fn scroll_up(&mut self, amount: u8) {
        let mut parser = self.parser.write();
        let current = parser.screen().scrollback();
        parser
            .screen_mut()
            .set_scrollback(current + amount as usize);
    }

    pub fn scroll_down(&mut self, amount: u8) {
        let mut parser = self.parser.write();
        let current = parser.screen().scrollback();
        if current > 0 {
            parser
                .screen_mut()
                .set_scrollback(current.saturating_sub(amount as usize));
        }
    }

    pub fn scroll_to_top(&mut self) {
        let mut parser = self.parser.write();
        let screen = parser.screen();
        let total_content = screen.get_total_content_rows();
        let viewport_height = screen.size().0 as usize;
        let max_scrollback = total_content.saturating_sub(viewport_height);
        parser.screen_mut().set_scrollback(max_scrollback);
    }

    pub fn scroll_to_bottom(&mut self) {
        self.parser.write().screen_mut().set_scrollback(0);
    }

    pub fn get_scroll_offset(&self) -> usize {
        self.parser.read().screen().scrollback()
    }

    pub fn get_total_content_rows(&self) -> usize {
        self.parser.read().screen().get_total_content_rows()
    }

    /// A version key for the terminal content and its wrapping, cheap to read.
    ///
    /// Derived from the parser itself so it works no matter how the parser is
    /// fed: the raw-output length changes on every write — both `process_output`
    /// *and* a live task's PTY reader writing the shared parser directly (which
    /// bypasses `process_output` entirely) — and, unlike a content-row count,
    /// never saturates once the scrollback fills. It is not monotonic: the
    /// `MAX_RAW_OUTPUT_BYTES` compaction *shrinks* it, which still reads as a
    /// change (a post-compaction length coinciding with a previously-seen one
    /// would skip one refresh and self-heal on the next write). Folding in the
    /// screen dimensions makes a resize rewrap (same bytes, shifted rows)
    /// register as a change too. A cache keyed on this — the pane search's
    /// match list — recomputes exactly when the screen changed.
    pub fn output_generation(&self) -> u64 {
        // Non-blocking: this runs every frame while a search is active, so it
        // must never wait on the parser write lock (held by the PTY writer
        // during heavy output and by the async resize swap) — that would stall
        // the repaint. When the lock is momentarily unavailable, reuse the last
        // value; the next frame picks up any change.
        let Some(parser) = self.parser.try_read() else {
            return self.output_generation_cache.load(Ordering::Relaxed);
        };
        let raw_len = parser.get_raw_output().len() as u64;
        let (rows, cols) = parser.screen().size();
        let generation = raw_len
            .wrapping_mul(0x9E37_79B1)
            .wrapping_add(((rows as u64) << 16) | cols as u64);
        self.output_generation_cache
            .store(generation, Ordering::Relaxed);
        generation
    }

    /// The absolute visual row currently at the top of the viewport — the same
    /// coordinate basis as `content_coords_at` and `search_visual_positions`.
    pub fn visual_top(&self) -> usize {
        let parser = self.parser.read();
        let screen = parser.screen();
        let total = screen.get_total_content_rows();
        let viewport = screen.size().0 as usize;
        total
            .saturating_sub(viewport)
            .saturating_sub(screen.scrollback())
    }

    /// Force the cached dimensions out of sync with the parser's real width,
    /// reproducing the window during `resize_async` where `dimensions` has been
    /// updated but the parser has not yet been reparsed at the new size.
    #[cfg(test)]
    pub(crate) fn set_cached_dimensions_for_test(&self, rows: u16, cols: u16) {
        *self.dimensions.write() = (rows, cols);
    }

    /// Scroll so the given absolute visual row sits about a third from the
    /// viewport top (bringing some context above the match into view).
    pub fn scroll_to_visual_row(&mut self, row: usize) {
        let mut parser = self.parser.write();
        let screen = parser.screen();
        let total = screen.get_total_content_rows();
        let viewport = screen.size().0 as usize;
        let max_scrollback = total.saturating_sub(viewport);
        let desired_top = row.saturating_sub(viewport / 3);
        let scrollback = total
            .saturating_sub(viewport)
            .saturating_sub(desired_top)
            .min(max_scrollback);
        parser.screen_mut().set_scrollback(scrollback);
    }

    /// Case-insensitively find every occurrence of `query` in the terminal
    /// content (scrollback included). Positions are returned in the wrapped
    /// visual coordinate basis shared with `content_coords_at`, as
    /// `(visual_row, col, col_width)` — the third element is the match's width
    /// in display columns, not a character count — in reading order. Each grid
    /// row is searched independently, so a query straddling a wrap seam (e.g.
    /// `error` split as `err`/`or` across two visual rows of a long wrapped
    /// line) is not matched — a deliberate trade for grid-exact positions.
    pub fn search_visual_positions(&self, query: &str) -> Vec<(usize, usize, usize)> {
        if query.is_empty() {
            return Vec::new();
        }
        // Reconstruct the exact grid the pane renders, then search it row by
        // row. Re-parsing `all_contents_formatted()` into a parser tall enough
        // to hold every row in its visible screen (zero scrollback) gives the
        // SAME visual-row layout as `get_total_content_rows()` and the render.
        //
        // The previous approach re-wrapped `all_contents()` with wrap_ansi, but
        // that diverges from the real grid: `all_contents()` trims trailing
        // blanks from wrapped rows (left behind by `\r`/clear-to-end progress
        // output), so re-wrapping the joined logical line produces fewer rows
        // than vt100 actually used. On long, narrow, cursor-heavy output
        // (e.g. a Maven build past the scrollback cap) the error accumulated and
        // every highlight drifted downward.
        let (formatted, cols, total) = {
            let parser = self.parser.read();
            let screen = parser.screen();
            (
                screen.all_contents_formatted(),
                screen.size().1,
                screen.get_total_content_rows(),
            )
        };
        if cols == 0 || total == 0 {
            return Vec::new();
        }
        let mut grid = Parser::new(total.min(u16::MAX as usize) as u16, cols, 0);
        grid.process(&formatted);

        let needle = query.to_lowercase();
        let needle_chars = needle.chars().count();
        let mut matches = Vec::new();
        for (row, line) in grid.screen().rows(0, cols).enumerate() {
            let haystack = line.to_lowercase();
            let mut from = 0usize;
            while let Some(found) = haystack[from..].find(&needle) {
                let byte = from + found;
                // Locate by char offset in the lowercased row, then measure the
                // prefix in display *columns* so wide characters (CJK, emoji)
                // don't shift the highlight — the overlay walks the buffer in
                // columns. (Lowercasing is assumed char-count-preserving.)
                let char_offset = haystack[..byte].chars().count();
                let start_byte = char_boundary(&line, char_offset);
                let end_byte = char_boundary(&line, char_offset + needle_chars);
                let col = display_width(&line[..start_byte]);
                let match_cols = display_width(&line[start_byte..end_byte]).max(1);
                matches.push((row, col, match_cols));
                from = byte + needle.len().max(1);
            }
        }
        matches
    }

    /// Extract the plain text covered by a selection expressed in absolute
    /// content-row + column coordinates (both ends inclusive).
    ///
    /// The selection arrives in *visual* (wrapped) row coordinates — the basis
    /// `content_coords_at`, the overlay, and `get_total_content_rows()` share.
    /// The buffer is read once as unwrapped logical lines with
    /// `Screen::all_contents` (scrollback included, no scrolling). Each visual
    /// endpoint is translated to a character offset inside its logical line by
    /// counting how many visual rows the preceding lines occupy, then the
    /// unwrapped lines are sliced directly between the two offsets. This yields
    /// unwrapped text without ever materializing the wrapped rows, and a
    /// newline appears only at real line breaks. Trailing whitespace is trimmed
    /// per line.
    pub fn selected_text(&self, start: (usize, usize), end: (usize, usize)) -> String {
        let (start_row, start_col) = start;
        let (end_row, end_col) = end;

        let (contents, cols) = {
            let parser = self.parser.read();
            let screen = parser.screen();
            let (_, cols) = screen.size();
            (screen.all_contents(), cols as usize)
        };
        if cols == 0 {
            return String::new();
        }
        let logical: Vec<&str> = contents.lines().collect();

        // Translate an absolute visual row to a position in the unwrapped lines:
        // the logical line it falls on, plus the character offset where that
        // visual sub-row begins (`sub_row * cols`, since the terminal hard-wraps
        // at the column count). `None` once the row is past the wrapped content
        // (the viewport's trailing empty rows, trimmed from `all_contents`).
        let locate = |visual_row: usize| -> Option<(usize, usize)> {
            let mut consumed = 0usize;
            for (index, line) in logical.iter().enumerate() {
                let height = wrap_logical_line(line, cols);
                if visual_row < consumed + height {
                    return Some((index, (visual_row - consumed) * cols));
                }
                consumed += height;
            }
            None
        };

        // A selection that starts past the content selects nothing.
        let Some((start_line, start_base)) = locate(start_row) else {
            return String::new();
        };
        let start_offset = start_base + start_col;
        // An end dragged into the empty rows below the content selects through
        // the end of the last logical line.
        let (end_line, end_offset) = match locate(end_row) {
            Some((line, base)) => (line, base + end_col + 1),
            None => {
                let last = logical.len().saturating_sub(1);
                (
                    last,
                    logical.get(last).map_or(0, |line| line.chars().count()),
                )
            }
        };
        if end_line < start_line {
            return String::new();
        }

        let mut lines: Vec<String> = Vec::new();
        for (offset, line) in logical[start_line..=end_line].iter().enumerate() {
            let line_index = start_line + offset;
            let chars: Vec<char> = line.chars().collect();
            let len = chars.len();
            let (from, to) = if start_line == end_line {
                (start_offset.min(len), end_offset.min(len))
            } else if line_index == start_line {
                (start_offset.min(len), len)
            } else if line_index == end_line {
                (0, end_offset.min(len))
            } else {
                (0, len)
            };
            let slice: String = chars[from..to.max(from)].iter().collect();
            lines.push(slice.trim_end().to_string());
        }
        // Drop blank lines dragged past the end of the content so the copy
        // doesn't gain trailing newlines.
        while lines.last().is_some_and(|line| line.is_empty()) {
            lines.pop();
        }
        lines.join("\n")
    }

    /// Checks if the process is likely in interactive/raw mode
    /// Uses both alternate screen detection and cursor movement patterns
    pub fn handles_arrow_keys(&self) -> bool {
        let parser = self.parser.read();
        let screen = parser.screen();

        // Strong indicator: alternate screen mode (vim, less, git log, htop)
        if screen.alternate_screen() {
            return true;
        }

        // Check if recent output contains cursor movement sequences
        drop(parser); // Release lock before calling has_cursor_movement_in_output
        self.has_cursor_movement_in_output()
    }

    /// Simple check: does the recent output contain cursor movement escape sequences?
    /// This catches enquirer-style programs that move cursor but don't use alternate screen.
    /// Result is cached — once true it never reverts, so subsequent calls skip the O(n) scan.
    fn has_cursor_movement_in_output(&self) -> bool {
        if self.handles_cursor_movement.load(Ordering::Relaxed) {
            return true;
        }

        let parser = self.parser.read();
        let raw_output = parser.get_raw_output();
        let output_str = std::str::from_utf8(raw_output).unwrap_or("");

        // Check for any cursor control sequences in one pass
        let found = [
            "\x1b[?25l",
            "\x1b[?25h",
            "\x1b[H",
            "\x1b[A",
            "\x1b[B",
            "\x1b[C",
            "\x1b[D",
        ]
        .iter()
        .any(|seq| output_str.contains(seq));

        if found {
            self.handles_cursor_movement.store(true, Ordering::Relaxed);
        }
        found
    }

    /// Maximum raw output bytes to retain. The raw output buffer stores every
    /// byte ever processed (needed for resize reparse). Beyond this limit we
    /// clear it to prevent unbounded memory growth and realloc pauses.
    /// Resize after a clear loses historical content but keeps the live viewport.
    const MAX_RAW_OUTPUT_BYTES: usize = 5 * 1024 * 1024; // 5 MB

    /// Process output with an existing parser.
    ///
    /// When the raw output buffer exceeds `MAX_RAW_OUTPUT_BYTES`, we compact
    /// the parser: create a fresh one at the same dimensions, replay just the
    /// formatted screen state (scrollback + visible), and swap. This keeps
    /// raw_output small enough for resize to work without unbounded growth.
    pub fn process_output(&self, output: &[u8]) {
        let normalized = normalize_newlines(output);
        let mut parser = self.parser.write();
        parser.process(&normalized);
        if parser.get_raw_output().len() > Self::MAX_RAW_OUTPUT_BYTES {
            let screen = parser.screen();
            let (rows, cols) = screen.size();
            let formatted = screen.all_contents_formatted();
            let scrollback = screen.scrollback();
            let mut compacted = Parser::new(rows, cols, Self::SCROLLBACK_SIZE);
            compacted.process(&formatted);
            compacted.screen_mut().set_scrollback(scrollback);
            *parser = compacted;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn create_test_pty_instance(alternate_screen: bool) -> PtyInstance {
        let parser = Arc::new(RwLock::new(Parser::new(24, 80, 1000)));

        // Set alternate screen mode if requested
        if alternate_screen {
            parser.write().process(b"\x1b[?1049h");
        }

        PtyInstance {
            parser,
            writer: None,
            dimensions: Arc::new(RwLock::new((24, 80))),
            scroll_momentum: Arc::new(Mutex::new(ScrollMomentum::new())),
            resize_generation: Arc::new(AtomicU64::new(0)),
            output_generation_cache: Arc::new(AtomicU64::new(0)),
            handles_cursor_movement: Arc::new(AtomicBool::new(false)),
            scrollback_state: Arc::new(Mutex::new(ScrollbackState {
                pending_lines: Vec::new(),
                scrollback_count: 0,
                bg_scrollback_cursor: 0,
                processing: false,
                last_dispatched_raw_len: 0,
                processed_logical_lines: 0,
                total_visual_rows: 0,
                last_line_visual_rows: 0,
                cols: 0,
            })),
        }
    }

    #[test]
    fn test_handles_arrow_keys_initially_false() {
        let pty = create_test_pty_instance(false);
        assert!(
            !pty.handles_arrow_keys(),
            "Should initially not be interactive"
        );
    }

    #[test]
    fn test_handles_arrow_keys_alternate_screen() {
        let pty = create_test_pty_instance(true);
        assert!(
            pty.handles_arrow_keys(),
            "Should detect alternate screen as interactive"
        );
    }

    #[test]
    fn test_handles_arrow_keys_cursor_movement() {
        let pty = create_test_pty_instance(false);

        // Initially should not be interactive
        assert!(!pty.handles_arrow_keys());

        // Process output with cursor hide sequence (enquirer-style)
        pty.process_output(b"\x1b[?25l");
        assert!(
            pty.handles_arrow_keys(),
            "Should detect cursor hide as interactive"
        );
    }

    #[test]
    fn test_selected_text_single_and_multi_row() {
        let pty = PtyInstance::non_interactive();
        pty.process_output(b"line one\r\nline two\r\nline three\r\n");

        // Single row, partial columns.
        assert_eq!(pty.selected_text((0, 0), (0, 3)), "line");
        // Whole second row (trailing whitespace trimmed).
        assert_eq!(pty.selected_text((1, 0), (1, 20)), "line two");
        // Spanning two rows: tail of row 0 + head of row 1.
        assert_eq!(pty.selected_text((0, 5), (1, 3)), "one\nline");
    }

    #[test]
    fn test_selected_text_out_of_range_is_empty() {
        let pty = PtyInstance::non_interactive();
        pty.process_output(b"hello\r\n");
        // A start row past the content yields nothing rather than panicking.
        assert_eq!(pty.selected_text((9999, 0), (9999, 5)), "");
    }

    #[test]
    fn test_selected_text_joins_wrapped_rows_unwrapped() {
        let pty = PtyInstance::non_interactive();
        // 100 chars at 80 cols wraps onto two visual rows (0: 80, 1: 20).
        let long = "a".repeat(100);
        pty.process_output(format!("{long}\r\n").as_bytes());

        // Selecting across both visual rows yields the original unwrapped line
        // with no newline injected at the wrap point.
        assert_eq!(pty.selected_text((0, 0), (1, 19)), long);
        assert!(!pty.selected_text((0, 0), (1, 19)).contains('\n'));
    }

    #[test]
    fn test_selected_text_partial_span_across_wrap_boundary() {
        let pty = PtyInstance::non_interactive();
        // A 100-char line of repeating digits so each column maps to a known
        // character: index i holds the digit (i % 10).
        let line: String = (0..100)
            .map(|i| char::from(b'0' + (i % 10) as u8))
            .collect();
        pty.process_output(format!("{line}\r\n").as_bytes());

        // Select from visual row 0 col 75 through visual row 1 col 4. The wrap
        // is at column 80, so this is character offsets 75..=84 of the unwrapped
        // line — the slice must cross the wrap point with the right columns.
        assert_eq!(pty.selected_text((0, 75), (1, 4)), "5678901234");
    }

    #[test]
    fn test_selected_text_trailing_empty_rows_dont_shift_columns() {
        let pty = PtyInstance::non_interactive();
        pty.process_output(b"alpha\r\nbravo\r\n");

        // Dragging the selection end down into the empty rows below the content
        // must not pull the end column up onto "bravo" (the previous bug, where
        // the trimmed re-wrapped array clamped end_row and truncated the line).
        assert_eq!(pty.selected_text((0, 0), (5, 3)), "alpha\nbravo");
    }

    #[test]
    fn test_selected_text_includes_scrollback_rows() {
        let pty = PtyInstance::non_interactive();
        // 24-row viewport: writing 30 lines pushes the first 6 into scrollback.
        for i in 0..30 {
            pty.process_output(format!("line {i}\r\n").as_bytes());
        }
        // Absolute row 0 is the oldest scrollback row, lining up with the
        // coordinates `content_coords_at` produces.
        assert_eq!(pty.selected_text((0, 0), (0, 5)), "line 0");
        assert_eq!(pty.selected_text((2, 0), (2, 5)), "line 2");
    }

    #[test]
    fn test_handles_arrow_keys_enquirer_style_output() {
        let pty = create_test_pty_instance(false);

        // Simulate enquirer output with cursor positioning
        let enquirer_output =
            b"? Select option \x1b[?25l\x1b[1;1H> Option 1\x1b[2;1H  Option 2\x1b[?25h";
        pty.process_output(enquirer_output);

        assert!(
            pty.handles_arrow_keys(),
            "Should detect enquirer-style cursor manipulation"
        );
    }

    #[test]
    fn search_finds_case_insensitive_matches_in_visual_coordinates() {
        let pty = create_test_pty_instance(false);
        pty.parser
            .write()
            .process(b"first Error here\r\nnothing\r\nlast ERROR\r\n");

        let matches = pty.search_visual_positions("error");
        assert_eq!(matches, vec![(0, 6, 5), (2, 5, 5)]);

        // Wrapped lines report positions past the first visual row.
        let long_line = format!("{}error\r\n", "x".repeat(80));
        pty.parser.write().process(long_line.as_bytes());
        let matches = pty.search_visual_positions("error");
        assert_eq!(matches.last(), Some(&(4, 0, 5)));

        assert!(pty.search_visual_positions("").is_empty());
        assert!(pty.search_visual_positions("absent").is_empty());
    }

    /// The output generation must keep changing after the scrollback fills,
    /// even though the content-row count saturates. This is what lets a cache
    /// keyed on the generation (the pane search) detect that content is still
    /// shifting once past `SCROLLBACK_SIZE`.
    #[test]
    fn output_generation_changes_after_content_row_count_saturates() {
        let pty = create_test_pty_instance(false);
        // Fill well past SCROLLBACK_SIZE (1000).
        pty.process_output("line\r\n".repeat(1200).as_bytes());
        let rows_a = pty.get_total_content_rows();
        let gen_a = pty.output_generation();

        pty.process_output("more\r\n".repeat(200).as_bytes());
        let rows_b = pty.get_total_content_rows();
        let gen_b = pty.output_generation();

        assert_eq!(
            rows_a, rows_b,
            "the content-row count saturates and stops signalling change"
        );
        assert_ne!(
            gen_a, gen_b,
            "the output generation still changes after saturation"
        );
    }

    /// A live task's PTY reader writes the shared parser directly, bypassing
    /// `process_output`. The generation must still change, or a pane search
    /// over a streaming task would freeze (stale count and highlights).
    #[test]
    fn output_generation_changes_when_the_parser_is_fed_directly() {
        let pty = create_test_pty_instance(false);
        let gen_a = pty.output_generation();
        pty.parser.write().process(b"streamed output line\r\n");
        let gen_b = pty.output_generation();
        assert_ne!(
            gen_a, gen_b,
            "generation must change on a direct parser write (the live PTY path)"
        );
    }

    #[test]
    fn search_positions_are_display_columns_not_char_counts() {
        let pty = create_test_pty_instance(false);
        // Two double-width CJK chars precede the match. In char counts the
        // match would start at column 2; in display columns it starts at 4,
        // which is what the (column-walking) highlight overlay needs.
        pty.parser.write().process("你好error\r\n".as_bytes());

        let matches = pty.search_visual_positions("error");
        assert_eq!(matches, vec![(0, 4, 5)]);
    }

    #[test]
    fn scroll_to_visual_row_brings_the_row_into_view() {
        let mut pty = create_test_pty_instance(false);
        for i in 0..100 {
            pty.parser
                .write()
                .process(format!("line {}\r\n", i).as_bytes());
        }

        pty.scroll_to_visual_row(10);
        let top = pty.visual_top();
        assert!(top <= 10, "row 10 must be at or below the top, top={top}");
        assert!(top + 24 > 10, "row 10 must be within the 24-row viewport");

        // Jumping to the very end clamps to the bottom.
        pty.scroll_to_visual_row(10_000);
        assert_eq!(pty.get_scroll_offset(), 0);
    }
}
