---
title: "Designing a Human Labeling and Preference Data Platform"
short_title: "Labeling and Preference Platform"
tags: ["labeling", "preference-data", "annotation", "quality-control", "rlhf", "design"]
sources:
  - "Ouyang et al., 'Training language models to follow instructions with human feedback' (2022)"
  - "Public documentation of data annotation tools and workforce platforms"
  - "Krippendorff, Content Analysis: An Introduction to Its Methodology, on inter-annotator agreement"
---

## The problem

Evaluation sets, fine-tuning data and preference comparisons for alignment all need **human judgement**, at scale and with measurable quality. A labeling platform manages the workflow from raw items to trusted labels: task design, assignment, annotation interface, quality control, adjudication and export. Poor labeling quietly caps what any model can learn, so the platform's quality controls are as important as its tooling.

## Step 1: Requirements

- **Task types:** classification, rating on a rubric, correcting model output, ranking or choosing between two responses, free-text feedback, red-team prompt writing.
- **Workforce:** internal experts, vendors and crowd workers, each with different permissions and rates.
- **Quality:** measurable accuracy and agreement; ability to detect and remove poor annotators.
- **Efficiency:** high throughput with model-assisted pre-labelling.
- **Governance:** privacy for sensitive content, fair pay, wellbeing support for harmful content.
- **Scale (example):** 3,000 annotators, 200,000 labels per day.

## Step 2: Core objects

- **Project:** a labeling effort with guidelines, task template and quality settings.
- **Item:** the thing to label, a text, a conversation, an image, a pair of model responses.
- **Task:** one unit of work for an annotator (an item, possibly with a model suggestion).
- **Annotation:** an annotator's answer with time spent and confidence.
- **Consensus label:** the final label after aggregation and adjudication.
- **Guideline:** versioned instructions with examples; changes are tracked because they change what labels mean.

## Step 3: Designing good tasks

Label quality starts with the task, not the workers.

- **Clear rubrics** with definitions and examples of borderline cases; ambiguous rubrics produce noise no tool can fix.
- **Simple decisions:** break complex judgements into smaller questions; for preferences, show two responses and ask "which is better" with specific criteria (helpfulness, accuracy, safety), optionally with a reason.
- **Randomise** the position of options and hide model identity to avoid bias.
- **Show context** the labeler needs (the full conversation, source documents), and nothing sensitive they do not.
- **Allow "can't tell" or "needs escalation"** instead of forcing a guess.

## Step 4: Assignment and aggregation

- **Redundancy:** have several annotators label each item (for example three for important data), with more for hard items.
- **Routing:** send tasks to annotators with the right skills (domain expertise, language) and balance load.
- **Aggregation:** majority vote for categorical labels, averages or models of annotator reliability for ratings. For preference data, record each judgement and use ties and disagreement as information.
- **Adjudication:** disagreements go to a senior reviewer or domain expert, whose decision becomes the consensus and a teaching example.

## Step 5: Quality control

- **Gold questions:** hidden items with known answers mixed into work; track each annotator's accuracy on them.
- **Inter-annotator agreement** (such as Cohen's or Krippendorff's alpha) per project and per annotator; low agreement signals unclear guidelines or a hard task, not just bad workers.
- **Audits:** reviewers sample finished work, giving feedback and corrections.
- **Behavioural signals:** implausibly fast completion, always choosing the first option, copy-pasted comments.
- **Calibration sessions** and guideline updates when systematic disagreements appear.
- **Continuous scoring** of annotators with thresholds for extra training, reduced access or removal.

## Step 6: Model-assisted labeling

Pre-fill labels with a model and let humans confirm or correct: faster, but it risks **anchoring**, where annotators agree with the suggestion without thinking. Mitigate by hiding suggestions on a random subset (to measure agreement honestly), tracking how often humans overrule the model, and requiring reasons for hard cases. Use **active learning**: send humans the items the model is least sure about, which yields more information per label.

## Step 7: Security, ethics and cost

- **Privacy:** minimise personal data shown, redact where possible, restrict annotator access by project, and prohibit copying data out.
- **Harmful content:** warn annotators, allow skipping, rotate exposure and provide support.
- **Fair pay and clear instructions** improve both ethics and quality.
- **Cost tracking** per label and per usable label (after quality filtering), since cheap noisy labels are expensive in effect.

## Step 8: Outputs and integration

Export versioned datasets with consensus labels, raw annotations, agreement statistics and guideline versions, to the evaluation platform and training pipelines. Provide lineage so any training example can be traced to who labelled it and under which guideline. Feed annotation disagreements back to improve the guidelines and the model.

## A worked example

**Scenario:** collecting preference data to compare two assistant response styles.

1. The project shows each annotator a prompt and two anonymised responses in random order, with a rubric (accuracy first, then clarity, then tone) and a "both bad" option.
2. Each pair goes to three annotators; 8 percent of tasks are gold pairs with known preferred answers.
3. Agreement across the project is 0.68; analysis shows low agreement on pairs about medical questions, so those pairs are routed to annotators with clinical backgrounds and the guideline is expanded with examples.
4. One annotator scores 52 percent on gold items and finishes tasks in 4 seconds; they are retrained, and if no improvement, removed and their recent work re-labelled.
5. The final dataset of 40,000 pairs, with consensus preferences and agreement scores, is exported with the guideline version for reward-model and DPO training.

## Common mistakes

- **Vague guidelines**, then blaming annotators for disagreement.
- **Single labels with no redundancy or gold checks.**
- **Anchoring annotators** on model suggestions with no honest baseline.
- **Changing guidelines mid-project** without versioning.
- **Optimising cost per label** instead of cost per correct label.
