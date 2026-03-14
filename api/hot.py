from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.stock_data import get_all_stocks, get_stock_history
from app.services.analysis import score_stock


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        try:
            df = get_all_stocks()
            avg_vol = df["volume"].mean()
            active = df[df["volume"] > avg_vol * 0.5].copy()

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
            self._respond(200, {"ok": True, "data": results[:20]})
        except Exception as e:
            self._respond(500, {"ok": False, "detail": str(e)})

    def _respond(self, code, data):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
