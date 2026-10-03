"""Validate predict/check frontmatter. Usage: python scripts/check_quiz.py <lesson.md>... Exit 1 on any problem."""
import sys, yaml

MAX_RATIO = 1.4
bad = 0

def problems(q, label, key):
    out = []
    opts, ans = q.get("options", []), q.get("answer")
    if not (2 <= len(opts) <= 4): out.append("options must be 2-4")
    elif not isinstance(ans, int) or not (0 <= ans < len(opts)): out.append("answer out of range")
    else:
        wrong = max(len(o) for i, o in enumerate(opts) if i != ans)
        if len(opts[ans]) > wrong * MAX_RATIO: out.append(f"correct option too long ({len(opts[ans])} vs {wrong}); shorten it or lengthen distractors")
    if not q.get(key) or not q.get("why"): out.append("missing question/why")
    return [f"{label}: {m}" for m in out]

for path in sys.argv[1:]:
    text = open(path, encoding="utf-8").read()
    fm = yaml.safe_load(text.split("---", 2)[1])
    msgs = []
    if "predict" not in fm: msgs.append("no predict")
    else: msgs += problems(fm["predict"], "predict", "question")
    check = fm.get("check", [])
    if len(check) != 3: msgs.append(f"need exactly 3 check items, found {len(check)}")
    for i, q in enumerate(check): msgs += problems(q, f"check[{i}]", "q")
    if len(check) == 3 and len({q.get("answer") for q in check}) == 1: msgs.append("all check answers share one index")
    for m in msgs: print(f"{path}: {m}")
    bad += bool(msgs)
print("OK" if not bad else f"{bad} file(s) with problems")
sys.exit(bool(bad))
