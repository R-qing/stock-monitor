/**
 * 图表模块 - ECharts 可视化
 */
const Charts = {
    kline: null,
    volume: null,
    indicator: null,
    currentData: null,
    overlayType: "ma",     // ma | boll
    subType: "macd",       // macd | rsi | kdj

    init() {
        this.kline = echarts.init(document.getElementById("klineChart"));
        this.volume = echarts.init(document.getElementById("volumeChart"));
        this.indicator = echarts.init(document.getElementById("indicatorChart"));

        window.addEventListener("resize", () => {
            this.kline && this.kline.resize();
            this.volume && this.volume.resize();
            this.indicator && this.indicator.resize();
        });
    },

    renderAll(data) {
        this.currentData = data;
        this.renderKline(data);
        this.renderVolume(data);
        this.renderIndicator(data);
    },

    setIndicator(type) {
        this.overlayType = type;
        document.querySelectorAll(".chart-container:first-child .chart-tab").forEach(b => b.classList.remove("active"));
        event.target.classList.add("active");
        if (this.currentData) this.renderKline(this.currentData);
    },

    setSubIndicator(type) {
        this.subType = type;
        // 找到指标区域的所有 tab
        const container = document.getElementById("indicatorChart").closest(".chart-container");
        container.querySelectorAll(".chart-tab").forEach(b => b.classList.remove("active"));
        event.target.classList.add("active");
        if (this.currentData) this.renderIndicator(this.currentData);
    },

    renderKline(data) {
        const kline = data.kline;
        const indicators = data.indicators;
        const dates = kline.dates;

        // 构建 candlestick 数据
        const candleData = kline.dates.map((_, i) => [kline.open[i], kline.close[i], kline.low[i], kline.high[i]]);

        // 叠加指标
        let series = [
            {
                name: "K线",
                type: "candlestick",
                data: candleData,
                itemStyle: {
                    color: "#ef4444",      // 涨 - 红
                    color0: "#10b981",     // 跌 - 绿
                    borderColor: "#ef4444",
                    borderColor0: "#10b981",
                },
            },
        ];

        if (this.overlayType === "ma") {
            const colors = ["#f59e0b", "#3b82f6", "#8b5cf6", "#06b6d4"];
            const names = ["MA5", "MA10", "MA20", "MA60"];
            const mas = [indicators.ma5, indicators.ma10, indicators.ma20, indicators.ma60];
            mas.forEach((ma, idx) => {
                series.push({
                    name: names[idx],
                    type: "line",
                    data: ma,
                    smooth: true,
                    lineStyle: { width: 1, color: colors[idx] },
                    symbol: "none",
                });
            });
        } else {
            series.push(
                {
                    name: "BOLL上轨",
                    type: "line",
                    data: indicators.bollinger.upper,
                    lineStyle: { width: 1, color: "#8b5cf6", type: "dashed" },
                    symbol: "none",
                },
                {
                    name: "BOLL中轨",
                    type: "line",
                    data: indicators.bollinger.middle,
                    lineStyle: { width: 1, color: "#f59e0b" },
                    symbol: "none",
                },
                {
                    name: "BOLL下轨",
                    type: "line",
                    data: indicators.bollinger.lower,
                    lineStyle: { width: 1, color: "#8b5cf6", type: "dashed" },
                    symbol: "none",
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: "rgba(139,92,246,0)" },
                            { offset: 1, color: "rgba(139,92,246,0.05)" },
                        ]),
                    },
                },
            );
        }

        this.kline.setOption({
            backgroundColor: "transparent",
            animation: true,
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "cross" },
                backgroundColor: "rgba(17,24,39,0.95)",
                borderColor: "#2a3055",
                textStyle: { color: "#e2e8f0", fontSize: 12 },
            },
            legend: {
                data: this.overlayType === "ma" ? ["K线", "MA5", "MA10", "MA20", "MA60"] : ["K线", "BOLL上轨", "BOLL中轨", "BOLL下轨"],
                textStyle: { color: "#64748b", fontSize: 11 },
                top: 0,
            },
            grid: { left: 60, right: 20, top: 30, bottom: 30 },
            xAxis: {
                type: "category",
                data: dates,
                axisLine: { lineStyle: { color: "#2a3055" } },
                axisLabel: { color: "#64748b", fontSize: 10 },
                splitLine: { show: false },
            },
            yAxis: {
                type: "value",
                scale: true,
                axisLine: { show: false },
                axisLabel: { color: "#64748b", fontSize: 10 },
                splitLine: { lineStyle: { color: "rgba(42,48,85,0.4)", type: "dashed" } },
            },
            dataZoom: [
                { type: "inside", start: 60, end: 100 },
                { type: "slider", start: 60, end: 100, height: 20, bottom: 2,
                  borderColor: "#2a3055", fillerColor: "rgba(6,182,212,0.1)", handleStyle: { color: "#06b6d4" },
                  textStyle: { color: "#64748b" },
                },
            ],
            series,
        }, true);
    },

    renderVolume(data) {
        const kline = data.kline;
        const volData = kline.volume.map((v, i) => ({
            value: v,
            itemStyle: { color: kline.close[i] >= kline.open[i] ? "rgba(239,68,68,0.6)" : "rgba(16,185,129,0.6)" },
        }));

        this.volume.setOption({
            backgroundColor: "transparent",
            tooltip: {
                trigger: "axis",
                backgroundColor: "rgba(17,24,39,0.95)",
                borderColor: "#2a3055",
                textStyle: { color: "#e2e8f0", fontSize: 12 },
                formatter: (p) => `成交量: ${(p[0].value / 1e4).toFixed(0)} 万手`,
            },
            grid: { left: 60, right: 20, top: 8, bottom: 24 },
            xAxis: {
                type: "category",
                data: kline.dates,
                axisLine: { lineStyle: { color: "#2a3055" } },
                axisLabel: { show: false },
            },
            yAxis: {
                type: "value",
                axisLine: { show: false },
                axisLabel: { color: "#64748b", fontSize: 10, formatter: v => (v/1e4).toFixed(0) + "万" },
                splitLine: { lineStyle: { color: "rgba(42,48,85,0.4)", type: "dashed" } },
            },
            dataZoom: [
                { type: "inside", start: 60, end: 100 },
            ],
            series: [{
                type: "bar",
                data: volData,
            }],
        }, true);
    },

    renderIndicator(data) {
        const indicators = data.indicators;
        let series = [];
        let legendData = [];

        if (this.subType === "macd") {
            legendData = ["DIF", "DEA", "MACD"];
            series = [
                {
                    name: "DIF", type: "line", data: indicators.macd.dif,
                    lineStyle: { width: 1.5, color: "#f59e0b" }, symbol: "none",
                },
                {
                    name: "DEA", type: "line", data: indicators.macd.dea,
                    lineStyle: { width: 1.5, color: "#3b82f6" }, symbol: "none",
                },
                {
                    name: "MACD", type: "bar",
                    data: indicators.macd.histogram.map(v => ({
                        value: v,
                        itemStyle: { color: v >= 0 ? "rgba(239,68,68,0.7)" : "rgba(16,185,129,0.7)" },
                    })),
                },
            ];
        } else if (this.subType === "rsi") {
            legendData = ["RSI"];
            series = [
                {
                    name: "RSI", type: "line", data: indicators.rsi,
                    lineStyle: { width: 1.5, color: "#8b5cf6" }, symbol: "none",
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: "rgba(139,92,246,0.15)" },
                            { offset: 1, color: "rgba(139,92,246,0)" },
                        ]),
                    },
                    markLine: {
                        silent: true,
                        data: [
                            { yAxis: 70, lineStyle: { color: "#ef4444", type: "dashed" }, label: { formatter: "超买 70", color: "#ef4444", fontSize: 10 } },
                            { yAxis: 30, lineStyle: { color: "#10b981", type: "dashed" }, label: { formatter: "超卖 30", color: "#10b981", fontSize: 10 } },
                        ],
                    },
                },
            ];
        } else if (this.subType === "kdj") {
            legendData = ["K", "D", "J"];
            series = [
                { name: "K", type: "line", data: indicators.kdj.k, lineStyle: { width: 1.5, color: "#3b82f6" }, symbol: "none" },
                { name: "D", type: "line", data: indicators.kdj.d, lineStyle: { width: 1.5, color: "#f59e0b" }, symbol: "none" },
                { name: "J", type: "line", data: indicators.kdj.j, lineStyle: { width: 1.5, color: "#8b5cf6" }, symbol: "none" },
            ];
        }

        this.indicator.setOption({
            backgroundColor: "transparent",
            animation: true,
            tooltip: {
                trigger: "axis",
                backgroundColor: "rgba(17,24,39,0.95)",
                borderColor: "#2a3055",
                textStyle: { color: "#e2e8f0", fontSize: 12 },
            },
            legend: {
                data: legendData,
                textStyle: { color: "#64748b", fontSize: 11 },
                top: 0,
            },
            grid: { left: 60, right: 20, top: 30, bottom: 24 },
            xAxis: {
                type: "category",
                data: data.kline.dates,
                axisLine: { lineStyle: { color: "#2a3055" } },
                axisLabel: { color: "#64748b", fontSize: 10 },
            },
            yAxis: {
                type: "value",
                axisLine: { show: false },
                axisLabel: { color: "#64748b", fontSize: 10 },
                splitLine: { lineStyle: { color: "rgba(42,48,85,0.4)", type: "dashed" } },
            },
            dataZoom: [
                { type: "inside", start: 60, end: 100 },
            ],
            series,
        }, true);
    },
};
