// One search per candidate to find its own website: its name, the first words of the product category and the country.
const q0 = $('Queries').first().json;
const cat = String(q0.category || '').split(' ').slice(0, 5).join(' ');
return $('Rank').all().map(i => i.json).filter(c => !c._none).map(c => ({ json: { ...c, q: [c.name, cat, q0.home_country || c.hq || ''].filter(Boolean).join(' ') + ' official website', site_country: q0.home_code || 'ALL' } }));
