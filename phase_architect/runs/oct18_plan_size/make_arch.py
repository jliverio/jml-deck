"""brief.json -> Phase Architect run prompt (same input shape as n8n/code/architect_input.js)."""
import json, sys, datetime, re
R = '/home/claude/repo/jml-deck/phase_architect/'
key, brief_path = sys.argv[1], sys.argv[2]
bo = json.load(open(brief_path))
sf = bo.get('soft_fields', {})
sc = sf.get('success_criteria') or {}
scl = [s.strip().rstrip('.') for s in str(sc['value']).split(';') if s.strip()] if sc.get('source') == 'stated' and sc.get('value') else []
inp = {
  'brief': {'hard_fields': bo['hard_fields'], 'required': bo['required'],
            'soft_fields': {k: sf.get(k) for k in ('deliverable_format', 'timeline', 'prior_attempts', 'success_criteria', 'out_of_scope')} | {'workstreams': sf.get('workstreams')}},
  'success_criteria_list': scl,
  'profile': {'problem_focus': 'topic', 'topic': None, 'current_state': None, 'market': None},
  'market_findings': [],
  'weeks_available': None,
  'method_library': json.load(open(R + 'method_library.json'))['archetypes'],
}
json.dump(inp, open(f'{key}_arch_input.json', 'w'), ensure_ascii=False)
prompt = open(R + 'prompt_v2.md').read()
schema = open(R + 'schema_v2.json').read()
out = f'/home/claude/wsx/llm/{key}_plan.json'
open(f'{key}_pa_prompt.txt', 'w').write(f"""You are executing one test run of a production LLM agent. Treat SYSTEM PROMPT below as your complete instructions and INPUT as the user message, exactly as the production model would. Think it through, then produce exactly the JSON object the system prompt asks for, matching SCHEMA.
Save that JSON (and nothing else) with the Write tool to {out}. Do not read, list or open any other file, do not search, and use no tool other than Write. After saving, reply with the single word: done.

=== SYSTEM PROMPT ===
{prompt}
=== SCHEMA ===
{schema}
=== INPUT ===
{json.dumps(inp, ensure_ascii=False)}
""")
print(key, 'workstreams:', json.dumps(sf.get('workstreams')), 'length:', json.dumps({k: bo['required']['engagement_length'].get(k) for k in ('value','weeks_min','weeks_max','source')}))
