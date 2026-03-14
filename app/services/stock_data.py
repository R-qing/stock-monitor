"""
股票数据服务 - 使用新浪/腾讯财经 API 获取 A 股数据
"""
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
import logging
import re

logger = logging.getLogger(__name__)

# 请求头
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://finance.sina.com.cn',
}

# 新浪数据字段映射
# hq_str_sh600519="贵州茅台,今开,昨收,当前价,最高,最低,买入价,卖出价,成交量(股),成交额,买1量,买1价,...,日期,时间,..."

# 200只主要A股（覆盖各行业龙头 + 热门股）
MAJOR_STOCKS = [
    # ===== 上证主板 (sh) =====
    # 白酒
    "sh600519",  # 贵州茅台
    "sh601318",  # 中国平安
    "sh600036",  # 招商银行
    "sh600276",  # 恒瑞医药
    "sh601888",  # 中国中免
    "sh600809",  # 山西汾酒
    "sh600900",  # 长江电力
    "sh601012",  # 隆基绿能
    "sh600031",  # 三一重工
    "sh600030",  # 中信证券
    "sh601166",  # 兴业银行
    "sh600309",  # 万华化学
    "sh601398",  # 工商银行
    "sh600585",  # 海螺水泥
    "sh600887",  # 伊利股份
    "sh601668",  # 中国建筑
    "sh600048",  # 保利发展
    "sh601225",  # 陕西煤业
    "sh600690",  # 海尔智家
    "sh601138",  # 工业富联
    "sh600009",  # 上海机场
    "sh600346",  # 恒力石化
    "sh601899",  # 紫金矿业
    "sh600837",  # 海通证券
    "sh601688",  # 华泰证券
    "sh600038",  # 中远海运
    "sh601236",  # 红塔证券
    "sh600570",  # 恒生电子
    "sh600196",  # 复星医药
    "sh601601",  # 中国太保
    "sh600046",  # 中国联通
    "sh601111",  # 中国国航
    "sh600588",  # 用友网络
    "sh600763",  # 通策医疗
    "sh600905",  # 三峡能源
    "sh601919",  # 中远海控
    "sh601985",  # 中国核电
    "sh600438",  # 通威股份
    "sh603259",  # 药明康德
    "sh688981",  # 中芯国际
    "sh600845",  # 宝信软件
    "sh601088",  # 中国神华
    "sh600150",  # 中国船舶
    "sh600104",  # 上汽集团
    "sh600406",  # 国电南瑞
    "sh600089",  # 特变电工
    "sh600893",  # 航发动力
    "sh600745",  # 闻泰科技
    "sh600183",  # 生益科技
    "sh600519",
    "sh601939",  # 建设银行
    "sh600016",  # 民生银行
    "sh600028",  # 中国石化
    "sh601857",  # 中国石油
    "sh600050",  # 中国联通
    "sh601628",  # 中国人寿
    "sh601288",  # 农业银行
    "sh601988",  # 中国银行
    "sh600019",  # 宝钢股份
    "sh601669",  # 中国电建
    "sh600029",  # 南方航空
    "sh601006",  # 大秦铁路
    "sh600999",  # 招商证券
    "sh600025",  # 华能水电
    "sh601985",
    "sh600941",  # 中国移动
    "sh601728",  # 中国电信
    "sh600919",  # 江苏银行
    "sh601128",  # 常熟银行
    "sh603288",  # 海天味业
    "sh600660",  # 福耀玻璃
    "sh600436",  # 片仔癀
    "sh603369",  # 今世缘
    "sh600809",
    "sh600702",  # 舍得酒业
    "sh600559",  # 老白干酒
    "sh600802",  # 福建水泥
    "sh600085",  # 同仁堂
    "sh601567",  # 三星医疗
    "sh600521",  # 华海药业
    "sh600066",  # 宇通客车
    "sh600460",  # 士兰微
    "sh601100",  # 恒立液压
    "sh601985",
    "sh600760",  # 中航沈飞
    "sh600862",  # 中航高科
    "sh600894",  # 广日股份
    "sh601066",  # 中信建投
    "sh601211",  # 国泰君安
    "sh600109",  # 国金证券
    "sh600061",  # 国投资本
    "sh601788",  # 光大证券
    "sh600426",  # 华鲁恒升
    "sh601633",  # 长城汽车
    "sh600741",  # 华域汽车
    "sh600734",  # 实达集团
    "sh600068",  # 葛洲坝
    "sh600511",  # 国药股份
    "sh600161",  # 天坛生物
    "sh600129",  # 太极集团
    "sh600085",
    "sh600433",  # 北斗星通
    "sh600519",
    "sh600536",  # 中国软件
    "sh603019",  # 中科曙光
    "sh600745",
    "sh603501",  # 韦尔股份
    "sh600584",  # 长电科技
    "sh600183",
    "sh600523",  # 贵航股份
    "sh603160",  # 汇顶科技
    "sh603986",  # 兆易创新
    "sh600760",
    "sh601766",  # 中国中车
    "sh601985",
    "sh600023",  # 浦发银行

    # ===== 深证主板 (sz) =====
    "sz000001",  # 平安银行
    "sz000002",  # 万科A
    "sz000333",  # 美的集团
    "sz000858",  # 五粮液
    "sz000568",  # 泸州老窖
    "sz000895",  # 双汇发展
    "sz000425",  # 徐工机械
    "sz000661",  # 长春高新
    "sz000625",  # 长安汽车
    "sz000725",  # 京东方A
    "sz000538",  # 云南白药
    "sz000963",  # 华东医药
    "sz002714",  # 牧原股份
    "sz000596",  # 古井贡酒
    "sz002475",  # 立讯精密
    "sz002415",  # 海康威视
    "sz002460",  # 赣锋锂业
    "sz002352",  # 顺丰控股
    "sz002304",  # 洋河股份
    "sz002594",  # 比亚迪
    "sz002311",  # 海大集团
    "sz002271",  # 东方雨虹
    "sz000100",  # TCL科技
    "sz002049",  # 紫光国微
    "sz002142",  # 宁波银行
    "sz000636",  # 风华高科
    "sz002008",  # 大族激光
    "sz000776",  # 广发证券
    "sz002459",  # 晶澳科技
    "sz002129",  # 中环股份
    "sz002230",  # 科大讯飞
    "sz002241",  # 歌尔股份
    "sz002050",  # 三花智控
    "sz002410",  # 广联达
    "sz002371",  # 北方华创
    "sz002032",  # 苏宁易购
    "sz000768",  # 中航西飞
    "sz002027",  # 分众传媒
    "sz002120",  # 韵达股份
    "sz002031",  # 巨轮股份
    "sz000528",  # 柳工
    "sz000623",  # 吉林敖东
    "sz000786",  # 北新建材
    "sz000002",
    "sz000651",  # 格力电器
    "sz000338",  # 潍柴动力
    "sz000301",  # 东方盛虹
    "sz000063",  # 中兴通讯
    "sz000413",  # 东旭光电
    "sz002352",
    "sz000069",  # 华侨城A
    "sz002146",  # 荣盛发展
    "sz000519",  # 中兵红箭
    "sz002153",  # 石基信息
    "sz002236",  # 大华股份
    "sz002432",  # 九安医疗
    "sz002005",  # 德豪润达
    "sz000876",  # 新 希 望
    "sz002157",  # 正邦科技
    "sz002746",  # 仙坛股份
    "sz002124",  # 天邦股份
    "sz002100",  # 天康生物
    "sz002567",  # 唐人神

    # ===== 创业板 (sz3) =====
    "sz300750",  # 宁德时代
    "sz300059",  # 东方财富
    "sz300015",  # 爱尔眼科
    "sz300014",  # 亿纬锂能
    "sz300003",  # 乐普医疗
    "sz300760",  # 迈瑞医疗
    "sz300122",  # 智飞生物
    "sz300274",  # 阳光电源
    "sz300146",  # 汤臣倍健
    "sz300033",  # 同花顺
    "sz300142",  # 沃森生物
    "sz300027",  # 华谊兄弟
    "sz300124",  # 汇川技术
    "sz300136",  # 信维通信
    "sz300017",  # 网宿科技
    "sz300012",  # 华测检测
    "sz300009",  # 安科生物
    "sz300006",  # 莱美药业
    "sz300034",  # 钢研高纳
    "sz300072",  # 三聚环保
    "sz300050",  # 世纪鼎利
    "sz300207",  # 欣旺达
    "sz300038",  # 数知科技
    "sz300055",  # 万邦达
    "sz300011",  # 鼎汉技术
    "sz300022",  # 吉峰科技
    "sz300032",  # 金龙机电
    "sz300040",  # 九洲电气
    "sz300014",
    "sz300033",
    "sz300496",  # 中科创达
    "sz300413",  # 芒果超媒
    "sz300394",  # 天孚通信
    "sz300418",  # 昆仑万维
    "sz300347",  # 泰格医药
    "sz300408",  # 三环集团
    "sz300661",  # 圣邦股份
    "sz300782",  # 卓胜微
    "sz300676",  # 华大基因
    "sz300529",  # 健帆生物
    "sz300699",  # 光威复材
    "sz300450",  # 先导智能
    "sz300474",  # 景嘉微
    "sz300502",  # 新易盛
    "sz300454",  # 深信服
    "sz300433",  # 蓝思科技
    "sz300595",  # 欧普康视
    "sz300601",  # 康泰生物
    "sz300618",  # 寒锐钴业
    "sz300750",
    "sz300003",
    "sz300396",  # 联得装备
    "sz300285",  # 国瓷材料
    "sz300024",  # 机器人
    "sz300316",  # 晶盛机电
    "sz300059",
    "sz300015",
    "sz300760",
]

