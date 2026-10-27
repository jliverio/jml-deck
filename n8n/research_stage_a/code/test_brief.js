// Test brief (Code, run once). The invented consumer-brand brief from the guideline, in the Brief Organizer's shape,
// so Stage A can run without the deck workflow. No real client: Marés does not exist; the competitors it finds will.
const today = $now.toFormat('yyyy-MM-dd');
const brief = {
  hard_fields: {
    client: { value: 'Marés, a Portuguese swimwear brand selling online and through 40 surf shops in Portugal', source: 'stated', quote: 'Marés is a Portuguese swimwear brand selling online and through 40 surf shops in Portugal', assumption_text: null },
    problem_statement: { value: 'Marés sells about €6 million of swimwear a year in Portugal, online and through 40 surf shops, and wants to enter Spain in 2027. It asks for a 10-week market-entry assessment ending in a go or no-go on Spain with a channel choice.', source: 'stated', quote: 'wants to enter Spain in 2027 and asks for a 10-week market-entry assessment', assumption_text: null },
  },
  required: {
    engagement_type: { value: 'assessment', source: 'stated', quote: 'a 10-week market-entry assessment', assumption_text: null },
    engagement_length: { value: '10 weeks', weeks_min: 10, weeks_max: 10, duration_derived: false, source: 'stated', quote: 'a 10-week market-entry assessment', assumption_text: null },
    stakeholders: { value: ['The founder', 'The head of sales'], source: 'stated', quote: 'The founder and the head of sales would be our counterparts.', assumption_text: null },
  },
  soft_fields: {
    deliverable_format: { value: 'A presentation', source: 'stated', quote: 'a presentation to the founder', assumption_text: null },
    timeline: { value: null, source: 'assumed', quote: null, assumption_text: null },
    prior_attempts: { value: null, source: 'assumed', quote: null, assumption_text: null },
    success_criteria: { value: 'A go or no-go on Spain with a channel choice', source: 'stated', quote: 'ending in a go or no-go on Spain with a channel choice', assumption_text: null },
    out_of_scope: { value: null, source: 'assumed', quote: null, assumption_text: null },
    workstreams: { value: null, count: null, source: 'assumed', quote: null, assumption_text: null },
  },
  client_url: { value: null, source: 'assumed', quote: null, assumption_text: null },
};
return [{ json: {
  run_id: 'stageA-' + today + '-' + Math.random().toString(36).slice(2, 8),
  today,
  brief,
  focus: 'offering',
  category: 'consumer_goods',
  allow_sentiment: false,
  budget: { l1_searches: 8, l1_reads: 4, reader_pages: 6, l4_searches: 10, l4_reads: 6 },
} }];
