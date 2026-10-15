import json, sys
prompt = open(sys.argv[1]).read()
schema = open('schema_v2.json').read()
inp = json.load(open(sys.argv[2]))
if len(sys.argv) > 4:
    inp["violations"] = json.load(open(sys.argv[4]))
out = sys.argv[3]
print(f"""You are executing one test run of a production LLM agent. Treat SYSTEM PROMPT below as your complete instructions and INPUT as the user message, exactly as the production model would. Think it through, then produce exactly the JSON object the system prompt asks for, matching SCHEMA.
Save that JSON (and nothing else) with the Write tool to {out}. Do not read, list or open any file, do not search, and use no tool other than Write. After saving, reply with the single word: done.

=== SYSTEM PROMPT ===
{prompt}
=== SCHEMA ===
{schema}
=== INPUT ===
{json.dumps(inp, ensure_ascii=False)}
""")
