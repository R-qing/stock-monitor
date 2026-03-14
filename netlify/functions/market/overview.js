import { fetchAllStocks } from '../../lib/stock-data.js';
import { getMarketOverview } from '../../lib/analysis.js';

const handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*' };
  try {
    const stocks = await fetchAllStocks();
    const overview = getMarketOverview(stocks);
    overview.time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: overview }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, detail: e.message }) };
  }
};

export { handler };
