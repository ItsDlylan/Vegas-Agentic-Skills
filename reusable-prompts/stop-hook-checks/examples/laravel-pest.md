# Laravel app with Pest and node tests

Recorded on 2026-11-13 in a Laravel 11 app that uses Pest for PHP tests and `node --test` for JavaScript tests.

## When this fits

The project already had a `PostToolUse` hook that runs Pint on every edit, so formatting was handled. Claude often finished a turn without running the tests for the code it had changed. The Stop hook makes those tests run on every stop.

## What Claude built

- `.claude/hooks/stop-run-tests.sh` is the script.
- `.claude/settings.json` gained a `Stop` entry with a 600-second timeout. The existing Pint hook was kept.

The script maps changed files to tests:

| Changed file | Tests it runs |
|---|---|
| `tests/**/*Test.php` | That file |
| `app/Services/Foo.php` | Every `FooTest.php`, plus tests containing `use App\Services\Foo;`, up to 25 files |
| `resources/js/thing.js` or `.jsx` | `resources/js/thing.test.js`, if it exists |
| Anything else | Nothing, and Claude stops normally |

The commands it runs are `php artisan test --compact <files>` and `TZ=America/Chicago node --test <files>`.

## What a failure looks like

Claude added a temporary test, `tests/Unit/StopHookProbeTest.php`, that asserts `1 + 1` is 3, and piped a fake payload into the script. The script exited 2 and wrote this to stderr, which is what Claude reads on a real stop:

```
Stop hook (attempt 1/3): tests covering your changed files fail.
Read the failures below, fix the code or the test, then finish again.
If a failure is pre-existing and unrelated to your change, say so to the user instead of looping.

PHP tests failed:
  php artisan test --compact tests/Unit/StopHookProbeTest.php

  FAILED  Tests\Unit\StopHookProbeTest > it fails on purpose for the stop h…
  Failed asserting that 2 is identical to 3.

  at tests/Unit/StopHookProbeTest.php:4
  ➜   4▕     expect(1 + 1)->toBe(3);

  Tests:    1 failed (1 assertions)
```

## Results of the piped runs

| Run | Exit code |
|---|---|
| No PHP or JS changes in the tree | 0 |
| Failing probe, runs 1 to 3 | 2 |
| Failing probe, run 4 | 0, with "tests still fail after 3 attempts" |
| Probe fixed to assert 2 | 0, and the attempt counter was deleted |

## Gaps found afterward

- It tests every changed file in the working tree, including uncommitted work from you or another session.
- It runs at the end of every turn, including turns where Claude only answered a question, as long as the tree has changes with tests.
- A controller change often has no matching test name and no `use` line in its feature test, so it can run nothing.
