from http.server import BaseHTTPRequestHandler
import json
import sys
import os
from urllib.parse import urlparse, parse_qs

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
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            sort = params.get('sort', ['score'])[0]
            order = params.get('order', ['desc'])[0]
            limit = int(params.get('limit', ['100'])[0])
            keyword = params.get('keyword', [''])[0]

            df = get_all_stocks()

            if keyword:
                mask = df['code'].str.contains(keyword, na=False) | df['name'].str.contains(keyword, na=False)
                df = df[mask]

            results = []
            for _, row in df.iterrows():
                code = str(row['code'])
                try:
                    hist = get_stock_history(code, days=60)
                    scoring = score_stock(hist)
                except Exception:
                    scoring = {"score": 50, "details": {}, "signals": []}

                results.append({
                    "code": code,
                    "name": row['name'],
                    "price": float(row.get('price', 0)),
                    "change_pct": float(row.get('change_pct', 0)),
                    "change_amount": float(row.get('change_amount', 0)),
                    "volume": float(row.get('volume', 0)),
                    "turnover": float(row.get('turnover', 0)),
                    "pe": None, "pb": None, "turnover_rate": 0,
                    "score": scoring["score"],
                    "signals": scoring["signals"],
                })

            reverse = order == "desc"
            if sort == "score":
                results.sort(key=lambda x: x["score"], reverse=reverse)
            elif sort == "change_pct":
                results.sort(key=lambda x: x["change_pct"], reverse=reverse)
            elif sort == "volume":
                results.sort(key=lambda x: x["volume"], reverse=reverse)

            self._respond(200, {"ok": True, "data": results[:limit], "total": len(results)})
        except Exception as e:
            self._respond(500, {"ok": False, "detail": str(e)})

    def _respond(self, code, data):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
