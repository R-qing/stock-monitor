from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.services.stock_data import get_all_stocks, get_stock_history, get_stock_realtime
from app.services.analysis import score_stock, calculate_ma, calculate_rsi, calculate_macd, calculate_bollinger, calculate_kdj

import pandas as pd


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        try:
            # 从路径提取股票代码: /api/stock/600519
            code = self.path.rstrip('/').split('/')[-1]

            rt = get_stock_realtime(code)
            if not rt:
                self._respond(404, {"ok": False, "detail": f"未找到股票 {code}"})
                return

            hist = get_stock_history(code, days=120)
            if hist is None or hist.empty:
                self._respond(404, {"ok": False, "detail": f"未找到 {code} 历史数据"})
                return

            close = hist["close"]
            volume = hist["volume"]

            ma5 = calculate_ma(close, 5)
            ma10 = calculate_ma(close, 10)
            ma20 = calculate_ma(close, 20)
            ma60 = calculate_ma(close, 60)
            rsi = calculate_rsi(close)
            dif, dea, hist_macd = calculate_macd(close)
            boll_upper, boll_mid, boll_lower = calculate_bollinger(close)
            k, d, j = calculate_kdj(hist)
            scoring = score_stock(hist)

            dates = hist["date"].tolist() if "date" in hist.columns else list(range(len(hist)))

            data = {
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
                        "pe": None, "pb": None, "turnover_rate": 0,
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
            self._respond(200, data)
        except Exception as e:
            self._respond(500, {"ok": False, "detail": str(e)})

    def _respond(self, code, data):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
