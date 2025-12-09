use std::time::Instant;
use tracing::trace;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ScrollDirection {
    Up,
    Down,
}

pub struct ScrollMomentum {
    last_scroll_time: Option<Instant>,
    momentum: f32,
    last_direction: Option<ScrollDirection>,
    scroll_count: u32, // Track how many consecutive scrolls in same direction
}

impl ScrollMomentum {
    pub fn new() -> Self {
        Self {
            last_scroll_time: None,
            momentum: 1.0,
            last_direction: None,
            scroll_count: 0,
        }
    }

    /// Calculate scroll momentum based on time between consecutive scrolls
    /// Returns the number of lines to scroll with acceleration
    pub fn calculate_momentum(&mut self, direction: ScrollDirection) -> u8 {
        const MOMENTUM_TIMEOUT_MS: u128 = 200; // Time window for momentum to build
        const ACCELERATION_FACTOR: f32 = 1.2; // Exponential growth factor
        const INITIAL_MOMENTUM: f32 = 1.0;

        // Momentum is based on the time since the last scroll event.
        // NOTE: not linear, exponential steps.
        //               __ <-- Upper max
        //              /
        //             /
        //       _____/     <-- capped at max until user passes sustained scroll threshold.
        //      /           <-- momentum builds over time
        //     /            <-- initial momentum
        const IGNORE_EVENTS_UNDER_MS: u32 = 50; // Ignore events that are too close together
        const SUSTAINED_SCROLL_THRESHOLD: u32 = 2000 / IGNORE_EVENTS_UNDER_MS; // After approx 2s of sustained scrolling

        // Check if direction changed and reset momentum if it did
        if let Some(last_dir) = self.last_direction {
            if last_dir != direction {
                trace!("Direction changed from {:?} to {:?}", last_dir, direction);
                self.momentum = INITIAL_MOMENTUM;
                self.last_scroll_time = None;
                self.scroll_count = 0;
            }
        }
        self.last_direction = Some(direction);

        let now = Instant::now();

        if let Some(last_time) = self.last_scroll_time {
            let elapsed = now.duration_since(last_time).as_millis();

            if elapsed < IGNORE_EVENTS_UNDER_MS as u128 {
                // Ignore events that are too close together
                return 0;
            } else if elapsed < MOMENTUM_TIMEOUT_MS {
                // Accelerate momentum exponentially
                self.momentum *= ACCELERATION_FACTOR;
                self.scroll_count += 1;

                // Dynamic max based on sustained scrolling
                let max_momentum = if self.scroll_count > SUSTAINED_SCROLL_THRESHOLD {
                    // Allow much higher speeds for sustained scrolling (up to 100 lines)
                    100.0
                } else {
                    // Standard max for initial scrolling
                    25.0
                };

                self.momentum = self.momentum.min(max_momentum);

                trace!(
                    "Accelerated momentum: {:.1} (count: {})",
                    self.momentum, self.scroll_count
                );
            } else {
                // Reset momentum if timeout exceeded
                trace!("Resetting scroll momentum due to timeout");
                self.momentum = INITIAL_MOMENTUM;
                self.scroll_count = 0;
            }
        } else {
            // First scroll
            self.momentum = INITIAL_MOMENTUM;
            self.scroll_count = 1;
        }

        self.last_scroll_time = Some(now);
        self.momentum.round() as u8
    }

    /// Reset momentum (e.g., when changing modes or contexts)
    pub fn reset(&mut self) {
        trace!("Resetting scroll momentum");
        self.momentum = 1.0;
        self.last_scroll_time = None;
        self.last_direction = None;
        self.scroll_count = 0;
    }
}

impl Default for ScrollMomentum {
    fn default() -> Self {
        Self::new()
    }
}
