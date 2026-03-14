"""
技术分析引擎 - 计算指标并评分
"""
import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)


def calculate_ma(series: pd.Series, period: int) -> pd.Series:
    """计算移动平均线"""
    return series.rolling(window=period).mean()


def calculate_ema(series: pd.Series, period: int) -> pd.Series:
    """计算指数移动平均线"""
    return series.ewm(span=period, adjust=False).mean()


def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """计算 RSI 相对强弱指标"""
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi


def calculate_macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    """计算 MACD"""
    ema_fast = calculate_ema(series, fast)
    ema_slow = calculate_ema(series, slow)
    dif = ema_fast - ema_slow
    dea = calculate_ema(dif, signal)
    histogram = (dif - dea) * 2
    return dif, dea, histogram


def calculate_bollinger(series: pd.Series, period: int = 20, num_std: float = 2.0):
    """计算布林带"""
    ma = calculate_ma(series, period)
    std = series.rolling(window=period).std()
    upper = ma + num_std * std
    lower = ma - num_std * std
    return upper, ma, lower


def calculate_kdj(df: pd.DataFrame, n: int = 9, m1: int = 3, m2: int = 3):
    """计算 KDJ 指标"""
    low_list = df["low"].rolling(window=n, min_periods=1).min()
    high_list = df["high"].rolling(window=n, min_periods=1).max()
    rsv = (df["close"] - low_list) / (high_list - low_list).replace(0, np.nan) * 100
    rsv = rsv.fillna(50)

    k = rsv.ewm(com=m1 - 1, adjust=False).mean()
    d = k.ewm(com=m2 - 1, adjust=False).mean()
    j = 3 * k - 2 * d
    return k, d, j


