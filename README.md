# 智能股票监测系统

🚀 A股实时监测 + 技术分析 + 智能评分系统

## 功能
- 📊 实时行情监控（200只主要A股）
- 📈 K线图 + 技术指标（MA/MACD/RSI/KDJ/布林带）
- 🔥 综合评分系统（多维度分析潜力股）
- ⭐ 自选股管理
- 🎨 高科技暗色风格可视化

## 技术栈
- **后端**: Python + FastAPI
- **前端**: HTML/CSS/JS + ECharts
- **数据源**: 新浪财经 API
- **部署**: Docker / Render.com

## 本地运行
```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
访问 http://localhost:8000
