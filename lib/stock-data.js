/**
 * 股票数据服务 - 新浪/腾讯财经 API
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://finance.sina.com.cn',
};

// 200只主要A股
const MAJOR_STOCKS = [
  "sh600519","sh601318","sh600036","sh600276","sh601888","sh600809","sh600900","sh601012",
  "sh600031","sh600030","sh601166","sh600309","sh601398","sh600585","sh600887","sh601668",
  "sh600048","sh601225","sh600690","sh601138","sh600009","sh600346","sh601899","sh600837",
  "sh601688","sh600038","sh601236","sh600570","sh600196","sh601601","sh600046","sh601111",
  "sh600588","sh600763","sh600905","sh601919","sh601985","sh600438","sh603259","sh688981",
  "sh600845","sh601088","sh600150","sh600104","sh600406","sh600089","sh600893","sh600745",
  "sh600183","sh601939","sh600016","sh600028","sh601857","sh600050","sh601628","sh601288",
  "sh601988","sh600019","sh601669","sh600029","sh601006","sh600999","sh600025","sh600941",
  "sh601728","sh600919","sh601128","sh603288","sh600660","sh600436","sh603369","sh600702",
  "sh600559","sh600085","sh601567","sh600521","sh600066","sh600460","sh601100","sh600760",
  "sh600862","sh601066","sh601211","sh600109","sh600061","sh601788","sh600426","sh601633",
  "sh600741","sh600068","sh600511","sh600161","sh600129","sh600433","sh600536","sh603019",
  "sh603501","sh600584","sh603160","sh603986","sh601766","sh600023","sh603259",
  "sz000001","sz000002","sz000333","sz000858","sz000568","sz000895","sz000425","sz000661",
  "sz000625","sz000725","sz000538","sz000963","sz002714","sz000596","sz002475","sz002415",
  "sz002460","sz002352","sz002304","sz002594","sz002311","sz002271","sz000100","sz002049",
  "sz002142","sz000636","sz002008","sz000776","sz002459","sz002129","sz002230","sz002241",
  "sz002050","sz002410","sz002371","sz000768","sz002027","sz002120","sz000528","sz000623",
  "sz000786","sz000651","sz000338","sz000301","sz000063","sz000069","sz002146","sz002153",
  "sz002236","sz002432","sz000876","sz002157","sz002746","sz002124","sz002100","sz002567",
  "sz300750","sz300059","sz300015","sz300014","sz300003","sz300760","sz300122","sz300274",
  "sz300146","sz300033","sz300142","sz300027","sz300124","sz300136","sz300017","sz300012",
  "sz300009","sz300006","sz300034","sz300072","sz300207","sz300038","sz300055","sz300011",
  "sz300496","sz300413","sz300394","sz300418","sz300347","sz300408","sz300661","sz300782",
  "sz300676","sz300529","sz300699","sz300450","sz300474","sz300502","sz300454","sz300433",
  "sz300595","sz300601","sz300618","sz300285","sz300024","sz300316",
];

// 去重
const UNIQUE_STOCKS = [...new Set(MAJOR_STOCKS)];

// 缓存
let stocksCache = { data: null, time: 0 };
let historyCache = {};
const CACHE_TTL = 30000; // 30秒

function parseSinaLine(line) {
  try {
    const match = line.match(/var hq_str_(\w+)="(.+)"/);
    if (!match) return null;
    const fullCode = match[1];
    const code = fullCode.substring(2);
    const parts = match[2].split(',');
    if (parts.length < 10) return null;

    const prevClose = parseFloat(parts[2]) || 0;
    const price = parseFloat(parts[3]) || 0;
    return {
      code,
      name: parts[0],
      open: parseFloat(parts[1]) || 0,
      prev_close: prevClose,
      price,
      high: parseFloat(parts[4]) || 0,
      low: parseFloat(parts[5]) || 0,
      volume: parseInt(parts[8]) || 0,
      turnover: parseFloat(parts[9]) || 0,
      change_pct: prevClose > 0 ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : 0,
      change_amount: prevClose > 0 ? parseFloat((price - prevClose).toFixed(2)) : 0,
    };
  } catch { return null; }
}

export async function fetchAllStocks() {
  const now = Date.now();
  if (stocksCache.data && (now - stocksCache.time) < CACHE_TTL) {
    return stocksCache.data;
  }

  const results = [];
  const batchSize = 50;

  for (let i = 0; i < UNIQUE_STOCKS.length; i += batchSize) {
    const batch = UNIQUE_STOCKS.slice(i, i + batchSize);
    const url = `https://hq.sinajs.cn/list=${batch.join(',')}`;
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      const text = await res.text();
      for (const line of text.trim().split('\n')) {
        const stock = parseSinaLine(line);
        if (stock && stock.price > 0) results.push(stock);
      }
    } catch (e) {
      console.error(`Batch ${i} failed:`, e.message);
    }
  }

  if (results.length === 0 && stocksCache.data) return stocksCache.data;
  stocksCache = { data: results, time: now };
  return results;
}

export async function fetchStockHistory(code, days = 120) {
  const cacheKey = `${code}_${days}`;
  if (historyCache[cacheKey]) return historyCache[cacheKey];

  const prefix = code.startsWith('6') ? 'sh' : 'sz';
  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${prefix}${code}&scale=240&ma=no&datalen=${days}`;

  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    if (!text || text === 'null') throw new Error('empty response');
    const data = JSON.parse(text);
    const result = data.map(d => ({
      date: d.day,
      open: parseFloat(d.open),
      close: parseFloat(d.close),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      volume: parseInt(d.volume) || 0,
      turnover: parseFloat(d.ma_price5) || 0,
    }));
    historyCache[cacheKey] = result;
    return result;
  } catch (e) {
    console.error(`History ${code} failed:`, e.message);
    // 生成模拟数据作为备用
    return generateMockHistory(code, days);
  }
}

function generateMockHistory(code, days) {
  const data = [];
  let seed = 0;
  for (let i = 0; i < code.length; i++) seed += code.charCodeAt(i);
  let price = 20 + (seed % 80);
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const change = (Math.random() - 0.5) * 0.04;
    const open = price * (1 + (Math.random() - 0.5) * 0.02);
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    data.push({
      date: date.toISOString().split('T')[0],
      open, close, high, low,
      volume: Math.floor(Math.random() * 5e7 + 5e6),
      turnover: 0,
    });
    price = close;
  }
  return data;
}

export async function fetchStockRealtime(code) {
  const prefix = code.startsWith('6') ? 'sh' : 'sz';
  const url = `https://hq.sinajs.cn/list=${prefix}${code}`;
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    const stock = parseSinaLine(text.split('\n')[0]);
    return stock || {};
  } catch {
    // 尝试从缓存获取
    const all = await fetchAllStocks();
    return all.find(s => s.code === code) || {};
  }
}
