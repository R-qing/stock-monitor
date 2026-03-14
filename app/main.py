"""
智能股票监测系统 - FastAPI 主应用
"""
import sys
import os
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

# 确保能导入 services
sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd
import numpy as np
from datetime import datetime

from services.stock_data import get_all_stocks, get_stock_history, get_stock_realtime
from services.analysis import score_stock, get_market_overview, calculate_ma, calculate_rsi, calculate_macd, calculate_bollinger, calculate_kdj

# 配置日志
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="智能股票监测系统", version="1.0.0")

# 静态文件
static_path = Path(__file__).parent / "static"
templates_path = Path(__file__).parent / "templates"

app.mount("/static", StaticFiles(directory=str(static_path)), name="static")


# ---- 页面路由 ----

@app.get("/", response_class=HTMLResponse)
async def index():
    html_file = templates_path / "index.html"
    return HTMLResponse(content=html_file.read_text(encoding="utf-8"))


# ---- API 路由 ----

@app.get("/api/market/overview")
async def market_overview():
    """大盘概览"""
    try:
        df = get_all_stocks()
        overview = get_market_overview(df)
        overview["time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return {"ok": True, "data": overview}
    except Exception as e:
        logger.error(f"大盘概览失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stocks")
async def list_stocks(
    sort: str = Query("score", description="排序字段: score/change_pct/volume"),
    order: str = Query("desc", description="排序方向: asc/desc"),
    limit: int = Query(100, description="返回数量"),
    keyword: str = Query("", description="搜索关键词（股票代码或名称）")
):
    """获取股票列表（含评分）"""
    try:
        df = get_all_stocks()

        if keyword:
            mask = df["code"].str.contains(keyword, na=False) | df["name"].str.contains(keyword, na=False)
            df = df[mask]

        results = []
        for _, row in df.iterrows():
            code = str(row["code"])
            try:
                hist = get_stock_history(code, days=60)
                scoring = score_stock(hist)
            except Exception:
                scoring = {"score": 50, "details": {}, "signals": []}

            results.append({
                "code": code,
                "name": row["name"],
                "price": float(row.get("price", 0)),
                "change_pct": float(row.get("change_pct", 0)),
                "change_amount": float(row.get("change_amount", 0)),
                "volume": float(row.get("volume", 0)),
                "turnover": float(row.get("turnover", 0)),
                "pe": None,
                "pb": None,
                "turnover_rate": 0,
                "score": scoring["score"],
                "signals": scoring["signals"],
            })

        # 排序
        reverse = order == "desc"
        if sort == "score":
            results.sort(key=lambda x: x["score"], reverse=reverse)
        elif sort == "change_pct":
            results.sort(key=lambda x: x["change_pct"], reverse=reverse)
        elif sort == "volume":
            results.sort(key=lambda x: x["volume"], reverse=reverse)

        return {"ok": True, "data": results[:limit], "total": len(results)}

    except Exception as e:
        logger.error(f"获取股票列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stock/{code}")
async def stock_detail(code: str):
    """个股详情（含完整分析）"""
    try:
        # 实时行情
        rt = get_stock_realtime(code)
        if not rt:
            raise HTTPException(status_code=404, detail=f"未找到股票 {code}")

        # 历史数据
        hist = get_stock_history(code, days=120)
        if hist is None or hist.empty:
            raise HTTPException(status_code=404, detail=f"未找到 {code} 的历史数据")

        # 技术分析
        close = hist["close"]
        volume = hist["volume"]

        # 计算各指标
        ma5 = calculate_ma(close, 5)
        ma10 = calculate_ma(close, 10)
        ma20 = calculate_ma(close, 20)
        ma60 = calculate_ma(close, 60)
        rsi = calculate_rsi(close)
        dif, dea, hist_macd = calculate_macd(close)
        boll_upper, boll_mid, boll_lower = calculate_bollinger(close)
        k, d, j = calculate_kdj(hist)

        # 评分
        scoring = score_stock(hist)

        # 构建返回数据
        dates = hist["date"].tolist() if "date" in hist.columns else list(range(len(hist)))

        return {
            "ok": True,
            "data": {
                "basic": {
                    "code": code,
                    "name": rt.get("name", ""),
                    "price": float(rt.get("price", 0)),
                    "change_pct": float(rt.get("change_pct", 0)),
                    "change_amount": float(rt.get("change_amount", 0)),
                    "open": float(rt.get("open", 0)),
                    "high": float(rt.get("high", 0)),
                    "low": float(rt.get("low", 0)),
                    "prev_close": float(rt.get("prev_close", 0)),
                    "volume": float(rt.get("volume", 0)),
                    "turnover": float(rt.get("turnover", 0)),
                    "pe": None,
                    "pb": None,
                    "turnover_rate": 0,
                },
                "kline": {
                    "dates": [str(d) for d in dates],
                    "open": [round(float(v), 2) for v in hist["open"].tolist()],
                    "close": [round(float(v), 2) for v in close.tolist()],
                    "high": [round(float(v), 2) for v in hist["high"].tolist()],
                    "low": [round(float(v), 2) for v in hist["low"].tolist()],
                    "volume": [int(v) for v in volume.tolist()],
                },
                "indicators": {
                    "ma5": [round(float(v), 2) if not pd.isna(v) else None for v in ma5.tolist()],
                    "ma10": [round(float(v), 2) if not pd.isna(v) else None for v in ma10.tolist()],
                    "ma20": [round(float(v), 2) if not pd.isna(v) else None for v in ma20.tolist()],
                    "ma60": [round(float(v), 2) if not pd.isna(v) else None for v in ma60.tolist()],
                    "rsi": [round(float(v), 1) if not pd.isna(v) else None for v in rsi.tolist()],
                    "macd": {
                        "dif": [round(float(v), 3) if not pd.isna(v) else None for v in dif.tolist()],
                        "dea": [round(float(v), 3) if not pd.isna(v) else None for v in dea.tolist()],
                        "histogram": [round(float(v), 3) if not pd.isna(v) else None for v in hist_macd.tolist()],
                    },
                    "bollinger": {
                        "upper": [round(float(v), 2) if not pd.isna(v) else None for v in boll_upper.tolist()],
                        "middle": [round(float(v), 2) if not pd.isna(v) else None for v in boll_mid.tolist()],
                        "lower": [round(float(v), 2) if not pd.isna(v) else None for v in boll_lower.tolist()],
                    },
                    "kdj": {
                        "k": [round(float(v), 1) if not pd.isna(v) else None for v in k.tolist()],
                        "d": [round(float(v), 1) if not pd.isna(v) else None for v in d.tolist()],
                        "j": [round(float(v), 1) if not pd.isna(v) else None for v in j.tolist()],
                    },
                },
                "score": scoring,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取 {code} 详情失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/hot")
async def hot_stocks():
    """热门潜力股（活跃股中评分最高的）"""
    try:
        df = get_all_stocks()

        # 筛选活跃股（成交量高于平均）
        avg_vol = df["volume"].mean()
        active = df[df["volume"] > avg_vol * 0.5].copy()

        # 对活跃股做评分
        results = []
        for _, row in active.iterrows():
            code = str(row["code"])
            try:
                hist = get_stock_history(code, days=60)
                scoring = score_stock(hist)
            except Exception:
                scoring = {"score": 50, "details": {}, "signals": []}

            results.append({
                "code": code,
                "name": row["name"],
                "price": float(row["price"]),
                "change_pct": float(row.get("change_pct", 0)),
                "turnover_rate": 0,
                "score": scoring["score"],
                "signals": scoring["signals"],
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return {"ok": True, "data": results[:20]}

    except Exception as e:
        logger.error(f"获取热门股失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
