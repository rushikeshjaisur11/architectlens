---
title: "Designing an AI Tutoring System"
short_title: "AI Tutoring System"
tags: ["education", "tutoring", "pedagogy", "student-model", "safety", "design"]
sources:
  - "Bloom, 'The 2 Sigma Problem: The Search for Methods of Group Instruction as Effective as One-to-One Tutoring' (1984)"
  - "Corbett and Anderson, 'Knowledge tracing: Modeling the acquisition of procedural knowledge' (1995)"
  - "Public guidance on student data privacy (for example FERPA and COPPA overviews)"
  - "Kestin et al., 'AI tutoring outperforms in-class active learning', Scientific Reports (June 2025), nature.com/articles/s41598-025-97652-6"
  - "Khanmigo two-year school experiment working paper (2026), edworkingpapers.com ai26-1551, via search results"
  - "FTC, Children's Online Privacy Protection Rule amendments (final April 2025, effective 23 June 2025), federalregister.gov"
banner:
  layout: line
  nodes:
    - [user, "student"]
    - [model, "tutor"]
    - [db, "progress"]
    - [doc, "next hint"]
predict:
  question: "A student answers 1/2 + 1/3 = 2/5. What does the tutor do first?"
  options: ["Asks a guiding question about piece sizes and withholds the answer", "States that 5/6 is correct and explains the method straight away", "Resets the student's mastery to zero and moves on to a new topic"]
  answer: 0
  why: "The policy picks hint level one, a nudge, and reveals answers only after genuine attempts."
check:
  - q: "Why use a symbolic engine to check maths steps and results?"
    options: ["Symbolic engines write friendlier explanations than the language model can", "The LLM explains but does not compute, because wrong explanations teach wrong things", "Engines replace the curriculum graph when choosing the next problem"]
    answer: 1
    why: "Deterministic tools handle correctness; the LLM handles explanation."
  - q: "Why judge the tutor by randomised learning outcomes rather than chat quality or engagement?"
    options: ["Engagement is hard to log, whereas test scores are available by default", "Chat quality is fixed by the pedagogical policy, so it cannot vary across sessions", "A fluent, engaging tutor can still harm learning, for instance by handing out answers"]
    answer: 2
    why: "Evaluation should measure learning; engagement is secondary."
  - q: "Why was the Khanmigo effect size much smaller than the Harvard physics result?"
    options: ["Real-world usage and fidelity matter, and effects shrink versus lab-style trials", "The Tennessee tutor gave answers on request, unlike the Harvard tutor", "Middle-school students cannot benefit from pedagogy-based tutors the way undergraduates do"]
    answer: 0
    why: "The lesson says real-world effects are smaller and usage and fidelity matter."
---

*Engineering patterns only; child privacy and education regulations vary and must be confirmed with legal and privacy teams.*

## The problem

One-to-one tutoring is among the most effective forms of teaching, but few students can afford it. An **AI tutor** offers personalised practice, explanation and feedback at scale. A naive chatbot that simply answers questions can **undermine learning** (students copy answers), give wrong explanations, or behave unsafely with minors. A good design embeds **pedagogy, a model of the student and strong safeguards** around the language model.

## Step 1: Requirements

- **Learning outcomes:** measurable improvement against curriculum standards, not engagement alone.
- **Personalisation:** adapt difficulty, pacing and explanations to each student.
- **Pedagogical behaviour:** guide rather than give away solutions; check understanding; encourage effort.
- **Accuracy:** correct content aligned with the curriculum; careful in maths and science.
- **Safety and privacy:** age-appropriate content, no harmful or manipulative interaction, strict data protection for minors.
- **Teacher and parent visibility:** insight and control.
- **Scale (example):** 1 million students across schools, concurrent peaks at school hours.

## Step 2: Architecture

- **Curriculum and content graph:** standards, topics, prerequisites, skills, vetted explanations, worked examples and exercises.
- **Student model:** estimates of mastery per skill, misconceptions, engagement, preferences.
- **Tutor orchestrator:** decides the next pedagogical move using the student model and session context.
- **LLM dialogue layer:** generates hints, explanations and feedback within pedagogical constraints.
- **Tools:** calculators and symbolic engines for maths, code runners, simulation widgets, retrieval over approved materials.
- **Assessment engine:** problem selection, automatic grading, mastery updates.
- **Safety and moderation layer.**
- **Teacher dashboard and analytics.**

## Step 3: Student modelling

Track what each student knows. **Knowledge tracing** methods update mastery estimates per skill from their answers (right or wrong, hints used, time taken), and spaced-repetition logic schedules review. Link skills in a prerequisite graph so the tutor can diagnose gaps ("struggling with fractions because of unit fractions") and route accordingly. Track common misconceptions with examples. Keep the model **transparent** to teachers and updated conservatively to avoid labelling students inaccurately.

## Step 4: Pedagogical policy

The system decides what kind of response helps learning:

