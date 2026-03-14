/**
 * 技术分析引擎 - 指标计算 + 综合评分
 */

function calcMA(data, period) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j];
    return sum / period;
  });
}

function calcEMA(data, period) {
  const result = [data[0]];
  const k = 2 / (period + 1);
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function calcRSI(data, period = 14) {
  const result = new Array(data.length).fill(null);
  if (data.length < period + 1) return result;

  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) gainSum += diff; else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function calcMACD(data, fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);
  const dif = emaFast.map((v, i) => v - emaSlow[i]);
  const dea = calcEMA(dif, signal);
  const histogram = dif.map((v, i) => (v - dea[i]) * 2);
  return { dif, dea, histogram };
}

function calcBollinger(data, period = 20, numStd = 2.0) {
  const ma = calcMA(data, period);
  const upper = [], lower = [];
  for (let i = 0; i < data.length; i++) {
    if (ma[i] === null) { upper.push(null); lower.push(null); continue; }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += (data[i - j] - ma[i]) ** 2;
    const std = Math.sqrt(sum / period);
    upper.push(ma[i] + numStd * std);
    lower.push(ma[i] - numStd * std);
  }
  return { upper, middle: ma, lower };
}

function calcKDJ(data, n = 9) {
  const k = [], d = [], j = [];
  let prevK = 50, prevD = 50;
  const m1 = 3, m2 = 3;

  for (let i = 0; i < data.length; i++) {
    let lowest = data[i].low, highest = data[i].high;
    const start = Math.max(0, i - n + 1);
    for (let t = start; t <= i; t++) {
      if (data[t].low < lowest) lowest = data[t].low;
      if (data[t].high > highest) highest = data[t].high;
    }
    const rsv = highest === lowest ? 50 : ((data[i].close - lowest) / (highest - lowest)) * 100;
    const curK = (2 / m1) * prevK + (1 / m1) * rsv;
    const curD = (2 / m2) * prevD + (1 / m2) * curK;
    const curJ = 3 * curK - 2 * curD;
    k.push(curK); d.push(curD); j.push(curJ);
    prevK = curK; prevD = curD;
  }
  return { k, d, j };
}

/**
 * 综合评分 (0-100)
 */
