---
name: deslop-copy
description: Rules for headings and product copy that read as AI-written. Use when writing or editing landing pages, README intros, UI strings, docs headings, or demo scripts, or when the user says copy sounds like AI or asks to de-slop it.
---

# De-slop copy

Applies to copy a person reads: page and section headings, taglines, README intros, UI strings, demo scripts. When drafting, apply the patterns as you write. When editing, find every match, rewrite it, and keep the meaning.

Specifics come from the code, the docs, or the user. If you lack the fact that would make a line specific, ask for it or cut the line. Never invent a number or a claim.

## Patterns

1. **Eyebrow label.** "PLATFORM" in small caps above "Invoicing". Delete the label. If it carried information, move that into the heading.
2. **Decorative numbering.** "01 Import", "02 Reconcile" on sections a reader can take in any order. Number only steps that must happen in order.
3. **Rhythmic or contrasting pair.** "Hard to describe. Easy to recognize." "Less busywork. More work." Write one sentence that states the fact: "Matches bank lines to invoices and flags the ones it can't."
4. **Metaphor or personification.** "Your invoices, on autopilot." Name the mechanism: "Sends overdue reminders on a schedule you set."
5. **Slogan.** "Built for teams that ship." "Unlock your potential." Replace with what the product does and for whom, or delete.
6. **Vague heading.** "A closer look." "Why it matters." Name what the section contains: "How matching handles partial payments."

## Tests

- **Swap test.** Put a competitor's name in the line. If it is still true, add the fact that makes it false for them, or cut the line.
- **Subject line test.** A heading should work as an email subject: it tells the reader what is underneath before they read it.

## Examples

Before rewriting more than a single line, read `references/examples.md`. It has a full before and after for a landing page section, a README intro, and a demo script. Take the method from the examples and the wording from your own source.

## Done when

Every heading and tagline in scope passes both tests, and no rewrite states something the source did not.
