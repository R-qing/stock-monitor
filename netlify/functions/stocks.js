import { fetchAllStocks, fetchStockHistory } from '../../lib/stock-data.js';
import { scoreStock, quickScore } from '../../lib/analysis.js';

const handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*' };
  try {
    const params = new URLSearchParams(event.queryStringParameters || '');
    const sort = params.get('sort') || 'score';
    const order = params.get('order') || 'desc';
    const limit = parseInt(params.get('limit') || '100');
    const keyword = params.get('keyword') || '';
    let stocks = await fetchAllStocks();

    if (keyword) {
      const kw = keyword.toLowerCase();
      stocks = stocks.filter(s => s.code.includes(kw) || s.name.toLowerCase().includes(kw));
    }

    // 列表页用快速评分避免超时
    const results = stocks.slice(0, limit * 2).map(s => {
      const scoring = quickScore(s);
      return {
        code: s.code, name: s.name, price: s.price,
        change_pct: s.change_pct, change_amount: s.change_amount,
        volume: s.volume, turnover: s.turnover || 0,
        pe: null, pb: null, turnover_rate: 0,
        score: scoring.score, signals: scoring.signals,
      };
    });

    const reverse = order === 'desc';
    if (sort === 'score') results.sort((a, b) => reverse ? b.score - a.score : a.score - b.score);
    else if (sort === 'change_pct') results.sort((a, b) => reverse ? b.change_pct - a.change_pct : a.change_pct - b.change_pct);
    else if (sort === 'volume') results.sort((a, b) => reverse ? b.volume - a.volume : a.volume - b.volume);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: results.slice(0, limit), total: results.length }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, detail: e.message }) };
  }
};

export { handler };
