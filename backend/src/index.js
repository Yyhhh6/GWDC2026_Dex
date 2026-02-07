import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());

/**
 * K线周期（秒）
 */
const INTERVALS = {
  "5s": 5,
  "1m": 60,
  "5m": 300,
};

/**
 * 存储 K 线
 * {
 *   "5s": Map<timestamp, kline>,
 *   "1m": Map<timestamp, kline>
 * }
 */
const klineStore = {};
Object.keys(INTERVALS).forEach(k => {
  klineStore[k] = new Map();
});

/**
 * 获取最新价格（模拟）
 * 你可以替换成 Binance / OKX / 自己的行情接口
 */
let lastPrice = 30000;
async function fetchLatestPrice() {
  // 模拟随机波动
  const delta = (Math.random() - 0.5) * 50;
  lastPrice = Math.max(1, lastPrice + delta);
  return {
    price: Number(lastPrice.toFixed(2)),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * 根据时间戳对齐到 K 线周期起点
 */
function getBucketTime(ts, intervalSec) {
  return Math.floor(ts / intervalSec) * intervalSec;
}

/**
 * 更新 K 线
 */
function updateKlines(price, ts) {
  for (const [key, interval] of Object.entries(INTERVALS)) {
    const bucket = getBucketTime(ts, interval);
    const store = klineStore[key];

    if (!store.has(bucket)) {
      store.set(bucket, {
        time: bucket,
        open: price,
        high: price,
        low: price,
        close: price,
      });
    } else {
      const k = store.get(bucket);
      k.high = Math.max(k.high, price);
      k.low = Math.min(k.low, price);
      k.close = price;
    }

    // 防止无限增长（只保留最近 500 根）
    if (store.size > 500) {
      const oldestKey = store.keys().next().value;
      store.delete(oldestKey);
    }
  }
}

/**
 * 每 2.5s 拉一次行情
 */
setInterval(async () => {
  const { price, timestamp } = await fetchLatestPrice();
  updateKlines(price, timestamp);
}, 2500);

/**
 * K线接口
 * GET /klines?interval=5s
 */
app.get("/klines", (req, res) => {
  const interval = req.query.interval || "5s";
  if (!klineStore[interval]) {
    return res.status(400).json({ error: "Invalid interval" });
  }
  res.json(Array.from(klineStore[interval].values()));
});

app.listen(3000, () => {
  console.log("Kline backend running at http://localhost:3000");
});
