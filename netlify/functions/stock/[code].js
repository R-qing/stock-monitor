import { fetchAllStocks, fetchStockHistory, fetchStockRealtime } from '../../lib/stock-data.js';
import { scoreStock, getMarketOverview, calcMA, calcRSI, calcMACD, calcBollinger, calcKDJ } from '../../lib/analysis.js';

const handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*' };
  try {
    // /api/stock/600519
    const code = event.pathParameters.code || '';
    if (!code) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, detail: '缺少股票代码' }) };

    const rt = await fetchStockRealtime(code);
    if (!rt.code) return { statusCode: 404, headers, body: JSON.stringify({ ok: false, detail: `未找到股票 ${code}` }) };

    const hist = await fetchStockHistory(code, 120);
    const closes = hist.map(d => d.close);
    const volumes = hist.map(d => d.volume);

    const ma5 = calcMA(closes, 5), ma10 = calcMA(closes, 10);
    const ma20 = calcMA(closes, 20), ma60 = calcMA(closes, 60);
    const rsi = calcRSI(closes);
    const macd = calcMACD(closes);
    const boll = calcBollinger(closes);
    const kdj = calcKDJ(hist);
    const scoring = scoreStock(hist);

    const fmt = arr => arr.map(v => v === null || v === undefined ? null : +v.toFixed(2));

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true, data: {
        basic: {
          code, name: rt.name || '', price: rt.price,
          change_pct: rt.change_pct, change_amount: rt.change_amount,
          open: rt.open, high: rt.high, low: rt.low, prev_close: rt.prev_close,
          volume: rt.volume, turnover: rt.turnover || 0,
          pe: null, pb: null, turnover_rate: 0,
        },
        kline: {
          dates: hist.map(d => d.date),
          open: fmt(hist.map(d => d.open)),
          close: fmt(hist.map(d => d.close)),
          high: fmt(hist.map(d => d.high)),
          low: fmt(hist.map(d => d.low)),
          volume: hist.map(d => d.volume),
        },
        indicators: {
          ma5: fmt(ma5), ma10: fmt(ma10), ma20: fmt(ma20), ma60: fmt(ma60),
          rsi: rsi.map(v => v === null ? null : +v.toFixed(1)),
          macd: { dif: fmt(macd.dif), dea: fmt(macd.dea), histogram: fmt(macd.histogram) },
          bollinger: boll,
          kdj,
        },
        score: scoring,
      }
    })};
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, detail: e.message }) };
  }
};

export { handler };
