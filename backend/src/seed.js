// seed.js
import mongoose from 'mongoose'
import { TickPrice, Kline } from './models.js'
import { INTERVAL_MS } from './klineService.js'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/meme'
const DAYS = Number(process.env.DAYS || 3)
const TICK_SECONDS = Number(process.env.TICK_SECONDS || 30)
const BASE_PRICE = Number(process.env.BASE_PRICE || 0.12)
const VOLATILITY = Number(process.env.VOLATILITY || 0.02)

function getMemeId() {
  if (process.env.MEME_ID) {
    if (mongoose.isValidObjectId(process.env.MEME_ID)) {
      return new mongoose.Types.ObjectId(process.env.MEME_ID)
    }
    console.warn('[seed] MEME_ID 无效，已自动生成新的 ObjectId')
  }
  return new mongoose.Types.ObjectId('65f123456789abcdef000001')
}

function alignTime(ts, interval, originTime) {
  const size = INTERVAL_MS[interval]
  const base = Number.isFinite(originTime) ? originTime : 0
  return Math.floor((ts - base) / size) * size + base
}

function nextPrice(price) {
  const change = (Math.random() - 0.5) * VOLATILITY
  const newPrice = price * (1 + change)
  return Number(Math.max(0.000001, newPrice).toFixed(6))
}

async function seed() {
  const memeId = getMemeId()
  await mongoose.connect(MONGO_URI)

  await TickPrice.deleteMany({ memeId })
  await Kline.deleteMany({ memeId })

  const now = Date.now()
  const start = now - DAYS * 24 * 60 * 60 * 1000
  const stepMs = TICK_SECONDS * 1000

  const ticks = []
  let price = Number(BASE_PRICE.toFixed(6))

  for (let ts = start; ts <= now; ts += stepMs) {
    price = nextPrice(price)
    ticks.push({
      memeId,
      price,
      timestamp: ts
    })
  }

  if (ticks.length) {
    await TickPrice.insertMany(ticks, { ordered: false })
  }

  const originTime = ticks[0]?.timestamp || start
  const intervalKeys = Object.keys(INTERVAL_MS)
  const klineMap = new Map()

  for (const tick of ticks) {
    for (const interval of intervalKeys) {
      const candleTime = alignTime(tick.timestamp, interval, originTime)
      const key = `${interval}:${candleTime}`

      const existing = klineMap.get(key)
      if (!existing) {
        klineMap.set(key, {
          memeId,
          interval,
          timestamp: {
            time: candleTime,
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
            volume: 1
          }
        })
      } else {
        existing.timestamp.high = Math.max(existing.timestamp.high, tick.price)
        existing.timestamp.low = Math.min(existing.timestamp.low, tick.price)
        existing.timestamp.close = tick.price
        existing.timestamp.volume += 1
      }
    }
  }

  const klines = Array.from(klineMap.values())
  if (klines.length) {
    await Kline.insertMany(klines, { ordered: false })
  }

  console.log('[seed] 完成')
  console.log('[seed] memeId =', memeId.toString())
  console.log('[seed] TickPrice =', ticks.length)
  console.log('[seed] Kline =', klines.length)

  await mongoose.disconnect()
}

seed().catch(async err => {
  console.error('[seed] 失败', err)
  await mongoose.disconnect()
  process.exit(1)
})
