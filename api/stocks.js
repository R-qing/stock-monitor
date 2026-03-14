import { fetchAllStocks, fetchStockHistory } from '../../lib/stock-data.js';
import { scoreStock, quickScore } from '../../lib/analysis.js';

export default async function handler(req, res) {
  try {
    const { sort = 'score', order = 'desc', limit = 100, keyword = '' } = req.query;
    let stocks = await fetchAllStocks();

    if (keyword) {
      const kw = keyword.toLowerCase();
      stocks = stocks.filter(s => s.code.includes(kw) || s.name.toLowerCase().includes(kw));
    }

    const results = await Promise.all(stocks.slice(0, +limit * 2).map(async (s) => {
      let scoring;
      try {
        const hist = await fetchStockHistory(s.code, 60);
        scoring = scoreStock(hist);
      } catch {
        scoring = quickScore(s);
      }
      return {
        code: s.code, name: s.name, price: s.price,
        change_pct: s.change_pct, change_amount: s.change_amount,
        volume: s.volume, turnover: s.turnover || 0,
        pe: null, pb: null, turnover_rate: 0,
        score: scoring.score, signals: scoring.signals,
      };
    }));

    const reverse = order === 'desc';
    if (sort === 'score') results.sort((a, b) => reverse ? b.score - a.score : a.score - b.score);
    else if (sort === 'change_pct') results.sort((a, b) => reverse ? b.change_pct - a.change_pct : a.change_pct - b.change_pct);
    else if (sort === 'volume') results.sort((a, b) => reverse ? b.volume - a.volume : a.volume - b.volume);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60');
    res.status(200).json({ ok: true, data: results.slice(0, +limit), total: results.length });
  } catch (e) {
    res.status(500).json({ ok: false, detail: e.message });
  }
}
