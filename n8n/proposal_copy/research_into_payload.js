// Step 6 (23 Nov): the deck request, built by the node before for template 1.5, becomes a request for José's
// template 1.5.4 with the two market research slides. Nothing in "Build render payload" is changed.
//   rules     the 76 rules of template 1.5.4 (variable, limit, what to do when empty, fixed text). Copied by script
//             from the repo file variables/template_variables_1_5_4.json; at step 8 the n8n table carries them.
//   values    the flow's texts, then the fixed texts of 1.5.4, then the research slides' texts (Slide values)
//   logos     the client's and the competitors' logos (Slide values)
//   brand     the client's colour, only when it was read with high confidence
// With no research the two slide titles are empty and the renderer leaves both slides out.
const RULES = [["approach_title_01",110,"firm_todo"],["client_name_01",20,"firm_todo"],["client_point_01",120,"hide_line"],["client_point_02",120,"hide_line"],["client_point_03",120,"hide_line"],["client_point_04",120,"hide_line"],["client_point_05",120,"hide_line"],["compare_title_01",115,"drop_slide"],["competitor_01_fact_01",40,"hide_line"],["competitor_01_name",30,"remove_row"],["competitor_01_point_01",100,"hide_line"],["competitor_01_point_02",100,"hide_line"],["competitor_01_point_03",100,"hide_line"],["competitor_02_fact_01",40,"hide_line"],["competitor_02_name",30,"remove_row"],["competitor_02_point_01",100,"hide_line"],["competitor_02_point_02",100,"hide_line"],["competitor_02_point_03",100,"hide_line"],["competitor_03_fact_01",40,"hide_line"],["competitor_03_name",30,"remove_row"],["competitor_03_point_01",100,"hide_line"],["competitor_03_point_02",100,"hide_line"],["competitor_03_point_03",100,"hide_line"],["competitor_04_fact_01",40,"hide_line"],["competitor_04_name",30,"remove_row"],["competitor_04_point_01",100,"hide_line"],["competitor_04_point_02",100,"hide_line"],["competitor_04_point_03",100,"hide_line"],["cover_date_01",20,"clear"],["cover_subtitle_01",100,"firm_todo","A proposal for {client_name}"],["cover_title_01",21,"firm_todo","Consulting Proposal"],["deliverables_title_01",110,"firm_todo"],["details_01",140,"hide_line"],["details_02",140,"hide_line"],["footer_01",60,"clear","{client_name} | Draft for discussion"],["objective_01",127,"firm_todo"],["objective_02",127,"hide_line"],["objective_03",127,"hide_line"],["objective_04",127,"hide_line"],["outcome_01",127,"firm_todo"],["outcome_02",127,"hide_line"],["outcome_03",127,"hide_line"],["outcome_04",127,"hide_line"],["product_01_name",40,"remove_row"],["product_01_text",200,"hide_line"],["product_02_name",40,"remove_row"],["product_02_text",200,"hide_line"],["product_03_name",40,"remove_row"],["product_03_text",200,"hide_line"],["product_04_name",40,"remove_row"],["product_04_text",200,"hide_line"],["product_05_name",40,"remove_row"],["product_05_text",200,"hide_line"],["product_06_name",40,"remove_row"],["product_06_text",200,"hide_line"],["profile_title_01",115,"drop_slide"],["section_01",20,"remove_row","Context"],["section_02",20,"remove_row","Market Research"],["section_03",20,"remove_row","Next Steps"],["section_04",20,"remove_row"],["section_05",20,"remove_row"],["section_06",20,"remove_row"],["section_07",20,"remove_row"],["solution_01",95,"firm_todo"],["solution_02",95,"hide_line"],["solution_03",95,"hide_line"],["solution_04",95,"hide_line"],["solution_05",95,"hide_line"],["sources_compare_01",135,"clear"],["sources_profile_01",135,"clear"],["summary_title_01",90,"firm_todo"],["timeline_title_01",110,"firm_todo"],["value_layer_01",215,"clear"],["value_layer_02",215,"clear"],["value_layer_03",215,"clear"],["value_layer_04",215,"clear"]];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const p = $input.first().json || {};
const get = (n) => { try { return $(n).first().json || {}; } catch (e) { return {}; } };
const sv = get('Slide values');
const R = get('Assemble market').research || {};
const prof = get('checkProfiler').output || {};
const client = String((sv.values && sv.values.client_name_01) || prof.client_name || '').replace(/\*\*|__/g, '').trim();
const values = Object.assign({}, p.values || {});
// A fixed text of 1.5.4 fills a variable only when the flow left it empty. The agenda entries are set below.
for (const [variable, , , fixed] of RULES) if (fixed !== undefined && !/^section_/.test(variable) && !String(values[variable] || '').trim()) values[variable] = String(fixed).replace(/\{client_name\}/g, client);
const hasSlides = !!(R.slides && (R.slides.profile || R.slides.compare));
if (hasSlides) Object.assign(values, sv.values || {});
else for (const [variable] of RULES) if (/^(profile_title|compare_title|client_point|competitor|product|value_layer|details|sources_profile|sources_compare)_/.test(variable)) values[variable] = '';
if (!values.client_name_01) values.client_name_01 = client;
// The agenda of 1.5.4 has three topics: Executive Summary, Market Research (only with the research slides) and
// Approach. The flow still names the topics of the 1.5 deck (Context, Next Steps), which have no slide here
// (first test run, 23 Nov: "Next Steps" came out twice on the agenda).
values.section_01 = String(values.section_01 || '').trim() || 'Executive Summary';
values.section_02 = hasSlides ? 'Market Research' : '';
values.section_03 = String(values.section_03 || '').trim() || 'Approach';
for (const k of ['04', '05', '06', '07']) values['section_' + k] = '';
const d = new Date();
values.cover_date_01 = d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
const out = Object.assign({}, p, {
  values,
  rules: RULES.map(([variable, max_chars, if_empty]) => ({ variable, max_chars, if_empty })),
  template: '1.5.4',
  logos: hasSlides && sv.logos && typeof sv.logos === 'object' ? sv.logos : {},
  research_slides: hasSlides,
});
if (R.brand && R.brand.primary) out.brand = { primary: R.brand.primary };
return [{ json: out }];