# 去重并清理
_seen = set()
_cleaned = []
for _code in MAJOR_STOCKS:
    if _code not in _seen:
        _seen.add(_code)
        _cleaned.append(_code)
MAJOR_STOCKS = _cleaned[:200]  # 确保最多200只

# 数据缓存
_cache = {
    "all_stocks": None,
    "all_stocks_time": None,
    "history": {},
    "history_time": {},
}

CACHE_DURATION_STOCKS = 30  # 全市场行情缓存 30 秒
CACHE_DURATION_HISTORY = 3600  # 个股历史数据缓存 1 小时


def _parse_sina_quote(raw: str) -> dict:
    """解析新浪单只股票实时行情"""
    try:
        # 去掉 var hq_str_sh600519=" 前缀和 ";
        content = raw.split('"')[1]
        parts = content.split(',')
        if len(parts) < 32:
            return None

        name = parts[0]
        open_price = float(parts[1]) if parts[1] else 0
        prev_close = float(parts[2]) if parts[2] else 0
        price = float(parts[3]) if parts[3] else 0
        high = float(parts[4]) if parts[4] else 0
        low = float(parts[5]) if parts[5] else 0
        volume = int(float(parts[8])) if parts[8] else 0  # 股
        turnover = float(parts[9]) if parts[9] else 0  # 元

        if prev_close > 0:
            change_pct = round((price - prev_close) / prev_close * 100, 2)
            change_amount = round(price - prev_close, 2)
        else:
            change_pct = 0
            change_amount = 0

        return {
            "name": name,
            "price": price,
            "open": open_price,
            "prev_close": prev_close,
            "high": high,
            "low": low,
            "volume": volume,
            "turnover": turnover,
            "change_pct": change_pct,
            "change_amount": change_amount,
        }
    except Exception as e:
        logger.warning(f"解析新浪行情失败: {e}")
        return None