def score_stock(df: pd.DataFrame) -> dict:
    """
    综合评分系统 (0-100)
    分数越高，潜力越大
    """
    if df is None or len(df) < 30:
        return {"score": 50, "details": {}, "signals": []}

    try:
        close = df["close"]
        volume = df["volume"]
        scores = {}
        signals = []

        # 1. RSI 评分 (权重 20%)
        rsi = calculate_rsi(close)
        rsi_val = rsi.iloc[-1] if not pd.isna(rsi.iloc[-1]) else 50
        if rsi_val < 25:
            rsi_score = 90
            signals.append("🟢 RSI 极度超卖，反弹机会大")
        elif rsi_val < 35:
            rsi_score = 75
            signals.append("🟢 RSI 偏低，可能有反弹")
        elif rsi_val < 50:
            rsi_score = 60
        elif rsi_val < 65:
            rsi_score = 45
        elif rsi_val < 75:
            rsi_score = 25
            signals.append("🔴 RSI 偏高，注意风险")
        else:
            rsi_score = 10
            signals.append("🔴 RSI 严重超买，回调风险大")
        scores["RSI"] = {"value": round(rsi_val, 1), "score": rsi_score, "weight": 0.20}

        # 2. MACD 评分 (权重 20%)
        dif, dea, hist = calculate_macd(close)
        dif_val = dif.iloc[-1] if not pd.isna(dif.iloc[-1]) else 0
        dea_val = dea.iloc[-1] if not pd.isna(dea.iloc[-1]) else 0
        hist_val = hist.iloc[-1] if not pd.isna(hist.iloc[-1]) else 0
        prev_hist = hist.iloc[-2] if len(hist) > 1 and not pd.isna(hist.iloc[-2]) else 0

        if dif_val > dea_val and hist_val > 0 and hist_val > prev_hist:
            macd_score = 90
            signals.append("🟢 MACD 金叉且柱线放大，强势看多")
        elif dif_val > dea_val and hist_val > 0:
            macd_score = 75
            signals.append("🟢 MACD 金叉，多头趋势")
        elif dif_val > dea_val:
            macd_score = 55
        elif dif_val < dea_val and hist_val < 0 and hist_val < prev_hist:
            macd_score = 10
            signals.append("🔴 MACD 死叉且柱线放大，弱势看空")
        elif dif_val < dea_val and hist_val < 0:
            macd_score = 25
            signals.append("🔴 MACD 死叉，空头趋势")
        else:
            macd_score = 40
        scores["MACD"] = {"dif": round(dif_val, 3), "dea": round(dea_val, 3),
                          "histogram": round(hist_val, 3), "score": macd_score, "weight": 0.20}

        # 3. 均线排列评分 (权重 15%)
        ma5 = calculate_ma(close, 5)
        ma10 = calculate_ma(close, 10)
        ma20 = calculate_ma(close, 20)
        ma60 = calculate_ma(close, 60)
        current = close.iloc[-1]
        v5 = ma5.iloc[-1]
        v10 = ma10.iloc[-1]
        v20 = ma20.iloc[-1]
        v60 = ma60.iloc[-1]

        ma_align = 50
        if not (pd.isna(v5) or pd.isna(v10) or pd.isna(v20) or pd.isna(v60)):
            above_all = current > v5 > v10 > v20 > v60
            above_mid = current > v5 > v10 > v20
            above_short = current > v5 > v10
            below_all = current < v5 < v10 < v20 < v60

            if above_all:
                ma_align = 95
                signals.append("🟢 多头完美排列（MA5>10>20>60），强势上涨")
            elif above_mid:
                ma_align = 78
                signals.append("🟢 均线多头排列，趋势向好")
            elif above_short:
                ma_align = 65
                signals.append("🟡 短期均线向好")
            elif below_all:
                ma_align = 10
                signals.append("🔴 均线空头排列，趋势较弱")
            else:
                ma_align = 40
                signals.append("🟡 均线缠绕，方向不明")

        scores["均线"] = {"MA5": round(v5, 2) if not pd.isna(v5) else None,
                          "MA10": round(v10, 2) if not pd.isna(v10) else None,
                          "MA20": round(v20, 2) if not pd.isna(v20) else None,
                          "MA60": round(v60, 2) if not pd.isna(v60) else None,
                          "score": ma_align, "weight": 0.15}

        # 4. 成交量趋势 (权重 15%)
        vol_ma5 = calculate_ma(volume, 5)
        vol_ma20 = calculate_ma(volume, 20)
        current_vol = volume.iloc[-1]
        vm5 = vol_ma5.iloc[-1]
        vm20 = vol_ma20.iloc[-1]

        vol_score = 50
        if not (pd.isna(vm5) or pd.isna(vm20)):
            # 放量上涨
            if current_vol > vm20 * 1.5 and close.iloc[-1] > close.iloc[-2]:
                vol_score = 85
                signals.append("🟢 放量上涨，资金进场")
            elif current_vol > vm20 * 1.2 and close.iloc[-1] > close.iloc[-2]:
                vol_score = 70
                signals.append("🟢 温和放量，买盘活跃")
            elif current_vol > vm20 * 1.5 and close.iloc[-1] < close.iloc[-2]:
                vol_score = 30
                signals.append("🔴 放量下跌，需警惕")
            elif current_vol < vm20 * 0.5:
                vol_score = 40
                signals.append("🟡 缩量明显，观望为主")

        scores["成交量"] = {"current": int(current_vol), "MA5": int(vm5) if not pd.isna(vm5) else None,
                           "score": vol_score, "weight": 0.15}

        # 5. 价格动量 (权重 15%)
        if len(close) >= 5:
            change_5d = (close.iloc[-1] / close.iloc[-5] - 1) * 100
        else:
            change_5d = 0

        if change_5d > 10:
            momentum_score = 70  # 涨太多反而可能是追高风险
            signals.append(f"🟡 5日涨幅 {change_5d:.1f}%，注意追高风险")
        elif change_5d > 3:
            momentum_score = 80
            signals.append(f"🟢 5日涨幅 {change_5d:.1f}%，势头良好")
        elif change_5d > 0:
            momentum_score = 70
        elif change_5d > -3:
            momentum_score = 55
        elif change_5d > -10:
            momentum_score = 40
            signals.append(f"🔴 5日跌幅 {change_5d:.1f}%，短期偏弱")
        else:
            momentum_score = 25
            signals.append(f"🔴 5日跌幅 {change_5d:.1f}%，持续走弱")

        scores["动量"] = {"5日涨幅": round(change_5d, 2), "score": momentum_score, "weight": 0.15}

        # 6. 布林带位置 (权重 15%)
        upper, middle, lower = calculate_bollinger(close)
        upper_val = upper.iloc[-1]
        lower_val = lower.iloc[-1]
        mid_val = middle.iloc[-1]

        boll_score = 50
        if not (pd.isna(upper_val) or pd.isna(lower_val)):
            boll_width = upper_val - lower_val
            if boll_width > 0:
                position = (current - lower_val) / boll_width
                if position < 0.1:
                    boll_score = 85
                    signals.append("🟢 触及布林下轨，可能超跌反弹")
                elif position < 0.3:
                    boll_score = 70
                elif position < 0.7:
                    boll_score = 50
                elif position < 0.9:
                    boll_score = 30
                else:
                    boll_score = 15
                    signals.append("🔴 触及布林上轨，可能短期回调")

        scores["布林带"] = {"upper": round(upper_val, 2) if not pd.isna(upper_val) else None,
                           "middle": round(mid_val, 2) if not pd.isna(mid_val) else None,
                           "lower": round(lower_val, 2) if not pd.isna(lower_val) else None,
                           "score": boll_score, "weight": 0.15}

        # 计算综合得分
        total_score = sum(
            scores[key]["score"] * scores[key]["weight"]
            for key in scores
        )
        total_score = round(min(max(total_score, 0), 100))

        return {
            "score": total_score,
            "details": scores,
            "signals": signals
        }

    except Exception as e:
        logger.error(f"评分计算失败: {e}")
        return {"score": 50, "details": {}, "signals": ["⚠️ 评分计算异常"]}


def get_market_overview(df: pd.DataFrame) -> dict:
    """生成大盘概览数据"""
    if df is None or df.empty:
        return {}

    total = len(df)
    up = len(df[df["change_pct"] > 0])
    down = len(df[df["change_pct"] < 0])
    flat = total - up - down
    limit_up = len(df[df["change_pct"] >= 9.9])
    limit_down = len(df[df["change_pct"] <= -9.9])
    avg_change = df["change_pct"].mean()
    total_turnover = df["turnover"].sum() if "turnover" in df.columns else 0

    return {
        "total": total,
        "up": up,
        "down": down,
        "flat": flat,
        "limit_up": limit_up,
        "limit_down": limit_down,
        "avg_change_pct": round(avg_change, 2),
        "total_turnover": round(total_turnover / 1e8, 2),  # 亿元
    }
