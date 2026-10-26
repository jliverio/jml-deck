import json, pathlib
root = pathlib.Path('/home/claude/wsx/stageA')
rd = lambda p: (root / p).read_text()
J = lambda s: json.dumps(s, ensure_ascii=False)

RETRY_PROMPT = "The text in COMPLETION was meant to be one JSON object that follows INSTRUCTIONS, but it failed with ERROR.\nReturn the same content as one valid JSON object that follows INSTRUCTIONS. Fix the format only: parse it if it is a JSON string, remove keys the schema does not allow, change a value to the allowed value it clearly means (for example a different capitalization), and fill a missing required field with an empty string, an empty array or null as the schema allows.\nNever add a fact, figure, name, date, URL or source that is not in COMPLETION.\nIf COMPLETION is empty or holds no JSON content, reply with the single word EMPTY.\n\nINSTRUCTIONS:\n{instructions}\n\nCOMPLETION:\n{completion}\n\nERROR:\n{error}"

def model(var, name, effort='medium', max_tokens=16384):
    return f"""const {var} = languageModel({{ type: '@n8n/n8n-nodes-langchain.lmChatAnthropic', version: 1.6, config: {{ name: {J(name)}, parameters: {{ model: {{ __rl: true, mode: 'list', value: 'claude-sonnet-5-5', cachedResultName: 'Claude Sonnet 5.5' }}, options: {{ maxTokensToSample: {max_tokens}, thinkingMode: 'adaptive', effort: {J(effort)} }} }} }} }});"""

def search_tool(var, name, desc):
    return f"""const {var} = tool({{ type: '@n8n/n8n-nodes-langchain.toolWorkflow', version: 2.2, config: {{ name: {J(name)}, parameters: {{ description: {J(desc)}, workflowId: {{ __rl: true, mode: 'id', value: 'bK1o2w8TdT4WUeUL', cachedResultName: 'JML tool: web search (slim)' }}, workflowInputs: {{ mappingMode: 'defineBelow', value: {{ query: {J("={{ $fromAI('query', 'Concise web search query', 'string') }}")} }}, matchingColumns: [], schema: [{{ id: 'query', displayName: 'query', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false }}], attemptToConvertTypes: false, convertFieldsToString: false }} }} }} }});"""

def read_tool(var, name):
    desc = "Read one web page (HTML or PDF). Input: its url, copied exactly from the search results. Returns title, site_name, published (the page's own publication date when it declares one), and up to 8,000 characters of the page text."
    return f"""const {var} = tool({{ type: '@n8n/n8n-nodes-langchain.toolWorkflow', version: 2.2, config: {{ name: {J(name)}, parameters: {{ description: {J(desc)}, workflowId: {{ __rl: true, mode: 'id', value: '4Iq16peRkEXybs11', cachedResultName: 'JML tool: read page' }}, workflowInputs: {{ mappingMode: 'defineBelow', value: {{ url: {J("={{ $fromAI('url', 'The page URL, copied exactly from the search results', 'string') }}")} }}, matchingColumns: [], schema: [{{ id: 'url', displayName: 'url', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false }}], attemptToConvertTypes: false, convertFieldsToString: false }} }} }} }});"""

def parser(var, name, schema_file):
    return f"""const {var} = outputParser({{ type: '@n8n/n8n-nodes-langchain.outputParserStructured', version: 1.3, config: {{ name: {J(name)}, parameters: {{ schemaType: 'manual', inputSchema: {J(rd(schema_file))}, autoFix: true, customizeRetryPrompt: true, prompt: {J(RETRY_PROMPT)} }} }} }});"""

def agent(var, name, text_expr, prompt_file, model_var, parser_var, tools=None, max_iter=25):
    sub = f"model: {model_var}, outputParser: {parser_var}" + (f", tools: [{', '.join(tools)}]" if tools else "")
    return f"""const {var} = node({{ type: '@n8n/n8n-nodes-langchain.agent', version: 3.1, config: {{ name: {J(name)}, onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 2000, parameters: {{ promptType: 'define', text: expr({J(text_expr)}), hasOutputParser: true, options: {{ systemMessage: {J(rd(prompt_file))}, maxIterations: {max_iter}, returnIntermediateSteps: true }} }}, subnodes: {{ {sub} }}, output: [{{ output: {{}} }}] }} }});"""

