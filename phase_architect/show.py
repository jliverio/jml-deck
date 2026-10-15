import json,sys
for f in sys.argv[1:]:
    a=json.load(open(f.replace('_compiled','')))
    c=json.load(open(f))['plan']
    print(f"\n######## {f}  archetype:", a['basis']['archetype_id'])
    for p in c['phases']: print(f"PHASE {p['name']} wk{p['start_week']}-{p['end_week']} {p['duration_weeks']} | gate: {p['gate']['label']} / {p['gate']['decision']} | deps {p['depends_on_assumptions']}")
    for w in c['workstreams']: print(f"  {w['id']} [{w['start_week']}-{w['end_week']}] {w['name']} | {w['traces_to']} f{w['follows']} | {w['activities']}")
    for d in c['deliverables']: print(f"    {d['id']} {d['name']} ({d['kind']}) due {d['due_week']} @ {d['presented_at']}")
    for e in c['governance']['events']: print(f"  EV {e['week']} {e['type']} {e['label']} | {e['presents']} | {e['decision']}")
    print("  NOTES:", *a['architect_notes'], sep="\n   - ")
