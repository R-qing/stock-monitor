#!/bin/bash
# 快速启动脚本

echo "🚀 智能股票监测系统 - 启动中..."

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 Python3，请先安装 Python 3.9+"
    exit 1
fi

# 创建虚拟环境
if [ ! -d "venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
echo "📦 安装依赖..."
pip install -r requirements.txt -q -i https://pypi.tuna.tsinghua.edu.cn/simple

# 启动服务
echo "✅ 启动服务..."
echo "🌐 访问地址: http://localhost:8000"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
