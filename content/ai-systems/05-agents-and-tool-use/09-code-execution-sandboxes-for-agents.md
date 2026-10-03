---
title: "Code Execution Sandboxes for Agents"
short_title: "Code Execution Sandboxes"
tags: ["sandbox", "agents", "security", "microvm", "code-execution"]
sources:
  - "Sandbox comparisons for AI code execution, 2026 (secondary: modal.com, northflank.com, fast.io, amux.io)"
  - "Firecracker and gVisor project documentation"
  - "OWASP Top 10 for Agentic Applications 2026, ASI05 Unexpected Code Execution (via secondary summaries)"
---

## Why agents need somewhere safe to run code

Letting a model write and run code is one of the most powerful agent capabilities: it can analyse data, transform files, run tests and call APIs. It is also dangerous. The code comes from a model that may have been steered by a prompt injection hidden in a web page or document, and it runs with whatever authority the environment grants. OWASP's agentic-application list names *Unexpected Code Execution* as its own risk. The answer is not to trust the model, but to make the place where code runs **safe to be wrong in**.

## The isolation ladder

From weakest to strongest isolation:

1. **Process isolation / restricted interpreter.** Fast and cheap; a bug or escape reaches the host. Suitable only for trusted code.
2. **Container (Docker).** Namespaces and cgroups; all containers share the host kernel, so a kernel vulnerability is a path out.
3. **User-space kernel (gVisor).** Intercepts system calls in a user-space kernel, shrinking the host kernel's exposed surface; moderate overhead and cold start.
4. **MicroVM (Firecracker, Kata Containers).** Each sandbox is a lightweight virtual machine with its own kernel; escape requires breaking hardware virtualisation. Secondary sources report cold starts from about 150 ms to a couple of seconds depending on the setup.

For untrusted, model-generated code, the consensus in 2026 guidance is **microVM-class isolation**, with containers acceptable only where the threat model is weak. NVIDIA's guidance, quoted in one roundup, adds that application-level controls are insufficient once control passes to a subprocess.

## What the sandbox must also constrain

Isolating the kernel is necessary, not sufficient. Decide, per sandbox:

- **Network**: default deny; allow-list specific hosts (a package mirror, your API). Open internet access is how stolen data leaves.
- **Filesystem**: a fresh, ephemeral filesystem per task; mount only the needed inputs, ideally read-only.
- **Credentials**: none by default; if a tool needs access, inject a short-lived, narrowly scoped token for that task, never the user's session or a shared admin key.
- **Resources**: CPU, memory, disk, process count and wall-clock limits to stop fork bombs and infinite loops.
- **Lifetime**: destroy the sandbox when the task ends; snapshot only what you intend to keep.
- **Output**: treat results as untrusted data, scanned before they re-enter the model's context.

## Managed or self-hosted

Managed sandbox services (E2B, Daytona, Modal and others; also provider-hosted code execution tools) give fast startup and no infrastructure to run. Self-hosting Firecracker or gVisor gives data-residency control and can be cheaper at scale but needs real operations skill: image management, snapshotting, host patching. Provider tools bill by execution time; for example Anthropic's code execution bills per container-hour beyond a free allowance and is free when used alongside its web search or fetch tools (verify current terms).

## A worked example

A data-analysis agent lets finance users upload a spreadsheet and ask questions.

1. Each question starts a Firecracker-based sandbox (about 200 ms), with the file mounted read-only and a Python environment with pandas.
2. Network is denied; no credentials exist inside.
3. Limits: 2 vCPU, 2 GB RAM, 60 seconds.
4. The model's code runs, produces a chart and a summary table; both are returned as files, size-checked and scanned.
5. The sandbox is destroyed. A malicious cell in the spreadsheet that tries `curl` to an external host fails because the network is blocked; the attempt is logged as a security event.

## Practical rules

- **One sandbox per task or per user**, never shared across tenants.
- **Pre-build images** with the libraries you need so packages are not installed from the internet at run time.
- **Log commands and network attempts** for audit and detection.
- **Test escapes**: include red-team cases (read host files, reach metadata endpoints such as cloud instance credentials, exhaust memory).
- **Combine with approval steps** for any action with external side effects.

## Common mistakes

- **Running agent code in the application's own container** with its credentials.
- **Allowing full internet** "to install packages".
- **Persistent shared sandboxes** that accumulate secrets and state.
- **No resource limits**, so one loop becomes a cost incident.
- **Trusting output files**, which can carry injected instructions back into the model.
