/// A temporary union of dense IDs, with one bit per ID and sorted output.
#[derive(Default)]
pub(super) struct IdSet {
    words: Vec<u64>,
}

impl Extend<u32> for IdSet {
    fn extend<T: IntoIterator<Item = u32>>(&mut self, values: T) {
        for id in values {
            let word = id as usize / 64;
            if word >= self.words.len() {
                self.words.resize(word + 1, 0);
            }
            self.words[word] |= 1u64 << (id % 64);
        }
    }
}

impl FromIterator<u32> for IdSet {
    fn from_iter<T: IntoIterator<Item = u32>>(values: T) -> Self {
        let mut result = Self::default();
        result.extend(values);
        result
    }
}

impl IdSet {
    pub(super) fn contains(&self, id: u32) -> bool {
        self.words
            .get(id as usize / 64)
            .is_some_and(|word| word & (1u64 << (id % 64)) != 0)
    }

    pub(super) fn into_sorted_vec(self) -> Vec<u32> {
        let count = self
            .words
            .iter()
            .map(|word| word.count_ones() as usize)
            .sum();
        let mut result = Vec::with_capacity(count);
        for (word_index, mut word) in self.words.into_iter().enumerate() {
            while word != 0 {
                result.push(word_index as u32 * 64 + word.trailing_zeros());
                word &= word - 1;
            }
        }
        result
    }
}
