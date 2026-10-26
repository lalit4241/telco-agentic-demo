// ILLUSTRATIVE business-case figures for a 12-week pilot. Not actuals, not a forecast – replace with the insurer's baseline.
export const KPIS = [
  { id: 'cycle', name: 'Escape-of-water cycle time (FNOL → settlement)', unit: 'days', baseline: 38, target: 30, better: 'lower', weeks: [38, 37, 36, 35, 34, 33, 33, 32, 31, 31, 30, 30] },
  { id: 'handle', name: 'Handler time per claim on admin (summarise, read docs, draft letters)', unit: 'mins', baseline: 95, target: 60, better: 'lower', weeks: [95, 90, 84, 78, 74, 70, 68, 66, 64, 62, 61, 60] },
  { id: 'leakage', name: 'Claims leakage (sampled file review)', unit: '%', baseline: 6.5, target: 5.0, better: 'lower', weeks: [6.5, 6.5, 6.3, 6.1, 6.0, 5.8, 5.7, 5.5, 5.4, 5.3, 5.2, 5.1] },
  { id: 'productivity', name: 'Claims closed per handler per week', unit: 'claims', baseline: 22, target: 27, better: 'higher', weeks: [22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 26, 27] },
  { id: 'complaints', name: 'Complaints per 1,000 claims', unit: 'per 1k', baseline: 14, target: 11, better: 'lower', weeks: [14, 14, 13.8, 13.5, 13.1, 12.9, 12.5, 12.2, 11.9, 11.6, 11.3, 11.1] },
  { id: 'parity', name: 'Vulnerable-customer outcome parity (settlement rate ratio)', unit: 'ratio', baseline: 0.91, target: 0.98, better: 'higher', weeks: [0.91, 0.92, 0.93, 0.93, 0.94, 0.95, 0.95, 0.96, 0.97, 0.97, 0.98, 0.98] },
  { id: 'accept', name: 'AI suggestions approved without edit', unit: '%', baseline: null, target: 70, better: 'higher', weeks: [48, 55, 59, 62, 64, 66, 68, 69, 70, 71, 72, 72] },
];
export const BUSINESS_CASE = {
  inputs: { claimsPerYear: 18000, minutesSavedPerClaim: 35, loadedCostPerHour: 38, avgClaimCost: 7800, leakageReductionPts: 1.0, pilotCost: 250000, runCostPerClaim: 0.6 },
  note: 'All figures are illustrative assumptions for discussion. Validate with the insurer\'s own MI before any investment decision.',
};
