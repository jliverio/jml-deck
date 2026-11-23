"""Token use per model node from saved n8n execution results (tool-result files).
usage: python3 cost_parse.py <label> <file> [<file> ...]  -> appends to usage.jsonl and prints a summary
Never prints prompts, outputs or logos: only node names, model ids and counts."""
import json, sys
PRICES = {  # n8n Gateway list of 17 Oct 2026 (financial model, Prices section 5): $ per M tokens in, out
    'claude-sonnet-5-5': (2.0, 10.0), 'claude-sonnet-5': (2.0, 10.0), 'claude-opus-5-5': (4.0, 20.0),
    'claude-opus-5': (5.0, 25.0), 'claude-haiku-5-5': (0.10, 0.50),
}
def load(path):
    d = json.load(open(path))
    if isinstance(d, list) and d and isinstance(d[0], dict) and 'text' in d[0]:
        d = json.loads(d[0]['text'])
    return d
def usage(d):
    ex = d['execution']; rd = d['data']['resultData']['runData']
    rows, tools = {}, {}
    for node, runs in rd.items():
        for r in runs:
            data = r.get('data') or {}
            if 'ai_languageModel' in data:
                try: model = r['inputOverride']['ai_languageModel'][0][0]['json']['options']['model']
                except Exception: model = 'unknown'
                for item in (data['ai_languageModel'][0] or []):
                    j = item.get('json', {})
                    tu = j.get('tokenUsage') or j.get('tokenUsageEstimate') or {}
                    o = rows.setdefault((node, model), {'calls': 0, 'in': 0, 'out': 0, 'estimated': 0, 'ms': 0})
                    o['ms'] += r.get('executionTime', 0) or 0; o['calls'] += 1; o['in'] += tu.get('promptTokens', 0) or 0; o['out'] += tu.get('completionTokens', 0) or 0
                    if 'tokenUsage' not in j: o['estimated'] += 1
            if 'ai_tool' in data and (node.startswith('Search') or node.startswith('Read page')):
                tools[node] = tools.get(node, 0) + 1
    return ex, rows, tools
label = sys.argv[1]
for f in sys.argv[2:]:
    ex, rows, tools = usage(load(f))
    cost = 0.0
    for (node, model), o in sorted(rows.items()):
        pi, po = PRICES.get(model, (None, None))
        c = None if pi is None else (o['in'] * pi + o['out'] * po) / 1e6
        cost += c or 0
        rec = {'label': label, 'exec': ex['id'], 'workflow': ex['workflowId'], 'node': node, 'model': model, **o, 'usd': c}
        open('usage.jsonl', 'a').write(json.dumps(rec) + '\n')
    for node, n in tools.items():
        open('usage.jsonl', 'a').write(json.dumps({'label': label, 'exec': ex['id'], 'workflow': ex['workflowId'], 'tool': node, 'calls': n}) + '\n')
    calls = sum(o['calls'] for o in rows.values()); tin = sum(o['in'] for o in rows.values()); tout = sum(o['out'] for o in rows.values())
    est = sum(o['estimated'] for o in rows.values())
    print(f"{label} exec {ex['id']} ({ex['workflowId']}): {calls} model calls, {tin} in, {tout} out, ${cost:.4f}" + (f", {est} estimated" if est else "") + (f", tools {tools}" if tools else ""))
