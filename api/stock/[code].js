import { fetchAllStocks, fetchStockHistory, fetchStockRealtime } from '../../lib/stock-data.js';
import { scoreStock, quickScore, getMarketOverview, calcMA, calcRSI, calcMACD, calcBollinger, calcKDJ } from '../../lib/analysis.js';

export default async function handler(req, res) {
  try {
    const code = req.query.code || req.url.split('/').pop().replace(/[?&#].*/, '');
    if (!code) return res.status(400).json({ ok: false, detail: '缺少股票代码' });

    const rt = await fetchStockRealtime(code);
    if (!rt.code) return res.status(404).json({ ok: false, detail: `未找到股票 ${code}` });

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

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60');
    res.status(200).json({
      ok: true,
      data: {
        basic: {
          code, name: rt.name || '',
          price: rt.price, change_pct: rt.change_pct,
          change_amount: rt.change_amount, open: rt.open,
          high: rt.high, low: rt.low, prev_close: rt.prev_close,
          volume: rt.volume, turnover: rt.turnover || 0,
          pe: null, pb: null, turnover_rate: 0,
        },
        kline: {
          dates: hist.map(d => d.date),
          open: hist.map(d => +d.open.toFixed(2)),
          close: hist.map(d => +d.close.toFixed(2)),
          high: hist.map(d => +d.high.toFixed(2)),
          low: hist.map(d => +d.low.toFixed(2)),
          volume: hist.map(d => d.volume),
        },
        indicators: {
          ma5, ma10, ma20, ma60,
          rsi,
          macd: { dif: macd.dif, dea: macd.dea, histogram: macd.histogram },
          bollinger: boll,
          kdj,
        },
        score: scoring,
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, detail: e.message });
  }
}
