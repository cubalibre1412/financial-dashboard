import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const requireText = (name, content, pattern) => {
  if (!pattern.test(content)) throw new Error(`${name}: required company-context safeguard missing`);
  checks.push(name);
};
const forbidText = (name, content, pattern) => {
  if (pattern.test(content)) throw new Error(`${name}: prohibited stale label found`);
  checks.push(name);
};

try {
  const executive = read('src/components/ExecutiveBriefing.jsx');
  const tsr = read('src/components/TsrDecompositionCard.jsx');
  const trends = read('src/components/ManagementTrendsChart.jsx');
  const benchmark = read('src/components/BenchmarkCenter.jsx');

  requireText('풀무원 전용 시뮬레이션 노출 제한', executive, /isPulmuone\s*&&\s*<button[\s\S]*briefing-tab-sim/);
  requireText('개별 브리핑 피어 자기제외', executive, /filter\(n\s*=>\s*n\s*!==\s*companyName\)/);
  requireText('TSR 상세 피어 자기제외', tsr, /filter\(m\s*=>\s*m\.name\s*!==\s*companyName\)/);
  requireText('관리지표 피어 자기제외', trends, /filter\(d\s*=>\s*d\.name\s*!==\s*companyName\)/);
  forbidText('음식료업종 TR 화면 표기', benchmark, /음식료업종\s*TR/);

  console.log(`CONTEXT AUDIT PASSED | ${checks.length} checks`);
} catch (error) {
  console.error(`CONTEXT AUDIT FAILED | ${error.message}`);
  process.exit(1);
}
