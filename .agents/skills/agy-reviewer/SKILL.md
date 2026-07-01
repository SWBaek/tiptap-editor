---
name: agy-reviewer
description: Use the local Antigravity CLI (`agy`) as an external critic, second-opinion reviewer, or red-team reviewer with explicit model selection. Trigger when the user asks to consult Antigravity or agy, compare model-specific reviews, use Gemini 3.5 Flash, Gemini 3.1 Pro, Claude, or another available agy model, red-team a document, pressure-test a strategy, or check whether an insight is exaggerated, one-sided, or missing counterarguments.
---

# Agy Reviewer

Use Antigravity CLI (`agy`) as an external reviewer, not as the final authority. Codex remains responsible for reading source material, choosing the model, preparing the prompt, checking whether the model selection resolved correctly, and producing the final synthesis.

Assume the user has approved sending relevant vault content to Antigravity unless they explicitly restrict it.

## CLI

Use the installed WSL command:

```bash
agy
```

If PATH lookup fails, check `/home/swbaek/.local/bin/agy`.

For single-turn review:

```bash
timeout 300s agy --model "Gemini 3.5 Flash (High)" --print-timeout 5m -p "Return exactly: AGY_OK"
```

For long prompts, prefer a temporary prompt file:

```bash
timeout 300s agy --model "Gemini 3.1 Pro (High)" --print-timeout 5m -p "$(cat /tmp/agy-review-prompt.md)"
```

Use `--log-file` when validating model resolution:

```bash
timeout 300s agy --log-file /tmp/agy-review.log --model "Gemini 3.1 Pro (High)" --print-timeout 5m -p "Return exactly: AGY_OK"
```

## Model Selection

Before relying on a specific model, run:

```bash
agy models
```

Known available model labels from the current environment:

- `Gemini 3.5 Flash (Medium)`
- `Gemini 3.5 Flash (High)`
- `Gemini 3.5 Flash (Low)`
- `Gemini 3.1 Pro (Low)`
- `Gemini 3.1 Pro (High)`
- `Claude Sonnet 4.6 (Thinking)`
- `Claude Opus 4.6 (Thinking)`
- `GPT-OSS 120B (Medium)`

Use the exact label from `agy models` when a specific model matters. `agy --model` may accept loose names, but invalid names can silently fall back to `Gemini 3.5 Flash (Medium)` while still returning a successful answer.

When model fidelity matters, inspect the log:

```bash
rg -n "Resolving model|Propagating selected model override|Failed to resolve model flag|fallback|defaulting" /tmp/agy-review.log
```

Treat the selected model as confirmed only when the log includes:

```text
Propagating selected model override to backend: label="<requested exact model label>"
```

If the log says `Failed to resolve model flag` or propagates a different label, report the fallback and rerun with an exact label from `agy models`.

## Default Model Choices

Use these defaults unless the user specifies a model:

- `Gemini 3.5 Flash (High)` for fast document critique and ordinary second opinions.
- `Gemini 3.1 Pro (High)` for deeper strategy critique, nuanced reasoning, or high-stakes synthesis.
- `Gemini 3.5 Flash (Low)` for quick sanity checks.
- `Claude Sonnet 4.6 (Thinking)` or `Claude Opus 4.6 (Thinking)` only when the user asks to compare model families or wants a separate style of reasoning.

## Workflow

1. Read the target document or excerpts yourself first.
2. Choose a review lens: strategy critique, red-team, logic audit, execution risk, overclaim detection, alternative framing, or model comparison.
3. Choose a model and record the exact label.
4. Build a prompt with:
   - the user's question
   - relevant source excerpts or a faithful summary
   - the requested reviewer role
   - the desired output shape
   - any vault-specific constraints that matter
5. Run `agy` with `--model`, `-p`, and `--log-file`.
6. Confirm the requested model resolved correctly if model choice matters.
7. Compare Antigravity's answer with Codex's own judgment.
8. Report a synthesis that distinguishes Antigravity's critique from Codex's final view.

Do not outsource local source reading to Antigravity when the source is available. Do not present Antigravity's answer as authoritative.

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
Red-team this strategy. Assume it will fail unless its assumptions, sequencing, incentives, governance, and adoption path are strong. Find failure modes and propose minimal changes that would make it more robust.

Strategy:
...
```

### Model Comparison

Run the same prompt with two exact model labels, then compare:

```bash
timeout 300s agy --log-file /tmp/agy-flash.log --model "Gemini 3.5 Flash (High)" --print-timeout 5m -p "$(cat /tmp/agy-review-prompt.md)"
timeout 300s agy --log-file /tmp/agy-pro.log --model "Gemini 3.1 Pro (High)" --print-timeout 5m -p "$(cat /tmp/agy-review-prompt.md)"
```

Report where the models agree, where they diverge, and which critique is more useful for the user's goal.

## Output Style

When reporting back to the user, separate Antigravity's contribution from Codex's synthesis:

```text
Antigravity 설정:
- model: ...
- model 확인: ...

Antigravity의 핵심 비판:
- ...

내 판단:
- 동의: ...
- 보완: ...
- 반박: ...

최종 결론:
...
```

Keep quoted excerpts short. Paraphrase Antigravity output unless the user explicitly asks for the raw response.

## Failure Handling

If `agy` times out, authentication fails, or returns a nonzero exit code:

1. Inspect the selected log file.
2. Report the failure briefly.
3. Continue with Codex's own review instead of stopping.

If model resolution falls back to a different model, say so explicitly and rerun with an exact label from `agy models` when the requested model matters.
