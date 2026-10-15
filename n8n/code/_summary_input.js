// Prepare summary (n8n Code node). Builds the Summary Writer's user message.
// In n8n:
//   const b = $('Brief Organizer').first().json.output;
//   const cfg = $('Config').first().json;
//   const rules = $('Template rules').first().json._rules || [];
//   planNode = the compiled plan: Assemble drafts' `workplan` (Phase Architect v2), else Validate plan's
//   `output`; null when the Phase Architect did not run. With no plan the slide carries the title and
//   Objectives, and placeholders in Solution and Outcomes.

function summaryLimits(rules) {
  const col = (prefix, dflt) => {
    const rs = (rules || []).filter(r => new RegExp('^' + prefix + '_\\d+$').test(String(r.variable || '')));
    const caps = rs.map(r => Number(r.max_chars)).filter(n => n > 0);
    const max = rs.length || dflt.max;
    return { min: Math.min(2, max), max, item_max_chars: caps.length ? Math.min(...caps) : dflt.item };
  };
  const t = (rules || []).find(r => r.variable === 'summary_title_01');
  return {
    title_max_chars: (t && Number(t.max_chars)) || 90,
    objectives: col('objective', { max: 4, item: 127 }),
    solution: col('solution', { max: 5, item: 95 }),
    outcomes: col('outcome', { max: 4, item: 127 })
  };
}

function buildSummaryInput(b, planNode, cfg, rules) {
  const stated = f => (f && f.source === 'stated' && f.value !== '' ? f.value : null);
  const client_name = String((b.hard_fields.client || {}).value || '').split(',')[0].trim();

  // Plan: only a plan with phases. Anything else -> null.
  let plan = null;
  if (planNode && Array.isArray(planNode.phases) && planNode.phases.length) {
    // Phase Architect v2 keeps deliverables at plan level (deliverables[].phase_order, due_week);
    // v1 keeps them on each phase (macro_deliverables). Both become macro_deliverables here.
    const dels = Array.isArray(planNode.deliverables) ? planNode.deliverables : [];
    const delsOf = p => Array.isArray(p.macro_deliverables) && p.macro_deliverables.length ? p.macro_deliverables
      : dels.filter(d => d.phase_order === p.order).sort((a, b) => (a.due_week || 0) - (b.due_week || 0)).map(d => d.name);
    // Scope notes: architect notes that say what the phases leave out and ask the partner nothing.
    const notes = Array.isArray(planNode.architect_notes) ? planNode.architect_notes : [];
    const scope_notes = notes.filter(n =>
      /(not in these phases|not covered by these phases|phases leave out|is out of scope|are out of scope)/i.test(n) &&
      !/(confirm|\?|estimate|assum|firm's own proposal|not covered by the phases:)/i.test(n));
    plan = {
      phases: planNode.phases.map((p, i) => ({ name: p.name, order: p.order || i + 1, duration_weeks: p.duration_weeks,
        objective_one_line: p.objective_one_line, macro_deliverables: delsOf({ ...p, order: p.order || i + 1 }) })),
      sequencing: planNode.sequencing,
      total_duration_weeks: planNode.total_duration_weeks,
      scope_notes
    };
  }

  const brief = {
    client_name,
    problem_statement: stated(b.hard_fields.problem_statement),
    success_criteria: stated(b.soft_fields.success_criteria),
    out_of_scope: stated(b.soft_fields.out_of_scope),
    deliverable_format: stated(b.soft_fields.deliverable_format),
    brief_narrative: b.brief_narrative || null
  };
  const clientText = [brief.problem_statement, brief.success_criteria, brief.out_of_scope, brief.brief_narrative].filter(Boolean);

  return {
    limits: summaryLimits(rules),
    brief,
    plan,
    house_style: {
      protected_terms: [...new Set([...(plan ? plan.phases.map(p => p.name) : []), ...clientText])],
      never_use: cfg.jargon_never || []
    }
  };
}
