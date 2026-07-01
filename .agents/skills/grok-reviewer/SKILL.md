---
name: grok-reviewer
description: Use the local Grok CLI as an external critic, second-opinion reviewer, or red-team reviewer for documents, strategies, project notes, technical proposals, and user insights. Trigger when the user asks to consult Grok, get an outside critique, compare Codex and Grok opinions, red-team a document, pressure-test an argument, or check whether an insight is overfit, exaggerated, or one-sided.
---

# Grok Reviewer

Use Grok as an external reviewer, not as the final authority. Codex remains responsible for reading the source material, selecting what to send, evaluating Grok's response, and producing the final answer.

Assume the user has approved sending relevant vault content to Grok unless they explicitly restrict it. Do not block the workflow on confidentiality warnings in this vault.

## CLI

Use the installed WSL binary:

```bash
/home/swbaek/.grok/bin/grok
```

For single-turn review, use `-p` or `--single` and redirect stderr to keep repo warnings out of the answer:

```bash
timeout 180s /home/swbaek/.grok/bin/grok -p "Return exactly: GROK_OK" 2>/tmp/grok-review.err
```

For long prompts, create a temporary prompt file and call:

```bash
timeout 300s /home/swbaek/.grok/bin/grok --prompt-file /tmp/grok-review-prompt.md 2>/tmp/grok-review.err
```

If `grok` is not found in PATH, still use the full path above. If that path fails, report the failure and continue with a normal Codex-only review.

## Workflow

1. Read the target document or relevant excerpts yourself first.
2. Decide the review lens before calling Grok: strategy critique, red-team, logic audit, execution risk, overclaim detection, or alternative framing.
3. Send Grok enough context to review accurately:
   - the user's question
   - relevant source excerpts or a faithful summary
   - the requested role and output format
   - any vault-specific constraints that matter
4. Ask Grok for critical analysis, not generic praise.
5. Read Grok's answer and compare it with your own judgment.
6. Finalize with Codex's synthesis:
   - where Grok is persuasive
   - where Grok is weak, generic, or missing local context
   - where Codex disagrees
   - what the final recommendation is

Do not present Grok's answer as authoritative. Do not outsource source reading to Grok when the source is available locally.

## Prompt Patterns

### Critical Document Review

```text
You are an external critical reviewer. Review the following document for weak assumptions, overstated claims, missing counterarguments, execution risks, and unclear success criteria.

User question:
...

Document/excerpts:
...

Output:
1. Strongest parts
2. Weakest assumptions
3. Overclaims or ideology risk
4. Missing risks
5. Concrete revisions
```

### Insight Overclaim Check

```text
Act as a skeptical but fair reviewer. The author is worried that this insight may be exaggerated, one-sided, or too attached to a preferred tool/method. Identify where the insight is sound, where it overreaches, and how to restate it more defensibly.

Insight/context:
...
```

### Strategy Red-Team

```text
Red-team this strategy. Assume the strategy will fail unless its assumptions, sequencing, incentives, governance, and adoption path are strong. Find the failure modes and propose minimal changes that would make it more robust.

Strategy:
...
```

### Compare With Codex Draft

```text
An initial reviewer gave this assessment. Critique the assessment itself: what did it get right, what did it miss, and where might it be biased or too confident?

Original material:
...

Initial assessment:
...
```

## Output Style

When reporting back to the user, separate Grok's contribution from Codex's synthesis:

```text
Grok의 핵심 비판:
- ...

내 판단:
- 동의: ...
- 보완: ...
- 반박: ...

최종 결론:
...
```

Keep Grok excerpts short. Paraphrase rather than dumping the entire output unless the user explicitly asks for the raw Grok response.

## Failure Handling

If Grok times out, authentication fails, or the command returns nonzero:

1. Inspect `/tmp/grok-review.err` if useful.
2. Tell the user Grok was unavailable.
3. Continue with Codex's own review instead of stopping.

If Grok returns a generic answer, tighten the prompt with more concrete excerpts and a sharper role before relying on it.
