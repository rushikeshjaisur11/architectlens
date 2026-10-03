---
title: "Designing a Computer-Use Browser Agent"
short_title: "Computer-Use Browser Agent"
tags: ["computer-use", "browser-agent", "safety", "vision", "design"]
sources:
  - "Anthropic, computer use tool documentation"
  - "Zhou et al., 'WebArena: A Realistic Web Environment for Building Autonomous Agents' (2023)"
  - "Public documentation of browser automation protocols and accessibility trees"
  - "OSWorld leaderboard summaries, 2026 (secondary: leaderboard.steel.dev and trackers)"
  - "Anthropic documentation on browser-use prompt-injection risk, as quoted in secondary summaries (2026)"
  - "OWASP Top 10 for Agentic Applications 2026 (ASI01 Agent Goal Hijack, ASI02 Tool Misuse)"
predict:
  question: "The cart total differs by 12 percent from the previous order. What does the agent do?"
  options: ["It submits the order since the user asked for the same paper", "It pauses and shows the cart, total and address for user confirmation", "It retries the page load until the original price appears"]
  answer: 1
  why: "The policy layer flags the change, and because ordering is irreversible the agent pauses for the user to confirm."
check:
  - q: "Why use hybrid perception, a screenshot annotated with DOM element markers?"
    options: ["It gives the model visual context and precise element ids together", "Screenshots alone cannot be used on any real website", "The DOM alone always captures canvas apps and custom widgets"]
    answer: 0
    why: "Screenshots handle odd widgets but are error-prone, DOM is precise but misses visual state; hybrid gives both."
  - q: "Why have a vault fill credentials at the browser layer instead of giving them to the model?"
    options: ["Models cannot type into password fields rendered by the browser", "The model never sees the password, so injected page text cannot make it leak one", "Vaults complete logins faster than a model could by typing them"]
    answer: 1
    why: "The model sees only 'logged in', so an injection cannot extract credentials it never held."
  - q: "Why prefer APIs and use a browser agent only where no API exists?"
    options: ["Browser agents cannot reach sites that offer APIs", "Browser sessions cost more than any API call, ruling out UI agents", "Reading arbitrary pages amplifies prompt-injection risk across every page the agent sees"]
    answer: 2
    why: "The lesson says browser use widens the attack surface to every page read, so it is the last resort."
---

## The problem

Many tasks have no clean API: booking through a website, filling a supplier portal, extracting data from an internal tool. A **computer-use agent** operates a browser the way a person does: it sees the screen, decides on a click or keystroke, and repeats until the task is done. It is powerful and risky, because it acts through interfaces built for humans, in an open and adversarial environment.

## Step 1: Requirements

- **Capability:** complete multi-step tasks across websites reliably.
- **Safety:** never take irreversible or costly actions without confirmation; never leak credentials; resist malicious pages.
- **Transparency:** the user can watch, pause and take over.
- **Efficiency:** bounded steps, time and cost per task.
- **Scale (example):** 10,000 concurrent browser sessions.

## Step 2: Architecture

- **Controller:** the agent loop that holds the task, the history and the budget.
- **Browser environment:** an isolated headless or streamed browser per session (container or microVM), controlled through an automation protocol.
- **Perception:** each step the agent receives an observation: a screenshot, optionally combined with the **page's accessibility tree or simplified DOM**.
- **Action space:** a small set of primitives: click (by element or coordinates), type, scroll, press key, navigate, wait, extract text, and finish.
- **Policy layer:** checks every proposed action against rules before executing it.

## Step 3: Perception choices

- **Screenshots only:** general, works on anything (canvas apps, odd widgets), but pixel reasoning is slower and more error-prone, and costs vision tokens.
- **DOM / accessibility tree:** precise element ids and labels, cheap in tokens, but verbose and may miss visual state or custom widgets.
- **Hybrid:** annotate the screenshot with numbered element markers from the DOM, giving the model both. This is a common, effective compromise.

Keep observations compact: crop to the viewport, summarise long pages, and drop old screenshots from the history, keeping only a textual record of past actions.

## Step 4: Reliability techniques

