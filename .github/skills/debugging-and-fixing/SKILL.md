---
name: debugging-and-fixing
description: "Debug and fix code by locating the controlling path, forming a falsifiable hypothesis, making the smallest testable change, and validating behavior. Use for bug reports, failing tests, runtime errors, regressions, and broken frontend or backend workflows."
argument-hint: "Describe the failing behavior, error, command, or file to investigate."
user-invocable: true
---

# Debugging and Fixing

## Outcome

Produce a focused root-cause fix with executable evidence. Preserve unrelated user changes, public APIs, and existing project conventions unless the failure requires otherwise.

## Procedure

1. **Anchor on the concrete failure.** Start from the named file, symbol, failing command, test, error message, or nearby implementation. Inspect only enough local code to understand who computes, mutates, or controls the behavior.
2. **State a falsifiable hypothesis.** Before editing, write down:
   - the likely controlling code path;
   - why it explains the observed failure;
   - one cheap check that could disconfirm it.
3. **Choose the smallest discriminating check.** Prefer an existing focused test or reproduction. Otherwise use a narrow typecheck, lint, request, runtime probe, or command that exercises the affected slice. Do not broaden exploration until this check shows the current hypothesis is wrong or incomplete.
4. **Make one small, reversible edit.** Fix the controlling behavior rather than masking symptoms. Match nearby patterns, avoid unrelated refactors, and keep comments only for non-obvious logic.
5. **Validate immediately.** After the first substantive edit, run the cheapest behavior-scoped check available. If it fails and supports the hypothesis, repair the same slice and rerun it. If it falsifies the hypothesis, take one nearby hop to the more direct controller before searching broadly.
6. **Add or update focused coverage when appropriate.** Cover the triggering case and the nearest important boundary, especially when the change affects shared behavior, parsing, authentication, persistence, or a user-facing workflow.
7. **Run final validation.** Execute the narrow test or check again after all adjacent edits. Use broader tests, builds, or lint only when the changed contract or project conventions make them relevant.
8. **Report precisely.** Summarize the root cause, changed files, validation commands and outcomes, and any remaining test gap or environment limitation. Do not claim checks were run when they were not.

## Project Checks

- For frontend changes, run the narrowest relevant Astro command from `front/`, such as `npm run build`, `npm run astro -- check`, or `npm run generate-types`.
- For backend changes, use the relevant Wrangler command from `cfserver/`, such as `npm run dev` for a runtime reproduction or `npm run deploy` only when deployment behavior itself must be checked.
- For cross-workspace changes, prefer the root scripts `npm run build:front`, `npm run dev:front`, or `npm run dev:back` when they exercise the affected contract.
- Do not start a long-running development server as the only validation. Stop it after the reproduction or pair it with a finite check.

## Decision Rules

- If the starting file only forwards, wires, or registers behavior, step to the nearest implementation that makes the decision.
- If several paths look plausible, choose the one with the strongest local evidence and the cheapest discriminating check.
- If validation is ambiguous, perform one nearby read of a test, call site, or abstraction boundary, then either repair locally or make one-hop relocation.
- If no executable validation is available, inspect the diff and clearly state that validation was limited.
- Never revert unrelated working-tree changes or use destructive Git commands without explicit approval.

## Completion Checklist

- [ ] The failure and controlling code path are identified.
- [ ] A falsifiable hypothesis and disconfirming check were considered.
- [ ] The smallest reasonable fix was applied.
- [ ] Focused validation passed, or its failure and cause are reported.
- [ ] Relevant regression coverage was added or its absence is justified.
- [ ] Unrelated changes were left untouched.
