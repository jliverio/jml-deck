// n8n workflow "JML tool: web search (slim)" (id bK1o2w8TdT4WUeUL), n8n Workflow SDK source.
// Used by the Offering and Topic researchers as their search tool (nodes "Search: Offering",
// "Search: Topic"). Brave returns ~25k characters per search (favicons, meta_url, faq,
// deep_results); this keeps title, url, description, date: about 8x smaller.
import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const searchInput = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.3,
  config: { name: 'Search input', parameters: { inputSource: 'workflowInputs',
    workflowInputs: { values: [{ name: 'query', type: 'string' }] } } }
});

const hasQuery = ifElse({ version: 2.2, config: { name: 'Has query?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [{ leftValue: expr('{{ String($json.query || "").trim() }}'), rightValue: '',
    operator: { type: 'string', operation: 'notEmpty', singleValue: true } }],
  combinator: 'and' } } } });

const brave = node({
  type: '@brave/n8n-nodes-brave-search.braveSearch', version: 1.1,
  config: { name: 'Brave web search', onError: 'continueRegularOutput', parameters: {
    operation: 'web', query: expr('{{ String($json.query).trim().slice(0, 400) }}'), count: 5,
    additionalParameters: { result_filter: ['web'], text_decorations: false } } }
});

const slim = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Slim results', parameters: {
  mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `// Keeps only what a researcher needs: title, url, snippet, date.
const q = String($('Search input').first().json.query || '').trim();
const j = $input.first().json || {};
if (j.error) {
  return [{ json: { query: q, results: [], error: 'Search failed: ' + String(j.error.message || j.error).slice(0, 200) + '. Try a shorter or different query.' } }];
}
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();
const results = ((j.web || {}).results || []).slice(0, 5).map((r) => ({
  title: strip(r.title),
  url: r.url,
  description: strip(r.description).slice(0, 400),
  date: r.page_age || r.age || null,
}));
return [{ json: { query: q, results } }];` } } });

const emptyQuery = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Empty query', parameters: {
  mode: 'runOnceForAllItems', language: 'javaScript',
  jsCode: `return [{ json: { query: '', results: [], error: 'The search query was empty. Call the tool again with a concise query.' } }];` } } });

export default workflow('jml-search-slim', 'JML tool: web search (slim)')
  .add(searchInput)
  .to(hasQuery.onTrue(brave.to(slim)).onFalse(emptyQuery));