export function scoreStock(histData) {
  if (!histData || histData.length < 30) {
    return { score: 50, details: {}, signals: [] };
  }

  const closes = histData.map(d => d.close);
  const volumes = histData.map(d => d.volume);
  const scores = {};
  const signals = [];

  // 1. RSI (权重 20%)
  const rsiArr = calcRSI(closes);
  const rsiVal = rsiArr[rsiArr.length - 1] ?? 50;
  let rsiScore;
  if (rsiVal < 25) { rsiScore = 90; signals.push('🟢 RSI 极度超卖，反弹机会大'); }
  else if (rsiVal < 35) { rsiScore = 75; signals.push('🟢 RSI 偏低，可能有反弹'); }
  else if (rsiVal < 50) { rsiScore = 60; }
  else if (rsiVal < 65) { rsiScore = 45; }
  else if (rsiVal < 75) { rsiScore = 25; signals.push('🔴 RSI 偏高，注意风险'); }
  else { rsiScore = 10; signals.push('🔴 RSI 严重超买，回调风险大'); }
  scores['RSI'] = { value: +rsiVal.toFixed(1), score: rsiScore, weight: 0.20 };

  // 2. MACD (权重 20%)
  const macd = calcMACD(closes);
  const difVal = macd.dif[macd.dif.length - 1] ?? 0;
  const deaVal = macd.dea[macd.dea.length - 1] ?? 0;
  const histVal = macd.histogram[macd.histogram.length - 1] ?? 0;
  const prevHist = macd.histogram[macd.histogram.length - 2] ?? 0;
  let macdScore;
  if (difVal > deaVal && histVal > 0 && histVal > prevHist) { macdScore = 90; signals.push('🟢 MACD 金叉且柱线放大，强势看多'); }
  else if (difVal > deaVal && histVal > 0) { macdScore = 75; signals.push('🟢 MACD 金叉，多头趋势'); }
  else if (difVal > deaVal) { macdScore = 55; }
  else if (difVal < deaVal && histVal < 0 && histVal < prevHist) { macdScore = 10; signals.push('🔴 MACD 死叉且柱线放大，弱势看空'); }
  else if (difVal < deaVal && histVal < 0) { macdScore = 25; signals.push('🔴 MACD 死叉，空头趋势'); }
  else { macdScore = 40; }
  scores['MACD'] = { dif: +difVal.toFixed(3), dea: +deaVal.toFixed(3), histogram: +histVal.toFixed(3), score: macdScore, weight: 0.20 };

  // 3. 均线排列 (权重 15%)
  const ma5 = calcMA(closes, 5);
  const ma10 = calcMA(closes, 10);
  const ma20 = calcMA(closes, 20);
  const ma60 = calcMA(closes, 60);
  const cur = closes[closes.length - 1];
  const v5 = ma5[ma5.length - 1], v10 = ma10[ma10.length - 1];
  const v20 = ma20[ma20.length - 1], v60 = ma60[ma60.length - 1];
  let maScore = 50;
  if (v5 && v10 && v20 && v60) {
    if (cur > v5 && v5 > v10 && v10 > v20 && v20 > v60) { maScore = 95; signals.push('🟢 多头完美排列，强势上涨'); }
    else if (cur > v5 && v5 > v10 && v10 > v20) { maScore = 78; signals.push('🟢 均线多头排列，趋势向好'); }
    else if (cur > v5 && v5 > v10) { maScore = 65; signals.push('🟡 短期均线向好'); }
    else if (cur < v5 && v5 < v10 && v10 < v20 && v20 < v60) { maScore = 10; signals.push('🔴 均线空头排列，趋势较弱'); }
    else { maScore = 40; signals.push('🟡 均线缠绕，方向不明'); }
  }
  scores['均线'] = { MA5: v5 ? +v5.toFixed(2) : null, MA10: v10 ? +v10.toFixed(2) : null, MA20: v20 ? +v20.toFixed(2) : null, MA60: v60 ? +v60.toFixed(2) : null, score: maScore, weight: 0.15 };

  // 4. 成交量 (权重 15%)
  let volScore = 50;
  const volMa = calcMA(volumes, 20);
  const volMa20 = volMa[volMa.length - 1];
  if (volMa20) {
    const curVol = volumes[volumes.length - 1];
    if (curVol > volMa20 * 1.5 && cur > closes[closes.length - 2]) { volScore = 85; signals.push('🟢 放量上涨，资金进场'); }
    else if (curVol > volMa20 * 1.2 && cur > closes[closes.length - 2]) { volScore = 70; signals.push('🟢 温和放量，买盘活跃'); }
    else if (curVol > volMa20 * 1.5 && cur < closes[closes.length - 2]) { volScore = 30; signals.push('🔴 放量下跌，需警惕'); }
    else if (curVol < volMa20 * 0.5) { volScore = 40; signals.push('🟡 缩量明显，观望为主'); }
  }
  scores['成交量'] = { score: volScore, weight: 0.15 };

  // 5. 价格动量 (权重 15%)
  const change5d = closes.length >= 6 ? (cur / closes[closes.length - 6] - 1) * 100 : 0;
  let momentumScore;
  if (change5d > 10) { momentumScore = 70; signals.push(`🟡 5日涨幅 ${change5d.toFixed(1)}%，注意追高`); }
  else if (change5d > 3) { momentumScore = 80; signals.push(`🟢 5日涨幅 ${change5d.toFixed(1)}%，势头良好`); }
  else if (change5d > 0) { momentumScore = 70; }
  else if (change5d > -3) { momentumScore = 55; }
  else if (change5d > -10) { momentumScore = 40; signals.push(`🔴 5日跌幅 ${change5d.toFixed(1)}%，短期偏弱`); }
  else { momentumScore = 25; signals.push(`🔴 5日跌幅 ${change5d.toFixed(1)}%，持续走弱`); }
  scores['动量'] = { '5日涨幅': +change5d.toFixed(2), score: momentumScore, weight: 0.15 };

  // 6. 布林带 (权重 15%)
  const boll = calcBollinger(closes);
  let bollScore = 50;
  const bU = boll.upper[boll.upper.length - 1], bL = boll.lower[boll.lower.length - 1];
  if (bU && bL) {
    const pos = (cur - bL) / (bU - bL);
    if (pos < 0.1) { bollScore = 85; signals.push('🟢 触及布林下轨，可能超跌反弹'); }
    else if (pos < 0.3) { bollScore = 70; }
    else if (pos < 0.7) { bollScore = 50; }
    else if (pos < 0.9) { bollScore = 30; }
    else { bollScore = 15; signals.push('🔴 触及布林上轨，可能短期回调'); }
  }
  scores['布林带'] = { upper: bU ? +bU.toFixed(2) : null, lower: bL ? +bL.toFixed(2) : null, score: bollScore, weight: 0.15 };

  // 综合得分
  const total = Math.round(Math.min(100, Math.max(0,
    Object.values(scores).reduce((sum, s) => sum + s.score * s.weight, 0)
  )));

  return { score: total, details: scores, signals };
}

/**
 * 快速评分（基于实时数据，不需要历史数据）
 */
export function quickScore(stock) {
  let s = 50;
  const signals = [];

  // 涨跌幅贡献
  if (stock.change_pct > 5) { s += 15; signals.push('🟢 当日大涨'); }
  else if (stock.change_pct > 2) { s += 10; }
  else if (stock.change_pct > 0) { s += 5; }
  else if (stock.change_pct < -5) { s -= 20; signals.push('🔴 当日大跌'); }
  else if (stock.change_pct < -2) { s -= 10; }
  else if (stock.change_pct < 0) { s -= 3; }

  // 价格位置（相对振幅）
  const amplitude = stock.high - stock.low;
  if (amplitude > 0) {
    const pos = (stock.price - stock.low) / amplitude;
    if (pos > 0.8) { s -= 5; signals.push('🟡 接近当日最高'); }
    if (pos < 0.2) { s += 5; signals.push('🟡 接近当日最低'); }
  }

  return { score: Math.min(100, Math.max(0, s)), signals };
}

export function getMarketOverview(stocks) {
  const total = stocks.length;
  const up = stocks.filter(s => s.change_pct > 0).length;
  const down = stocks.filter(s => s.change_pct < 0).length;
  const flat = total - up - down;
  const limitUp = stocks.filter(s => s.change_pct >= 9.9).length;
  const limitDown = stocks.filter(s => s.change_pct <= -9.9).length;
  const avgChange = stocks.reduce((sum, s) => sum + s.change_pct, 0) / (total || 1);
  const totalTurnover = stocks.reduce((sum, s) => sum + (s.turnover || 0), 0);

  return {
    total, up, down, flat, limit_up: limitUp, limit_down: limitDown,
    avg_change_pct: +avgChange.toFixed(2),
    total_turnover: +(totalTurnover / 1e8).toFixed(2),
  };
}

export { calcMA, calcEMA, calcRSI, calcMACD, calcBollinger, calcKDJ };
