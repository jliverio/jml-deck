// One row per slide variable, for the slide_values table.
const f = $('Final values').first().json;
return f.rows.map(r => ({ json: r }));
