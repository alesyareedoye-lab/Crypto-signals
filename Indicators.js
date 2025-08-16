// Сигнальный движок по твоему чек-листу (веса можно менять в настройках)
export const DEFAULT_WEIGHTS = {
  macro: 5, liquidity: 5, hft: 4, techflow: 4, onchain: 5, behavior: 3, risk: 5
};

export function scoreSignal(inputs, w=DEFAULT_WEIGHTS){
  // inputs: {priceChangePercent, volume, orderbookImb, fundingSkew, basis, onchainBias, sentiment, mempool, ...}
  // Простая референсная модель (не финсовет): от -100 до +100
  let s = 0, total = 0;
  const add = (val, weight)=>{ if (Number.isFinite(val)) { s += val*weight; total+=Math.abs(weight);} };
  add(normMomentum(inputs.priceChangePercent), w.techflow);
  add(normVolume(inputs.volume), w.liquidity);
  add(normImbalance(inputs.orderbookImb), w.liquidity);
  add(normFunding(inputs.fundingSkew), w.behavior);
  add(normBasis(inputs.basis), w.hft);
  add(normOnchain(inputs.onchainBias), w.onchain);
  add(normSentiment(inputs.sentiment), w.behavior);
  add(normMempool(inputs.mempool), w.macro);
  const score = total? Math.max(-100, Math.min(100, Math.round(100*s/total))) : 0;
  let side = "NEUTRAL";
  if (score>=30) side="LONG"; else if (score<=-30) side="SHORT";
  return {score, side};
}

// Нормировки (очень грубые — заменишь реальными данными)
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function normMomentum(pct){ return clamp(pct/5, -1, 1);}          // ±5%/24h
function normVolume(v){ return v? 0.2 : 0;}                        // тут можно сравнить к скользящему среднему
function normImbalance(x){ return clamp(x, -1, 1);}
function normFunding(skew){ return clamp(-skew, -1, 1);}           // перекос лонгов => риск падения
function normBasis(b){ return clamp(b, -1, 1);}
function normOnchain(bias){ return clamp(bias, -1, 1);}
function normSentiment(s){ return clamp(s, -1, 1);}
function normMempool(c){ return clamp(-c, -1, 1);}                 // перегрузка = минус
