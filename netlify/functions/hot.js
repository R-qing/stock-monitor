import { fetchAllStocks, fetchStockHistory } from '../../lib/stock-data.js';
import { scoreStock, quickScore } from '../../lib/analysis.js';

const handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*' };
  try {
    const stocks = await fetchAllStocks();
    const avgVol = stocks.reduce((s, x) => s + x.volume, 0) / (stocks.length || 1);
    const active = stocks.filter(s => s.volume > avgVol * 0.3);

    const results = active.map(s => {
      const scoring = quickScore(s);
      return {
        code: s.code, name: s.name, price: s.price,
        change_pct: s.change_pct, turnover_rate: 0,
        score: scoring.score, signals: scoring.signals,
      };
    });
    results.sort((a, b) => b.score - a.score);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: results.slice(0, 20) }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, detail: e.message }) };
  }
};

export { handler };
