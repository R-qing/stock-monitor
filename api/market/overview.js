import { fetchAllStocks } from '../../lib/stock-data.js';
import { getMarketOverview } from '../../lib/analysis.js';

export default async function handler(req, res) {
  try {
    const stocks = await fetchAllStocks();
    const overview = getMarketOverview(stocks);
    overview.time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=30');
    res.status(200).json({ ok: true, data: overview });
  } catch (e) {
    res.status(500).json({ ok: false, detail: e.message });
  }
}
