// models.js
import mongoose from 'mongoose'

/* ========== Tick 价格（只存变化） ========== */
const TickPriceSchema = new mongoose.Schema({
  memeId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Number,
    index: true,
    required: true
  }
})

/* ========== K 线表（前端唯一数据源） ========== */
const KlineSchema = new mongoose.Schema({
  memeId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    required: true
  },
  interval: {
    type: String, // 1m / 5m / 15m / 1h / 1d
    index: true,
    required: true
  },
  // timestamp 字段包含 OHLCV 与 candle 起始时间
  timestamp: {
    time: {
      type: Number,
      index: true,
      required: true
    },
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: {
      type: Number,
      default: 0
    }
  }
})

KlineSchema.index(
  { memeId: 1, interval: 1, 'timestamp.time': 1 },
  { unique: true }
)

export const TickPrice = mongoose.model('TickPrice', TickPriceSchema)
export const Kline = mongoose.model('Kline', KlineSchema)