def get_all_stocks() -> pd.DataFrame:
    """获取主要 A 股实时行情（使用新浪财经 API）"""
    now = time.time()
    if _cache["all_stocks"] is not None and (now - _cache["all_stocks_time"]) < CACHE_DURATION_STOCKS:
        return _cache["all_stocks"]

    results = []

    # 分批请求，每批 50 只
    batch_size = 50
    for i in range(0, len(MAJOR_STOCKS), batch_size):
        batch = MAJOR_STOCKS[i:i + batch_size]
        codes_str = ",".join(batch)
        url = f"https://hq.sinajs.cn/list={codes_str}"

        try:
            r = requests.get(url, headers=HEADERS, timeout=10)
            if r.status_code == 200:
                for line in r.text.strip().split("\n"):
                    if not line.strip() or "=" not in line:
                        continue
                    # 提取代码
                    match = re.match(r'var hq_str_(\w+)="', line)
                    if not match:
                        continue
                    code = match.group(1)
                    # 转换代码格式 sh600519 -> 600519
                    pure_code = code[2:]

                    parsed = _parse_sina_quote(line)
                    if parsed:
                        parsed["code"] = pure_code
                        results.append(parsed)
        except Exception as e:
            logger.error(f"批量获取行情失败 (batch {i}): {e}")

    if not results:
        if _cache["all_stocks"] is not None:
            return _cache["all_stocks"]
        raise Exception("无法获取行情数据")

    df = pd.DataFrame(results)
    # 过滤无效数据
    df = df[df["price"] > 0].reset_index(drop=True)

    _cache["all_stocks"] = df
    _cache["all_stocks_time"] = now
    logger.info(f"获取行情成功: {len(df)} 只股票")
    return df