def code(var, name, file, each=True):
    mode = "'runOnceForEachItem'" if each else "'runOnceForAllItems'"
    return f"""const {var} = node({{ type: 'n8n-nodes-base.code', version: 2, config: {{ name: {J(name)}, parameters: {{ mode: {mode}, jsCode: {J(rd(file))} }}, output: [{{ ok: true }}] }} }});"""

RM = "$('Research method').first().json"
frame_text = "={{ JSON.stringify({ brief: { client: $json.brief.hard_fields.client, problem_statement: $json.brief.hard_fields.problem_statement, engagement_type: $json.brief.required.engagement_type, success_criteria: $json.brief.soft_fields.success_criteria }, questions: $json.method.questions.L1.slice(0, 3), depths: $json.method.depths, today: $json.today, budget: { searches: $json.budget.l1_searches, reads: $json.budget.l1_reads }, publishers: $json.method.publishers }) }}"
finder_text = "={{ JSON.stringify({ brief: { client: " + RM + ".brief.hard_fields.client, problem_statement: " + RM + ".brief.hard_fields.problem_statement }, frame: $('Frame Setter').first().json.output, question: " + RM + ".method.questions.L1[3], list_types: " + RM + ".method.list_types, tests: " + RM + ".method.competitor_tests, publishers: " + RM + ".method.publishers, today: " + RM + ".today, budget: ($json._retry ? $json._retry.budget_left : { searches: " + RM + ".budget.l1_searches, reads: " + RM + ".budget.l1_reads }), retry: $json._retry || null }) }}"
challenger_text = "={{ JSON.stringify($json._challenger_input) }}"
reader_text = "={{ JSON.stringify({ company: $json.company, attributes: $json.attributes, frame: $json.frame, today: $json.today, budget: { reader_pages: $json.reader_pages } }) }}"
L1R = "$('L1 result').first().json.records"
press_text = "={{ JSON.stringify({ brief: { client: " + RM + ".brief.hard_fields.client, problem_statement: " + RM + ".brief.hard_fields.problem_statement }, frame: { market: " + L1R + ".frame.market, segment: " + L1R + ".frame.segment, channels: " + L1R + ".frame.channels, problem_geography: " + L1R + ".frame.problem_geography }, competitors: " + L1R + ".competitors.map(c => ({ name: c.name, domain: c.domain, country: c.country })), questions: " + RM + ".method.questions.L4, claims: " + RM + ".claims, publishers: " + RM + ".method.publishers, today: " + RM + ".today, budget: ($json._retry ? $json._retry.budget_left : { searches: " + RM + ".budget.l4_searches, reads: " + RM + ".budget.l4_reads }), retry: $json._retry || null }) }}"

