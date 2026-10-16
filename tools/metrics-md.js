// Writes the metrics in site/assets/metrics.js as markdown: node tools/metrics-md.js > out.md
require('../site/assets/metrics.js');
const M = globalThis.METRICS;
const out = [];
const p = (s = '') => out.push(s);
p('# Success metrics: Mobile Fix Strip and Thought Check');
p();
p('Generated from `wispr-flow-prototypes/site/assets/metrics.js` (the site renders the same file). Chosen with /define-north-star and /feature-metrics (STEDII). No Wispr baselines are available, so thresholds marked proposed are starting points; never-events are zero by definition.');
p();
p(`**Flow-level anchor (${M.anchor.label})** ${M.anchor.metric}: ${M.anchor.definition}`);
for (const [title, c] of [['Mobile Fix Strip', M.fixStrip], ['Thought Check', M.thoughtCheck]]) {
  const n = c.northStar;
  p(); p(`## ${title}`); p();
  if (c.gate) { p(`> ${c.gate}`); p(); }
  p(`### North star: ${n.name} (${n.direction})`); p();
  p(`- **Formula:** ${n.formula}`); p(`- **Population:** ${n.population}`); p(`- **Period:** ${n.period}`); p(`- **Excludes:** ${n.exclusions}`); p(`- **Decision it controls:** ${n.decision}`); p(`- **Why:** ${n.why}`); p(`- **${n.caveat}**`);
  p(); p('| STEDII | Check |'); p('|---|---|'); n.stedii.forEach(([k, v]) => p(`| ${k} | ${v} |`));
  p(); p('### Supporting metrics'); p(); p('| Metric | Formula | Direction | Decision |'); p('|---|---|---|---|');
  c.supporting.forEach((s) => p(`| ${s.name} | ${s.formula} | ${s.direction} | ${s.decision} |`));
  p(); p('### Guardrails'); p(); p('| Guardrail | Formula | Threshold | If breached |'); p('|---|---|---|---|');
  c.guardrails.forEach((g) => p(`| ${g.name} | ${g.formula} | ${g.threshold} | ${g.action} |`));
  p(); p('### Kill criteria'); p(); c.kill.forEach((k) => p(`- ${k}`));
}
process.stdout.write(out.join('\n') + '\n');
