---
name: safety-net-brainstorm
description: Spawn a team of agents to brainstorm test cases around a feature area after fixing a bug, uncovering gaps in test coverage that could have caught the bug earlier.
disable-model-invocation: true
---

# Safety Net Brainstorm

After fixing a bug, spawn a team of agents to brainstorm comprehensive test cases around the entire feature area. The root cause premise: if we had sufficient test coverage, we should have found the bug before it affected users.

**Arguments:** `$ARGUMENTS` (optional: file path, feature name, or description of the bug/feature area to analyze)

---

## Workflow

### Step 1: Gather Context About the Bug Fix

Determine what was fixed and the surrounding feature area. Use these sources in order:

1. **If `$ARGUMENTS` is provided** — use it as the feature area focus (file path, feature name, or description)
2. **If no arguments** — analyze the recent git history to find the bug fix:

```bash
# Recent commits on current branch
git log --oneline -10

# Files changed in recent commits
git diff HEAD~3 --name-only

# Current staged/unstaged changes
git diff --name-only
git diff --cached --name-only
```

3. **Read the changed files** to understand:
   - What was the bug?
   - What feature area does it belong to?
   - What are the related files — models, controllers, services, components, utilities?
   - What existing tests cover this area?

4. **Detect the project's test framework** — look for test configuration files (e.g., `phpunit.xml`, `jest.config.*`, `vitest.config.*`, `pytest.ini`, `.rspec`, `Cargo.toml [dev-dependencies]`, etc.) and existing test files to understand the conventions.

### Step 2: Map the Feature Area

Before spawning agents, build a map of the feature area:

1. **Identify the core files** — models, controllers, services, handlers, routes, schemas, types
2. **Identify the frontend** — pages, components, forms, hooks related to this feature
3. **Find existing tests** — search the test directories for tests covering this area
4. **Identify integration points** — other features that interact with this one (relationships, events, jobs, API consumers, shared state)

Store this context — you'll pass it to each agent.

### Step 3: Spawn the Agent Team

Spawn **5 agents in parallel**, each with a different testing lens. Each agent should receive:
- The bug description / what was fixed
- The feature area file map from Step 2
- The existing test file paths so they don't duplicate what's already covered
- The project's test framework and conventions
- Their specific lens/focus area

#### Agent 1: Edge Cases & Boundary Conditions
**Focus:** Inputs at the extremes — nulls, empty strings, zero, negative numbers, max values, special characters, Unicode, extremely long strings, empty collections, single-item collections.