parts = [
"import { workflow, node, trigger, sticky, placeholder, newCredential, ifElse, switchCase, merge, splitInBatches, nextBatch, languageModel, memory, tool, outputParser, embedding, embeddings, vectorStore, retriever, documentLoader, textSplitter, fromAi, expr } from '@n8n/workflow-sdk';",
"const manualStart = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Manual start', output: [{}] } });",
code('testBrief', 'Test brief', 'code/test_brief.js', each=False),
code('researchMethod', 'Research method', 'code/research_method.js'),
model('modelFrame', 'Model: Frame Setter'), search_tool('searchFrame', 'Search: Frame', "Search the web to verify the client's website and find a published size of the product market. Input: a concise query. Returns up to 5 results, each with title, url, description and date."), read_tool('readFrame', 'Read page: Frame'), parser('frameSchema', 'Frame schema', 'schemas/frame.json'),
agent('frameSetter', 'Frame Setter', frame_text, 'prompts/frame_setter.md', 'modelFrame', 'frameSchema', ['searchFrame', 'readFrame']),
model('modelFinder', 'Model: Competitor Finder'), search_tool('searchFinder', 'Search: Finder', "Search the web for market share tables, retailer assortments and rankings of companies in the product market. Input: a concise query. Returns up to 5 results, each with title, url, description and date."), read_tool('readFinder', 'Read page: Finder'), parser('competitorsSchema', 'Competitors schema', 'schemas/competitors.json'),
agent('competitorFinder', 'Competitor Finder', finder_text, 'prompts/competitor_finder.md', 'modelFinder', 'competitorsSchema', ['searchFinder', 'readFinder']),
code('l1Check', 'L1 check', 'code/l1_check.js'),
model('modelFrameCh', 'Model: Frame Challenger'), parser('gapsSchemaL1', 'Gaps schema L1', 'schemas/gaps.json'),
agent('frameChallenger', 'Frame Challenger', challenger_text, 'prompts/challenger.md', 'modelFrameCh', 'gapsSchemaL1', None, 3),
code('l1Gate', 'L1 gate', 'code/l1_gate.js'),
code('l1Result', 'L1 result', 'code/layer_result.js'),
code('companyList', 'Company list', 'code/company_list.js', each=False),
"const loopCompanies = splitInBatches({ version: 3, config: { name: 'Loop companies', parameters: { batchSize: 1, options: {} }, output: [{ company: {} }] } });",
model('modelReader', 'Model: Company Reader'), search_tool('searchReader', 'Search: Reader', "Search the web only to find a company's official website. Input: the company name. Returns up to 5 results, each with title, url, description and date."), read_tool('readReader', 'Read page: Reader'), parser('cellsSchema', 'Cells schema', 'schemas/cells.json'),
agent('companyReader', 'Company Reader', reader_text, 'prompts/company_reader.md', 'modelReader', 'cellsSchema', ['searchReader', 'readReader'], 20),
code('cellCheck', 'Cell check', 'code/cell_check.js'),
code('tableBuild', 'Table build', 'code/table_build.js', each=False),
model('modelCompCh', 'Model: Comparison Challenger'), parser('gapsSchemaL3', 'Gaps schema L3', 'schemas/gaps.json'),
agent('comparisonChallenger', 'Comparison Challenger', challenger_text, 'prompts/challenger.md', 'modelCompCh', 'gapsSchemaL3', None, 3),
model('modelPress', 'Model: Press Gatherer'), search_tool('searchPress', 'Search: Press', "Search the web for what the competitors, entrants, substitutes, regulators and statistics offices reported in the last 24 months. Input: a concise query. Returns up to 5 results, each with title, url, description and date."), read_tool('readPress', 'Read page: Press'), parser('findingsSchema', 'Findings schema', 'schemas/findings.json'),
agent('pressGatherer', 'Press Gatherer', press_text, 'prompts/press_gatherer.md', 'modelPress', 'findingsSchema', ['searchPress', 'readPress']),
code('findingsCheck', 'Findings check', 'code/findings_check.js'),
model('modelFindCh', 'Model: Findings Challenger'), parser('gapsSchemaL4', 'Gaps schema L4', 'schemas/gaps.json'),
agent('findingsChallenger', 'Findings Challenger', challenger_text, 'prompts/challenger.md', 'modelFindCh', 'gapsSchemaL4', None, 3),
code('l4Gate', 'L4 gate', 'code/l4_gate.js'),
code('l4Result', 'L4 result', 'code/layer_result.js'),
code('ledgerMerge', 'Ledger merge', 'code/ledger_merge.js', each=False),
"""export default workflow('jml-research-stage-a', 'For Testing | Research Stage A')
  .add(manualStart)
  .to(testBrief)
  .to(researchMethod)
  .to(frameSetter)
  .to(competitorFinder)
  .to(l1Check)
  .to(frameChallenger)
  .to(l1Gate)
  .to(l1Result)
  .to(companyList)
  .to(loopCompanies
    .onEachBatch(companyReader.to(cellCheck).to(nextBatch(loopCompanies)))
    .onDone(tableBuild.to(comparisonChallenger).to(pressGatherer).to(findingsCheck).to(findingsChallenger).to(l4Gate).to(l4Result).to(ledgerMerge))
  );""",
]
sdk = "\n\n".join(parts)
(root / 'stageA.sdk.js').write_text(sdk)
print(len(sdk))
