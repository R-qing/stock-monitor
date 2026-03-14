/**
 * API 层 - 封装所有后端请求
 */
const API = {
    BASE: "",

    async get(url) {
        const res = await fetch(this.BASE + url);
        const json = await res.json();
        if (!json.ok) throw new Error(json.detail || "请求失败");
        return json.data;
    },

    // 大盘概览
    getMarketOverview() {
        return this.get("/api/market/overview");
    },

    // 股票列表
    getStocks(params = {}) {
        const query = new URLSearchParams({
            sort: params.sort || "score",
            order: params.order || "desc",
            limit: params.limit || 100,
            keyword: params.keyword || "",
        });
        return this.get("/api/stocks?" + query);
    },

    // 热门潜力股
    getHotStocks() {
        return this.get("/api/hot");
    },

    // 个股详情
    getStockDetail(code) {
        return this.get("/api/stock/" + code);
    },
};
