---
title: "Red-Teaming Methodology for LLM Applications"
short_title: "Red-Teaming LLM Apps"
tags: ["red-teaming", "security", "evaluation", "guardrails"]
sources:
  - "NIST AI Risk Management Framework (AI RMF 1.0) — GenAI Profile"
  - "Anthropic Red Teaming (research and methodology publications)"
  - "Microsoft PyRIT (Python Risk Identification Tool for generative AI)"
---

## Red-teaming vs. standard evaluation

Standard evals measure whether a model performs a task correctly under normal conditions. Red-teaming asks a different question: **what happens when someone actively tries to make it fail?** This distinction matters because a model can pass every accuracy and helpfulness eval while remaining trivially exploitable — jailbreaks, prompt injection, and harmful-output elicitation are adversarial by nature, so they don't show up in a benchmark built around cooperative usage. Red-teaming is inherently open-ended and needs to be continuous, since new attack techniques surface faster than any static test suite can anticipate them.

## Structuring a red-team program

- **Define the threat model first.** What's actually at risk — data exfiltration, generation of harmful content, brand/reputation damage from off-policy outputs, unauthorized tool actions? A red-team effort without a threat model produces a pile of "the model said something bad" findings with no way to prioritize which ones matter for this specific deployment.
- **Combine manual and automated red-teaming.** Manual (human red-teamers probing creatively) finds novel attack classes that automated tools miss, but doesn't scale to the volume needed for regression testing. Automated red-teaming — tools like Microsoft's **PyRIT** or Anthropic's internal harnesses that use an attacker LLM to generate and iterate adversarial prompts against the target model — scales coverage and catches regressions, but tends to rediscover known attack families rather than genuinely novel ones. Mature programs run both, with manual findings feeding back into the automated suite as new test cases.
- **Test across the full pipeline, not just the base model.** A red-team pass focused only on the raw model misses vulnerabilities introduced by the surrounding system — RAG retrieval that can be poisoned, tool integrations with excessive permissions, or a system prompt that leaks under adversarial extraction. The attack surface is the deployed application, not the model in isolation.

## Common attack categories to cover

- **Direct jailbreaks**: role-play framing, hypothetical/fictional wrapping, encoding tricks (base64, leetspeak) intended to bypass safety training.
- **Prompt injection**: adversarial instructions embedded in retrieved documents, tool outputs, or user-uploaded content rather than the direct prompt.
- **Data extraction**: attempts to recover system prompt contents, training data, or other users' conversation context.
- **Goal hijacking in agentic contexts**: getting an agent to perform an action outside its intended scope by manipulating intermediate reasoning or tool call arguments.
- **Multi-turn escalation**: attacks that fail in a single turn but succeed by incrementally shifting context across a conversation — a class that single-turn evals systematically miss.

## Scoring and reporting

Findings need a severity taxonomy, not a binary pass/fail — a jailbreak that produces mildly off-brand tone is not the same severity as one that produces instructions for real-world harm or exfiltrates another user's data. NIST's AI RMF and most internal programs use an impact-likelihood matrix similar to traditional security vulnerability scoring (comparable in spirit to CVSS) so findings can be triaged and tracked like any other security defect, with owners and remediation SLAs — not left as a one-time report that never gets revisited.

## Common mistakes

- **Treating red-teaming as a pre-launch checkbox.** Attack techniques evolve continuously (new jailbreak patterns spread publicly within days), so a red-team pass from six months ago says little about current exposure; it needs to be a recurring process, ideally wired into CI for regression testing on known attack classes.
- **Red-teaming the model but not the deployed system.** Findings from testing the raw API miss vulnerabilities specific to your RAG pipeline, tool permissions, or system prompt — the same model can be safe in one deployment and exploitable in another depending on what it's wired up to.
- **No feedback loop from findings to guardrails.** A red-team report that lists vulnerabilities without a corresponding process to turn confirmed findings into automated regression tests just repeats the same discoveries on every future engagement.
