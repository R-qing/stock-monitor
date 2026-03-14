/**
 * 主应用模块 - 状态管理与交互
 */
const App = {
    currentTab: "hot",
    currentStock: null,
    watchlist: JSON.parse(localStorage.getItem("stock_watchlist") || "[]"),
    stocks: [],

    async init() {
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        Charts.init();

        // 加载大盘概览
        await this.loadOverview();

        // 加载默认列表
        await this.refreshList();

        // 定时刷新（交易时段 30 秒，非交易时段 5 分钟）
        this.startAutoRefresh();

        // 初始化粒子背景
        this.initParticles();

        // 搜索框回车
        document.getElementById("searchInput").addEventListener("keydown", (e) => {
            if (e.key === "Enter") this.search();
        });
    },

    updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, "0");
        const m = String(now.getMinutes()).padStart(2, "0");
        const s = String(now.getSeconds()).padStart(2, "0");
        document.getElementById("clock").textContent = `${h}:${m}:${s}`;

        // 市场状态
        const hour = now.getHours();
        const min = now.getMinutes();
        const day = now.getDay();
        const isWeekday = day >= 1 && day <= 5;
        const isMorning = (hour === 9 && min >= 30) || (hour === 10) || (hour === 11 && min <= 30);
        const isAfternoon = (hour >= 13 && hour < 15);
        const isOpen = isWeekday && (isMorning || isAfternoon);

        const statusEl = document.getElementById("marketStatus");
        if (isOpen) {
            statusEl.textContent = "🟢 交易中";
            statusEl.style.color = "#10b981";
        } else {
            statusEl.textContent = "🔴 已休市";
            statusEl.style.color = "#ef4444";
        }
    },

    async loadOverview() {
        try {
            const data = await API.getMarketOverview();
            document.getElementById("overviewUp").textContent = data.up;
            document.getElementById("overviewDown").textContent = data.down;
            document.getElementById("overviewFlat").textContent = data.flat;
            document.getElementById("overviewLimitUp").textContent = data.limit_up;
            document.getElementById("overviewLimitDown").textContent = data.limit_down;
            document.getElementById("overviewTurnover").textContent = data.total_turnover;

            const avgEl = document.getElementById("overviewAvg");
            avgEl.textContent = (data.avg_change_pct > 0 ? "+" : "") + data.avg_change_pct + "%";
            avgEl.className = "card-value " + (data.avg_change_pct > 0 ? "up" : data.avg_change_pct < 0 ? "down" : "");
        } catch (e) {
            console.error("大盘概览加载失败:", e);
        }
    },

    async refreshList() {
        const sort = document.getElementById("sortField").value;
        const order = document.getElementById("sortOrder").value;

        try {
            let data;
            if (this.currentTab === "hot") {
                data = await API.getHotStocks();
                document.getElementById("panelTitle").textContent = "🔥 潜力股排行";
            } else if (this.currentTab === "watchlist") {
                // 自选股 - 逐个获取详情
                document.getElementById("panelTitle").textContent = "⭐ 自选股";
                data = await this.loadWatchlistData();
            } else {
                data = await API.getStocks({ sort, order, limit: 100 });
                document.getElementById("panelTitle").textContent = "📋 全市场";
            }

            this.stocks = data;
            this.renderTable(data);
        } catch (e) {
            console.error("列表加载失败:", e);
            document.getElementById("stockTableBody").innerHTML =
                '<tr><td colspan="8" class="loading">⚠️ 加载失败，请稍后重试</td></tr>';
        }
    },

    async loadWatchlistData() {
        if (this.watchlist.length === 0) return [];
        const results = [];
        for (const code of this.watchlist) {
            try {
                const detail = await API.getStockDetail(code);
                results.push({
                    code: detail.basic.code,
                    name: detail.basic.name,
                    price: detail.basic.price,
                    change_pct: detail.basic.change_pct,
                    turnover_rate: detail.basic.turnover_rate,
                    score: detail.score.score,
                    signals: detail.score.signals,
                });
            } catch (e) {
                console.error(`自选股 ${code} 加载失败:`, e);
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results;
    },

    renderTable(stocks) {
        const tbody = document.getElementById("stockTableBody");
        if (!stocks || stocks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="loading">📭 暂无数据</td></tr>';
            return;
        }

        tbody.innerHTML = stocks.map((s, i) => {
            const changeClass = s.change_pct > 0 ? "change-up" : s.change_pct < 0 ? "change-down" : "change-flat";
            const changeText = (s.change_pct > 0 ? "+" : "") + s.change_pct.toFixed(2) + "%";
            const scoreClass = s.score >= 70 ? "score-high" : s.score >= 40 ? "score-mid" : "score-low";
            const isWatched = this.watchlist.includes(s.code);

            return `<tr class="fade-in" onclick="App.showDetail('${s.code}')" style="animation-delay:${i * 0.03}s">
                <td>${i + 1}</td>
                <td class="code">${s.code}</td>
                <td class="name">${s.name}</td>
                <td style="font-family:var(--font-mono);font-weight:600">${s.price.toFixed(2)}</td>
                <td class="${changeClass}">${changeText}</td>
                <td>${(s.turnover_rate || 0).toFixed(2)}%</td>
                <td><span class="score-badge ${scoreClass}">${s.score}</span></td>
                <td>
                    <button class="detail-btn" onclick="event.stopPropagation();App.showDetail('${s.code}')">查看</button>
                    ${isWatched ? '<span style="color:#f59e0b;margin-left:4px">⭐</span>' : ''}
                </td>
            </tr>`;
        }).join("");
    },

    async showDetail(code) {
        document.getElementById("detailPlaceholder").style.display = "none";
        document.getElementById("detailContent").style.display = "block";

        // 高亮当前行
        document.querySelectorAll(".stock-table tbody tr").forEach(tr => tr.style.background = "");
        const rows = document.querySelectorAll(".stock-table tbody tr");
        rows.forEach(tr => {
            if (tr.querySelector(".code")?.textContent === code) {
                tr.style.background = "var(--bg-card-hover)";
            }
        });

        try {
            const detail = await API.getStockDetail(code);
            this.currentStock = code;

            // 基本信息
            document.getElementById("detailName").textContent = detail.basic.name;
            document.getElementById("detailCode").textContent = detail.basic.code;
            document.getElementById("detailPrice").textContent = detail.basic.price.toFixed(2);
            document.getElementById("detailPrice").style.color =
                detail.basic.change_pct >= 0 ? "var(--accent-red)" : "var(--accent-green)";

            const changeText = (detail.basic.change_pct > 0 ? "+" : "") + detail.basic.change_pct.toFixed(2) + "%";
            const changeAmountText = (detail.basic.change_amount > 0 ? "+" : "") + detail.basic.change_amount.toFixed(2);
            document.getElementById("detailChange").textContent = `${changeText} (${changeAmountText})`;
            document.getElementById("detailChange").style.color =
                detail.basic.change_pct >= 0 ? "var(--accent-red)" : "var(--accent-green)";

            // 评分圆圈
            const scoreCircle = document.getElementById("detailScoreCircle");
            scoreCircle.textContent = detail.score.score;
            if (detail.score.score >= 70) {
                scoreCircle.style.borderColor = "var(--accent-green)";
                scoreCircle.style.boxShadow = "var(--glow-green)";
                scoreCircle.style.color = "var(--accent-green)";
            } else if (detail.score.score >= 40) {
                scoreCircle.style.borderColor = "var(--accent-yellow)";
                scoreCircle.style.boxShadow = "0 0 15px rgba(245,158,11,0.3)";
                scoreCircle.style.color = "var(--accent-yellow)";
            } else {
                scoreCircle.style.borderColor = "var(--accent-red)";
                scoreCircle.style.boxShadow = "var(--glow-red)";
                scoreCircle.style.color = "var(--accent-red)";
            }

            // 自选按钮
            const wlBtn = document.getElementById("watchlistBtn");
            if (this.watchlist.includes(code)) {
                wlBtn.textContent = "⭐ 已自选";
                wlBtn.classList.add("active");
            } else {
                wlBtn.textContent = "⭐ 加自选";
                wlBtn.classList.remove("active");
            }

            // 信号
            const signalsPanel = document.getElementById("signalsPanel");
            signalsPanel.innerHTML = (detail.score.signals || []).map(s =>
                `<span class="signal-tag">${s}</span>`
            ).join("");

            // 渲染图表
            Charts.renderAll(detail);

            // 评分详情
            this.renderScoreDetails(detail.score.details);

        } catch (e) {
            console.error("详情加载失败:", e);
            document.getElementById("detailContent").innerHTML =
                '<div class="detail-placeholder"><p>⚠️ 加载失败</p></div>';
        }
    },

    renderScoreDetails(details) {
        const container = document.getElementById("scoreDetails");
        if (!details || Object.keys(details).length === 0) {
            container.innerHTML = "";
            return;
        }

        const names = {
            "RSI": "RSI 指标",
            "MACD": "MACD 指标",
            "均线": "均线排列",
            "成交量": "成交量",
            "动量": "价格动量",
            "布林带": "布林带",
        };

        container.innerHTML = Object.entries(details).map(([key, item]) => {
            const score = item.score;
            let color = "#ef4444";
            if (score >= 70) color = "#10b981";
            else if (score >= 40) color = "#f59e0b";

            let extra = "";
            if (key === "RSI") extra = `<div style="font-size:11px;color:#94a3b8;margin-top:4px">RSI: ${item.value}</div>`;
            if (key === "动量") extra = `<div style="font-size:11px;color:#94a3b8;margin-top:4px">5日涨幅: ${item["5日涨幅"]}%</div>`;

            return `<div class="score-item">
                <div class="score-item-name">${names[key] || key}</div>
                <div class="score-item-value" style="color:${color}">${score}</div>
                ${extra}
                <div class="score-item-bar">
                    <div class="score-item-fill" style="width:${score}%;background:${color}"></div>
                </div>
            </div>`;
        }).join("");
    },

    toggleWatchlist() {
        if (!this.currentStock) return;
        const code = this.currentStock;
        const idx = this.watchlist.indexOf(code);
        if (idx >= 0) {
            this.watchlist.splice(idx, 1);
        } else {
            this.watchlist.push(code);
        }
        localStorage.setItem("stock_watchlist", JSON.stringify(this.watchlist));

        const wlBtn = document.getElementById("watchlistBtn");
        if (this.watchlist.includes(code)) {
            wlBtn.textContent = "⭐ 已自选";
            wlBtn.classList.add("active");
        } else {
            wlBtn.textContent = "⭐ 加自选";
            wlBtn.classList.remove("active");
        }

        // 刷新列表
        this.refreshList();
    },

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        event.target.classList.add("active");
        this.refreshList();
    },

    async search() {
        const keyword = document.getElementById("searchInput").value.trim();
        if (!keyword) return;

        this.currentTab = "all";
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));

        try {
            document.getElementById("panelTitle").textContent = `🔍 搜索: ${keyword}`;
            const data = await API.getStocks({ sort: "score", order: "desc", limit: 50, keyword });
            this.renderTable(data);
        } catch (e) {
            console.error("搜索失败:", e);
        }
    },

    startAutoRefresh() {
        setInterval(async () => {
            try {
                await this.loadOverview();
            } catch (e) { /* ignore */ }
        }, 60000); // 每分钟刷新概览

        setInterval(async () => {
            if (this.currentStock) {
                // 静默刷新当前详情
            }
        }, 30000);
    },

    // ---- 粒子背景 ----
    initParticles() {
        const canvas = document.getElementById("particles");
        const ctx = canvas.getContext("2d");
        let w, h, particles;

        function resize() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener("resize", resize);

        particles = Array.from({ length: 60 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            r: Math.random() * 1.5 + 0.5,
        }));

        function draw() {
            ctx.clearRect(0, 0, w, h);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(6, 182, 212, 0.3)";
                ctx.fill();
            });

            // 连线
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(6, 182, 212, ${0.1 * (1 - dist / 150)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(draw);
        }
        draw();
    },
};

// 启动
document.addEventListener("DOMContentLoaded", () => App.init());
