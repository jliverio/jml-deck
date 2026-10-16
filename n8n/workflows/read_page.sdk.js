// n8n workflow "JML tool: read page" (id 4Iq16peRkEXybs11), n8n Workflow SDK source.
// Used by the researchers and the Client Profiler (nodes "Read page: Offering|Topic|Profiler").
// Their prompts require opening a page before using it; without this tool they either
// returned nothing (run 26) or bent the rule. Firecrawl runs on n8n Gateway credits.
import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const pageInput = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.3,
  config: { name: 'Page input', parameters: { inputSource: 'workflowInputs',
    workflowInputs: { values: [{ name: 'url', type: 'string' }] } } }
});

const hasUrl = ifElse({ version: 2.2, config: { name: 'Has URL?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [{ leftValue: expr('{{ /^https?:\\/\\//i.test(String($json.url || "").trim()) }}'), rightValue: '',
    operator: { type: 'boolean', operation: 'true', singleValue: true } }],
  combinator: 'and' } } } });

const scrape = node({
  type: '@mendable/n8n-nodes-firecrawl.firecrawl', version: 1,
  config: { name: 'Firecrawl scrape', onError: 'continueRegularOutput', parameters: {
    resource: 'Scraping', operation: 'scrape', url: expr('{{ String($json.url).trim() }}'), parsers: ['pdf'],
    scrapeOptions: { options: { formats: { format: [{ type: 'markdown' }] }, onlyMainContent: true, blockAds: true, removeBase64Images: true } } } }
});

const slimPage = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Slim page', parameters: {
  mode: 'runOnceForAllItems', language: 'javaScript', jsCode: `// Returns the page text (capped) plus the metadata a researcher needs to cite it.
const url = String($('Page input').first().json.url || '').trim();
const j = $input.first().json || {};
const d = j.data || j;
if (j.error || !d || (!d.markdown && !d.metadata)) {
  const msg = j.error ? String(j.error.message || j.error).slice(0, 200) : 'no readable content';
  return [{ json: { url, readable: false, error: 'Could not read this page (' + msg + '). Treat it as a page you could not read.' } }];
}
const m = d.metadata || {};
const pick = (...keys) => { for (const k of keys) { const v = m[k]; if (v) return Array.isArray(v) ? v[0] : v; } return null; };
const LIMIT = 8000;
const text = String(d.markdown || '').replace(/\\n{3,}/g, '\\n\\n').trim();
return [{ json: {
  url: pick('sourceURL', 'url') || url,
  readable: text.length > 0,
  title: pick('title', 'og:title', 'ogTitle'),
  site_name: pick('og:site_name', 'ogSiteName', 'siteName'),
  published: pick('publishedTime', 'article:published_time', 'datePublished', 'date', 'dc.date', 'DC.date.issued', 'modifiedTime', 'article:modified_time'),
  language: pick('language', 'og:locale'),
  text: text.slice(0, LIMIT),
  truncated: text.length > LIMIT,
} }];` } } });

const badUrl = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Bad URL', parameters: {
  mode: 'runOnceForAllItems', language: 'javaScript',
  jsCode: `return [{ json: { url: String($json.url || ''), readable: false, error: 'Pass a full http(s) URL copied from the search results.' } }];` } } });

export default workflow('jml-read-page', 'JML tool: read page')
  .add(pageInput)
  .to(hasUrl.onTrue(scrape.to(slimPage)).onFalse(badUrl));