**Prompt template:**
> You are a QA engineer focused on edge cases and boundary conditions. Given the following bug fix and feature area, brainstorm test cases that test the boundaries of every input, parameter, and data point in this feature. Think about: null/empty values, type coercion, min/max boundaries, off-by-one errors, empty vs missing vs default states.
>
> [Include: bug description, file map, existing tests, test framework conventions]
>
> Return a structured list of test cases. For each test case provide:
> - **Test name** (in the project's test naming convention)
> - **File** — which test file it belongs in (existing or new)
> - **What it tests** — one sentence
> - **Why it matters** — how this could catch a bug similar to the one fixed
>
> Do NOT write the full test code — just the test case descriptions. Focus on quantity and coverage breadth.

#### Agent 2: State Transitions & Timing
**Focus:** Race conditions, order-of-operations bugs, state machine transitions, before/after states, concurrent access, cache invalidation, processing order.

**Prompt template:**
> You are a QA engineer focused on state transitions and timing issues. Given the following bug fix and feature area, brainstorm test cases around state changes, sequencing, and timing. Think about: what happens when operations occur out of order, concurrent modifications, stale data, cache coherence, job/task processing timing, middleware execution order, event/listener sequencing.
>
> [Include: bug description, file map, existing tests, test framework conventions]
>
> Return the same structured format as above.

#### Agent 3: Authorization, Validation & Security
**Focus:** Permission boundaries, role-based access, validation bypass, injection, policy gaps, authentication edge cases, input sanitization.

**Prompt template:**
> You are a security-focused QA engineer. Given the following bug fix and feature area, brainstorm test cases around authorization, validation, and security boundaries. Think about: can unauthorized users access this? What if validation is bypassed? Are permissions correctly applied? Input sanitization? What about soft-deleted or archived records? Cross-tenant data leaks?
>
> [Include: bug description, file map, existing tests, test framework conventions]
>
> Return the same structured format as above.

#### Agent 4: Integration & Data Flow
**Focus:** How this feature interacts with other features — relationship integrity, cascade effects, event side effects, API contract adherence, database constraint enforcement, frontend-backend data contract.

**Prompt template:**
> You are a QA engineer focused on integration points and data flow. Given the following bug fix and feature area, brainstorm test cases that verify this feature works correctly with everything it touches. Think about: data relationship loading, cascade deletes/updates, event listeners firing correctly, API response shape matching consumer expectations, database constraints (foreign keys, unique, not null), frontend-backend prop/data contracts.
>
> [Include: bug description, file map, existing tests, test framework conventions]
>
> Return the same structured format as above.

#### Agent 5: Error Handling & Failure Modes
**Focus:** What happens when things go wrong — network failures, database errors, missing records, external service outages, malformed data, exception handling, graceful degradation.

**Prompt template:**
> You are a QA engineer focused on failure modes and error handling. Given the following bug fix and feature area, brainstorm test cases for when things go wrong. Think about: missing records (404s), failed API calls, constraint violations, timeout handling, malformed request data, exception messages leaking sensitive data, retry logic, graceful degradation.
>
> [Include: bug description, file map, existing tests, test framework conventions]
>
> Return the same structured format as above.

### Step 4: Synthesize & Deduplicate

Once all agents return:

1. **Collect all test cases** from the 5 agents
2. **Deduplicate** — remove test cases that overlap significantly
3. **Remove already-covered** — cross-reference with existing tests and remove any that are already tested
4. **Prioritize** — rank by likelihood of catching real bugs (high/medium/low):
   - **High** — directly related to the type of bug that was just fixed
   - **Medium** — tests a plausible failure mode in the same feature area
   - **Low** — defensive test that's good practice but less likely to catch a real bug

### Step 5: Present the Safety Net Report

Present the results to the user in this format:

```
## Safety Net Report: <Feature Area Name>

**Bug Fixed:** <one-line description of what was fixed>
**Feature Area:** <files/modules analyzed>
**Existing Tests Found:** X tests across Y files
**New Test Cases Brainstormed:** Z total (after dedup)

---

### High Priority (X tests)

These test cases are most likely to catch bugs similar to the one just fixed.

| # | Test Name | File | What It Tests |
|---|-----------|------|---------------|
| 1 | it('...') | tests/... | ... |
| ... | ... | ... | ... |

### Medium Priority (X tests)

Plausible failure modes in this feature area.

| # | Test Name | File | What It Tests |
|---|-----------|------|---------------|
| ... | ... | ... | ... |

### Low Priority (X tests)

Defensive tests — good practice for long-term coverage.

| # | Test Name | File | What It Tests |
|---|-----------|------|---------------|
| ... | ... | ... | ... |

---

### Recommended Next Steps

1. Start with the High Priority tests — these are the safety net for this exact class of bug
2. Add Medium Priority tests for comprehensive feature coverage
3. Consider Low Priority tests during dedicated test-writing sessions

Would you like me to implement any of these test cases?
```

### Step 6: Offer to Implement

After presenting the report, ask the user:

> Would you like me to implement any of these test cases? You can say:
> - "All high priority" — I'll write all high-priority tests
> - "All" — I'll write everything
> - "#1, #5, #12" — I'll write specific tests by number
> - "None for now" — Save the report for later

If the user wants tests implemented, write them following the project's existing test conventions. Run each test file after writing to verify they pass.

---

## Important Notes

- **Do NOT write test code during brainstorming** — the agents should focus on breadth of ideas, not implementation
- **Existing tests matter** — always check what's already covered to avoid duplicate effort
- **Feature area, not just the bug** — the goal is to cover the entire feature, not just regression-test the specific bug
- **Match project conventions** — detect and follow the project's test naming, file structure, and assertion style
- **Be specific** — vague test cases like "it handles errors" are not useful. Specify WHICH error, with WHAT input, expecting WHAT outcome
