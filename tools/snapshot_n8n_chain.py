"""Writes n8n/workflows/chain_section_oct21.json: the chain nodes of the n8n workflow as saved, with long texts
replaced by pointers to the repo files they were pasted from.
Usage: python3 tools/snapshot_n8n_chain.py <get_workflow_details result .json>"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODES = ['Phase Architect', 'Model: Phase Architect', 'Architect input', 'Route', 'Workstream agent', 'Model: Workstream agent',
         'Workstreams schema', 'Deliverable agent', 'Model: Deliverable agent', 'Deliverables schema', 'Governance agent',
         'Model: Governance agent', 'Governance schema', 'Chain check', 'Model: Workstream fixer', 'Model: Deliverable fixer',
         'Model: Governance fixer']
KEEP = ('id', 'name', 'type', 'typeVersion', 'position', 'parameters', 'disabled', 'onError', 'notes')


def shorten(v, path):
    if isinstance(v, dict):
        return {k: shorten(x, path + [k]) for k, x in v.items()}
    if isinstance(v, str) and len(v) > 400:
        what = 'prompt' if path[-1] == 'systemMessage' else 'file'
        return v[:120] + '...' if path[-1] == 'prompt' else f'<see repo {what}: {len(v)} chars>'
    return v


def main(src):
    wf = json.load(open(src))['workflow']
    by = {n['name']: n for n in wf['nodes']}
    missing = [n for n in NODES if n not in by]
    if missing:
        sys.exit(f'not in the workflow: {missing}')
    nodes = [{k: (shorten(by[n][k], [k]) if k == 'parameters' else by[n][k]) for k in KEEP if k in by[n] and k != 'id'} for n in NODES]
    con = {s: c for s, c in wf['connections'].items() if s in NODES}
    out = {'note': 'Chain section of "Proposal request -> scoping deck reply" (Id8uRq0GgHDg7NBV) as saved on Oct 21, 2026; '
                   'long texts point to the repo files they were pasted from (n8n/README.md lists them).',
           'versionId': wf['versionId'], 'nodes': nodes, 'connections': con}
    dst = os.path.join(ROOT, 'n8n', 'workflows', 'chain_section_oct21.json')
    json.dump(out, open(dst, 'w'), indent=1, ensure_ascii=False)
    print(f'wrote {dst}: {len(nodes)} nodes, version {wf["versionId"]}')


if __name__ == '__main__':
    main(sys.argv[1])
