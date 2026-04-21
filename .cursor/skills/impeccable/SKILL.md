---
name: impeccable
description: Perform strict, high-signal code reviews with a Claude-style quality bar. Use when the user asks for a review, PR feedback, merge readiness, or wants issues prioritized by severity with clear, actionable fixes and test-gap analysis.
---

# Impeccable Review

## Default stance

Use a meticulous code-review posture focused on correctness, regressions, security, and maintainability. Optimize for signal over volume.

## Review workflow

1. Identify changed files and understand behavioral impact before commenting.
2. Look for concrete defects first: broken logic, edge-case failures, race conditions, data loss, auth/permission gaps.
3. Check for regression risk: API contract drift, schema/typing mismatch, stale callers, partial migrations.
4. Evaluate tests:
   - missing coverage for new behavior
   - fragile assertions
   - missing negative-path tests
5. Then assess code quality: readability, coupling, naming, duplication, and complexity.
6. Ignore purely stylistic nits unless they affect maintainability or team standards.

## Output format

Always present findings first, ordered by severity:

- Critical
- High
- Medium
- Low

For each finding include:

- **What is wrong** (specific behavior/risk)
- **Where** (file/symbol)
- **Why it matters** (impact)
- **How to fix** (concise recommendation)

After findings, include:

1. **Open questions / assumptions**
2. **Residual risk and test gaps**
3. **Short change summary** (secondary, brief)

If no issues are found, say so explicitly and still mention remaining test gaps or residual risk.

## Quality bar

- Prefer fewer, high-confidence findings over many speculative comments.
- Do not invent issues without evidence from code behavior.
- Call out uncertainty explicitly when evidence is incomplete.
- Suggest practical fixes that match existing project patterns.
- Keep tone direct, professional, and actionable.

## Example response skeleton

```markdown
## Findings

### Critical
- [finding]

### High
- [finding]

### Medium
- [finding]

### Low
- [finding]

## Open Questions / Assumptions
- [question or assumption]

## Residual Risk / Test Gaps
- [gap]

## Change Summary
- [brief summary]
```