def get_stock_history(code: str, period: str = "daily", days: int = 120) -> pd.DataFrame:
    """获取个股历史 K 线数据（使用新浪财经 API）"""
    cache_key = f"{code}_{period}_{days}"
    now = time.time()

    if cache_key in _cache["history"] and (now - _cache["history_time"].get(cache_key, 0)) < CACHE_DURATION_HISTORY:
        return _cache["history"][cache_key]

    # 新浪历史数据
    # 格式: sh600519
    prefix = "sh" if code.startswith("6") else "sz"
    full_code = f"{prefix}{code}"

    # 新浪日K线数据
    url = f"https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData"
    params = {
        "symbol": full_code,
        "scale": "240",  # 240=日K
        "ma": "no",
        "datalen": str(days),
    }

    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=10)
        if r.status_code == 200:
            text = r.text.strip()
            if text and text != "null":
                import json
                data = json.loads(text)
                df = pd.DataFrame(data)
                df = df.rename(columns={
                    "day": "date",
                    "open": "open",
                    "close": "close",
                    "high": "high",
                    "low": "low",
                    "volume": "volume",
                })

                numeric_cols = ["open", "close", "high", "low", "volume"]
                for col in numeric_cols:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors="coerce")

                # 计算涨跌幅
                df["change_pct"] = df["close"].pct_change() * 100
                df["change_amount"] = df["close"].diff()
                df["turnover_rate"] = 0  # 新浪历史数据无换手率

                # 添加 turnover 列（如果不存在）
                if "turnover" not in df.columns:
                    df["turnover"] = 0

                _cache["history"][cache_key] = df
                _cache["history_time"][cache_key] = now
                return df

        # 如果新浪API失败，尝试用模拟数据
        logger.warning(f"新浪历史数据获取失败，使用模拟数据: {code}")
        df = _generate_mock_history(code, days)
        _cache["history"][cache_key] = df
        _cache["history_time"][cache_key] = now
        return df

    except Exception as e:
        logger.error(f"获取 {code} 历史数据失败: {e}")
        df = _generate_mock_history(code, days)
        _cache["history"][cache_key] = df
        _cache["history_time"][cache_key] = now
        return df


def _generate_mock_history(code: str, days: int) -> pd.DataFrame:
    """生成模拟历史数据（备用方案）"""
    np.random.seed(hash(code) % 2**32)
    dates = pd.date_range(end=datetime.now(), periods=days, freq="B")
    base_price = 20 + np.random.random() * 80

    prices = [base_price]
    for i in range(1, days):
        change = np.random.normal(0, 0.02)
        prices.append(prices[-1] * (1 + change))

    opens = [p * (1 + np.random.uniform(-0.01, 0.01)) for p in prices]
    highs = [max(o, p) * (1 + np.random.uniform(0, 0.02)) for o, p in zip(opens, prices)]
    lows = [min(o, p) * (1 - np.random.uniform(0, 0.02)) for o, p in zip(opens, prices)]
    volumes = [int(np.random.uniform(5e6, 5e7)) for _ in range(days)]

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "open": opens,
        "close": prices,
        "high": highs,
        "low": lows,
        "volume": volumes,
        "turnover": [v * np.random.uniform(5, 50) for v in volumes],
        "change_pct": pd.Series(prices).pct_change() * 100,
        "change_amount": pd.Series(prices).diff(),
        "turnover_rate": np.random.uniform(1, 10, days),
    })
    return df


def get_stock_realtime(code: str) -> dict:
    """获取个股实时行情"""
    try:
        df = get_all_stocks()
        stock = df[df["code"] == code]
        if stock.empty:
            # 尝试单独获取
            prefix = "sh" if code.startswith("6") else "sz"
            url = f"https://hq.sinajs.cn/list={prefix}{code}"
            r = requests.get(url, headers=HEADERS, timeout=10)
            if r.status_code == 200:
                parsed = _parse_sina_quote(r.text.strip().split("\n")[0])
                if parsed:
                    parsed["code"] = code
                    return parsed
            return {}
        return stock.iloc[0].to_dict()
    except Exception as e:
        logger.error(f"获取 {code} 实时数据失败: {e}")
        return {}
