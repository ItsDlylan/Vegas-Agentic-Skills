# Worked examples

One before and after per surface. Each lists the facts the source held, because the rewrite may use only those. The three products are invented and unrelated on purpose.

## Landing page section

Facts in the source: the app pairs a bank line with an open invoice by amount, date, and reference. Unpaired lines go to a review queue. A payment below the invoice total stays attached, and the invoice remains open for the difference. The source says nothing about who the customers are.

Before:

```
THE PLATFORM
01
Reconciliation, reimagined.
Less chasing. More closing. Your books, on autopilot.

Why it matters
Built for finance teams that move fast.
```

After:

```
Match bank lines to invoices
The app pairs each bank line with an open invoice by amount, date, and reference. Lines it cannot pair go to a review queue.

How partial payments are handled
A payment below the invoice total stays attached to the invoice, which remains open for the difference.
```

What changed:

- The eyebrow label and the "01" are gone. The sections can be read in any order.
- "Reimagined", the contrasting pair, and "on autopilot" became the matching rule and the review queue.
- "Why it matters" became the name of what the section explains.
- "Built for finance teams that move fast" was cut, not rewritten. It fails the swap test, and the source has no fact about customers to replace it with.

## README intro

Facts in the source: the tool applies SQL migrations to Postgres 13 and later. Each migration runs in a transaction. It refuses a migration that would take an `ACCESS EXCLUSIVE` lock on a table larger than 1 GB unless `--allow-lock` is passed.

Before:

```
# pgshift
> Migrations that just work.

pgshift is a powerful, modern migration toolkit that empowers developers
to ship schema changes with confidence. Say goodbye to downtime.

## Why pgshift?
```

After:

```
# pgshift

pgshift applies SQL migrations to Postgres 13 and later. Each migration
runs in a transaction. A migration that would take an `ACCESS EXCLUSIVE`
lock on a table larger than 1 GB is refused unless you pass `--allow-lock`.

## Install
```

What changed:

- The tagline and "powerful, modern", "empowers", and "with confidence" are true of every migration tool, so they went.
- "Say goodbye to downtime" became the lock check, which is the mechanism behind that claim.
- "Why pgshift?" was removed. The intro now answers it, and the next heading names the next thing the reader does.

## Demo script

Facts in the source: the presenter drags the design review from Tuesday to Thursday. The app checks the calendars of the three attendees and offers 2:30 pm, the first time all three are free.

Before:

```
Scene 1: The problem
"Scheduling is broken. We fixed it."

Scene 2: A closer look
"Watch the magic happen as your calendar comes alive."
```

After:

```
Scene 1: Move a meeting to Thursday
"I drag the design review from Tuesday to Thursday."

Scene 2: The app finds a free slot
"The app checks all three attendees' calendars and offers 2:30, the first time everyone is free."
```

What changed:

- Each scene title names what happens on screen.
- The narration says what the viewer is watching, with the count and the time from the source.
- The scene numbers stay, because the scenes play in order.
