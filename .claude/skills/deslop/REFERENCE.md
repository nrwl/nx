# The tells a scanner cannot see

The scanner clears the lexical layer. These are the ones readers actually name, and every one of them
is invisible to a regex. Read the draft against this list before you call it done, and read it aloud
if you can.

## Uniform rhythm

The single most-cited structural tell. Machine prose settles into one sentence length and stays
there, usually medium. Vary length on purpose. Let one run long and the next stop short.

The over-corrected version is just as legible: all-short sentences, fragments stacked for effect.
Evenness is the tell, whichever length it settles on.

Check a batch, not just a document. Forty PR comments that all open `@X to review, <reason>. CI is
green.` are uniform in a way no single reader sees but every maintainer scrolling the queue does. Let
the routing sit in different places, and let some lead with state and others with the ask.

## Sycophancy

"Great question." "Thanks for the excellent report." "You're absolutely right." Praise that costs
nothing and tells the reader nothing. Thank someone once, for a specific thing they did, or not at
all.

The version that hides better: agreeing with a premise you have not checked. If a bug report asserts
a cause, do not repeat the cause back as fact unless you verified it. Say what you ran.

## The rule of three

Three parallel items, three adjectives, three clauses, over and over. It is the model's default
cadence and it survives every word-level fix. Two is usually enough. Four is fine. The tell is that
it is always three.

## Fluent and empty

A paragraph that reads well and asserts nothing. Usually a restatement of the title, or a summary of
what the reader just read. If you cannot state what a paragraph claims, cut it.

This is why "every record needs a comment" is not satisfied by a comment that says nothing. The test
is whether the reader learns something they did not already have.

## Antithesis cadence

"It's not just X, it's Y." "This isn't about X. It's about Y." A rhetorical shape that sounds like
insight and carries none. Say the thing directly.

## Structural scaffolding

The intro / three body paragraphs / conclusion skeleton on something that is four sentences long. A
bulleted list where two sentences would do. A summary at the end of a short piece. Structure should
follow the argument, not a template.

Most short pieces need no recap. If the reader can see the whole thing at once, do not summarize it
for them.

## Hedging everything

"It may potentially be possible that this could cause issues in some cases." Say what you know, say
what you do not, and mark the difference plainly. "I did not run this" is more useful than three
layers of maybe.

The inverse is worse: asserting something you did not check because a confident sentence reads
better. If triage did not reproduce it, the comment says so.

## Over-explaining the obvious

Defining terms the reader already knows, or narrating what you are about to do before doing it.
Assume a competent reader. In this repo that assumption is safe.

## The over-corrected register

Its own catalog entry, because it is the most common way to fail a de-slop pass. Fragments for
effect. Forced lowercase. A "here's the thing" or "look" cold open. A swear dropped in to seem
casual. Deliberate typos to beat a detector.

People clock this as fast as they clock the smooth version. It is a costume, not a voice. The target
is the sentence a person would actually type in that context, which for a PR comment is plain,
direct and unremarkable.
