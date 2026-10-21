"""Render the work-plan slides (approach overview, timeline, deliverables, steering) for each compiled plan
and run the layout checks. Usage: python3 render_check.py <root> [key ...]  (reads <root>/<key>/compiled.json
and v2_compiled.json; writes <key>/<version>_workplan.pptx)"""
import io, json, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, 'tests'))
from pptx import Presentation
import varfill, workplan as wp
from workplan_stress import check_slide

root = sys.argv[1]
keys = sys.argv[2:] or sorted(k for k in os.listdir(root) if os.path.isdir(os.path.join(root, k)))
for k in keys:
    for ver, f in (('chain', 'compiled.json'), ('v2', 'v2_compiled.json')):
        p = os.path.join(root, k, f)
        if not os.path.exists(p):
            continue
        plan = json.load(open(p))
        client = plan.get('client') or 'Client'
        data = wp.build_workplan_deck(plan, client=client)
        prs = Presentation(io.BytesIO(data))
        probs = [x for i, sl in enumerate(prs.slides, 1) for x in check_slide(sl, prs.slide_width, prs.slide_height, i)]
        t = varfill._load_template(varfill.TEMPLATES['1.4'])
        s = wp.roadmap_slide(t, plan, 'Approach', client)
        probs += ['overview: ' + x for x in check_slide(s, t.slide_width, t.slide_height, 0)]
        title = wp.titles(plan)['roadmap']
        if len(title) > 110:
            probs.append(f'overview title {len(title)} chars')
        open(os.path.join(root, k, f'{ver}_workplan.pptx'), 'wb').write(data)
        t.save(os.path.join(root, k, f'{ver}_overview.pptx'))
        print(('FAIL ' if probs else 'PASS ') + f'{k} {ver}: {len(prs.slides)} work-plan slides + overview | {len(plan["phases"])} phases, {len(plan["workstreams"])} ws, {len(plan["deliverables"])} del, {len(plan["governance"]["events"])} meetings' + (' | ' + ' | '.join(probs[:4]) if probs else ''))
