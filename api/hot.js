import { fetchAllStocks, fetchStockHistory } from '../../lib/stock-data.js';
import { scoreStock, quickScore } from '../../lib/analysis.js';

export default async function handler(req, res) {
  try {
    const stocks = await fetchAllStocks();
    const avgVol = stocks.reduce((s, x) => s + x.volume, 0) / (stocks.length || 1);
    const active = stocks.filter(s => s.volume > avgVol * 0.3);

    const results = [];
    for (const s of active) {
      let scoring;
      try {
        const hist = await fetchStockHistory(s.code, 60);
        scoring = scoreStock(hist);
      } catch {
        scoring = quickScore(s);
      }
      results.push({
        code: s.code, name: s.name, price: s.price,
        change_pct: s.change_pct, turnover_rate: 0,
        score: scoring.score, signals: scoring.signals,
      });
    }
    results.sort((a, b) => b.score - a.score);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60');
    res.status(200).json({ ok: true, data: results.slice(0, 20) });
  } catch (e) {
    res.status(500).json({ ok: false, detail: e.message });
  }
}