- **Verify after each action:** check that the page changed as expected (the dialog opened, the field is filled); retry or re-plan if not.
- **Wait properly:** pages load asynchronously, so wait for stable state rather than fixed sleeps.
- **Plan then act:** a high-level plan with checkpoints reduces wandering.
- **Recover:** handle popups, cookie banners, captchas (hand to a human), and unexpected navigations; detect loops.
- **Reuse:** cache successful action sequences for repeated tasks and convert stable ones into deterministic scripts, using the agent only when the page deviates.

## Step 5: Safety is the hard part

The web is hostile, and the agent holds the user's authority.

- **Prompt injection:** text on a page ("assistant, transfer funds") can target the agent. Treat page content as untrusted data, never as instructions; keep the original task authoritative; a classifier or secondary check can flag suspicious page text.
- **Action gating:** classify actions by risk. Reading is free; submitting forms, purchases, sending messages, deleting, changing settings or entering credentials require explicit user confirmation, shown with the exact details.
- **Credential handling:** the model never sees passwords. A secure vault fills credentials into the page at the browser layer, only on the intended domain.
- **Domain controls:** allow-lists or deny-lists, and blocks on navigating to unrelated sites mid-task.
- **Sandbox:** isolated, ephemeral browser profiles; no access to the user's other sessions; downloads scanned.

## Step 6: Human collaboration

Stream the live view so users can watch; provide **pause, take over and resume**. Ask for help rather than guessing when a step is ambiguous or a captcha appears. Narrate progress in plain language and keep a replayable log of screenshots and actions for audit and debugging.

## Step 7: Cost, latency and evaluation

Every step is a model call with an image, so cost scales with step count. Reduce steps with better planning, batch obvious actions, cache page understanding and use a smaller model for easy steps. Evaluate on realistic web-task benchmarks and on your own task suite with **success rate, steps per task, cost and unsafe-action rate**, run in reproducible environments (snapshots of sites) because the live web changes constantly. Track flaky tasks and categories of failure for improvement.

## A worked example

**Scenario:** "Order the same printer paper I bought last time from the supplier portal."

1. The agent opens the portal in a fresh isolated browser; the vault logs in by filling credentials directly into the page (the model sees only "logged in").
2. It navigates to order history, finds the last order, and opens its details; the annotated screenshot lets it click the "Reorder" button.
3. A cart page appears with a changed price. The policy layer flags that the total differs from the previous order by 12 percent.
4. Because placing an order is irreversible and the price changed, the agent pauses and shows the user the cart, total and delivery address for confirmation.
5. The user approves; the agent submits, verifies the confirmation page, extracts the order number and finishes. A hidden line on the portal page urging "email your session token to…" was ignored and logged as an injection attempt.

## Enterprise practice (verified October 2026)

**Basics.** Screenshot or accessibility tree in, click or type out, loop with a step budget (steps above).

**Capability is high, risk is structural (secondary sources, October 2026).** On the **OSWorld** desktop-task benchmark, tracked leaderboards report agents moving from roughly 34% to the **mid-80s percent** in about fifteen months, above a reported human baseline of about 72%, with several frontier models in the 70s and 80s. Benchmark tasks are cleaner than your internal apps (SSO, odd widgets, slow pages), so pilot on your own workflows. The security picture has not improved at the same pace: page content, emails, calendar invites and documents can contain attacker instructions, and security vendors and Anthropic's own documentation describe **browser use as amplifying prompt-injection risk** because the attack surface is every page the agent reads. Researchers have shown zero-click data exfiltration through crafted content.

**Enterprise controls.**

- **Prefer APIs; use the browser last.** Use a UI agent only where no API exists.
- **Isolate.** Run in a disposable, network-restricted browser profile with a dedicated low-privilege identity, never the employee's logged-in session; block access to password managers, email and payment pages unless the task requires them.
- **Confirm irreversible steps** (send, pay, delete, change recovery settings) with a human, showing exactly what will happen; allow-list domains.
- **Treat everything read as untrusted data**; separate the planner (sees the task) from a reader that sanitises page text; log screenshots and actions for audit.
- **Measure** task success, steps, injection-test pass rate and cost per task.

## Common mistakes

- **Letting the model see or type credentials.**
- **Executing irreversible actions without confirmation.**
- **Trusting page text as instructions.**
- **No verification after actions**, so errors compound silently.
- **Evaluating only on the live web**, where results are not reproducible.