- **Hint ladders:** start with a nudge, then a more specific hint, then a worked step, only revealing the answer after genuine attempts or on teacher-allowed settings.
- **Ask, don't tell:** prompt the student to explain their reasoning; use Socratic questions.
- **Immediate, specific feedback** on errors, identifying the likely misconception.
- **Retrieval practice and interleaving** of earlier material.
- **Worked examples** for novices, fading to independent practice.
- **Productive struggle:** avoid rescuing too quickly; detect frustration and adjust.
- **Mastery gates:** move on only after demonstrating the skill.

Encode these as a **policy layer** and as constraints in the tutor's prompts, with evaluations that test the tutor withholds answers appropriately.

## Step 5: Correctness

Wrong explanations teach wrong things. Use deterministic tools for maths and code: a computer algebra system checks steps and results; the LLM explains but does not compute. Ground factual content in **vetted curriculum materials** via retrieval, with citations to the source lesson. Verify generated problems have correct, unique answers by solving them independently. Add a **verifier model or rule checks** for grade-level language and curriculum alignment. Escalate uncertain questions to teachers or flag them.

## Step 6: Safety, privacy and wellbeing

- **Age-appropriate content** filters tuned by grade, blocking inappropriate material and off-topic misuse; resistance to jailbreaks.
- **Safeguarding:** detect signals of self-harm, abuse or bullying and follow escalation protocols to designated adults, with human review and clear policies.
- **No manipulation or dark patterns:** no engagement-maximising streaks or emotional pressure; be honest that it is an AI.
- **Privacy:** minimise personal data, parental or school consent where required, no advertising use, strict retention, no training on student data without consent, strong access control and school-level data isolation.
- **Equity and accessibility:** support multiple languages and accessibility needs (screen readers, dyslexia-friendly formats); test for bias in expectations and feedback.
- **Academic integrity:** discourage and detect answer-copying; teachers can configure how much help is allowed.

## Step 7: Teachers and the classroom

Teachers need visibility and control: dashboards of progress and misconceptions across a class, the ability to assign topics and set policy (hint limits, allowed tools), access to transcripts of concern, and tools to turn insights into lessons. The system supports rather than replaces them. Provide **offline or low-bandwidth** modes and handle shared devices.

## Step 8: Evaluation

Judge by learning, not chat quality. Run **randomised studies** or quasi-experiments comparing outcomes (pre and post assessments, standardised tests) between tutored and control students; measure engagement carefully (time on task, completion), but treat it as secondary. Offline evaluations test tutor behaviour on simulated students (does it give hints appropriately, avoid errors), expert teacher review of transcripts, and correctness suites by subject. Monitor safety incidents and subgroup performance.

## A worked example

**Scenario:** a student is working on adding fractions and gets 1/2 + 1/3 = 2/5.

1. The assessment engine marks the answer wrong and updates the student model: low mastery on "common denominators", a known misconception ("add numerators and denominators").
2. The policy picks hint level one: the tutor asks "What does the denominator tell us about the size of each piece? Are halves and thirds the same size?"
3. The student answers that they are different. The tutor suggests drawing both fractions as pieces of the same bar and asks how many equal pieces would work for both.
4. After the student reaches 6 as a common size, the tutor lets them finish the calculation; a symbolic tool verifies 5/6 and the tutor confirms with an explanation of why the first method failed.
5. The mastery estimate rises modestly, the tutor schedules a similar problem for later review, and the teacher dashboard shows this misconception trending among 8 students in the class.

## Enterprise practice (verified October 2026)

**Basics.** Student model, hint ladder, verified maths, safety and teacher visibility (steps above).

**Evidence (published, October 2026).**

- **Harvard physics RCT (Scientific Reports, 2025).** In a randomised crossover with 194 students, a purpose-built AI tutor used at home produced **median learning gains more than double** those of the same lesson taught with in-class active learning, in less time (49 versus 60 minutes). The tutor was designed around pedagogy (structured, step-by-step, grounded in instructor-written solutions), not a general chatbot.
- **Khanmigo, two-year cluster-randomised trial in 18 Tennessee middle schools (2026 working paper).** Where Khan Academy's AI tutor was configured to coach rather than give answers during remedial maths sessions, reported effects were modest: about **1.3 national percentile ranks per term**, roughly **0.06 to 0.08 standard deviations per school year** (about 0.14 for full active participation). Real-world effects are smaller than lab-style trials; usage and fidelity matter.

**Regulation (US).** The FTC's **amended COPPA Rule** (effective 23 June 2025; compliance dates run later) moves several uses to **opt-in consent**, requires specific permission before using children's data for advertising or sharing with third parties, and expressly includes **biometric identifiers such as voiceprints** in personal information. The FTC declined to add ed-tech provisions, deferring to expected FERPA updates, so school-contract terms (school as the consenting authority, data-use limits) still carry weight. EU and UK rules differ; confirm with counsel.

**Enterprise pattern.** Pre-register the evaluation: define the outcome (assessment scores), run an A/B or staggered rollout across classes, and publish effect sizes with intervals. Log tutor behaviour (hint level, answer withholding rate) as a safety metric.

## Common mistakes

- **A general chatbot** that gives answers on request, harming learning.
- **LLM arithmetic and unchecked solutions.**
- **Optimising engagement** instead of learning outcomes.
- **Weak privacy and safeguarding** for minors.
- **No teacher visibility or control.**
