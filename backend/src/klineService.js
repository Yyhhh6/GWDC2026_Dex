// klineService.js
import { TickPrice } from './models.js'

/* ========== 时间周期定义 ========== */
export const INTERVAL_MS = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000
}

const INTERVALS = Object.keys(INTERVAL_MS)

const currentKlineCache = new Map()
const lastPriceCache = new Map()

/* ========== 工具函数 ========== */
function alignTime(ts, interval, originTime) {
  const size = INTERVAL_MS[interval]
  const base = Number.isFinite(originTime) ? originTime : 0
  return Math.floor((ts - base) / size) * size + base
}

/* ========== 拉最新价格（示例） ========== */
async function fetchLatestPrice(memeId) {
  // TODO: 替换为真实行情接口
  lastPriceRaw.value = await dex.getLastPriceFor(DOGE);
  const lastPriceDisplay = computed(() => ethers.formatUnits(lastPriceRaw.value || 0n, 18));

  return Number((Math.random() * 0.01 + 0.1).toFixed(6));
}

/* ========== 内存 K 线缓存 ========== */
function getCacheKey(memeId, interval) {
  return `${memeId}:${interval}`
}

function updateCurrentKline(memeId, interval, price, ts, originTime) {
  const candleTime = alignTime(ts, interval, originTime)
  const key = getCacheKey(memeId, interval)
  const cached = currentKlineCache.get(key)

  if (!cached || cached.time !== candleTime) {
    const next = {
      time: candleTime,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 1
    }
    currentKlineCache.set(key, next)
    return next
  }

  cached.high = Math.max(cached.high, price)
  cached.low = Math.min(cached.low, price)
  cached.close = price
  cached.volume += 1
  return cached
}

export function getCurrentKline(memeId, interval) {
  return currentKlineCache.get(getCacheKey(memeId, interval)) || null
}

/* ========== 2.5s 采集任务 ========== */
const originTimeCache = new Map()

async function getOriginTime(memeId) {
  if (originTimeCache.has(memeId)) return originTimeCache.get(memeId)

  const firstTick = await TickPrice.findOne({ memeId })
    .sort({ timestamp: 1 })
  const origin = firstTick ? firstTick.timestamp : Date.now()

  originTimeCache.set(memeId, origin)
  return origin
}

export async function collectPrice(memeId) {
  const price = await fetchLatestPrice(memeId)
  const now = Date.now()
  const originTime = await getOriginTime(memeId)

  // 无论价格是否变化，都更新内存 K 线缓存
  for (const interval of INTERVALS) {
    updateCurrentKline(memeId, interval, price, now, originTime)
  }

  let lastPrice = lastPriceCache.get(memeId)
  if (lastPrice === undefined) {
    const lastTick = await TickPrice.findOne({ memeId })
      .sort({ timestamp: -1 })
    lastPrice = lastTick ? lastTick.price : null
  }

  // 价格没变，不写入 TickPrice
  if (lastPrice === price) {
    lastPriceCache.set(memeId, lastPrice)
    return
  }

  await TickPrice.create({
    memeId,
    price,
    timestamp: now
  })

  lastPriceCache.set(memeId, price)
}

/* ========== 启动前预热内存缓存 ========== */
async function bootstrapCache(memeId) {
  const ticks = await TickPrice.find({ memeId }).sort({ timestamp: 1 })
  if (!ticks.length) return

  const originTime = ticks[0].timestamp
  originTimeCache.set(memeId, originTime)

  const lastTick = ticks[ticks.length - 1]
  lastPriceCache.set(memeId, lastTick.price)

  for (const interval of INTERVALS) {
    updateCurrentKline(
      memeId,
      interval,
      lastTick.price,
      lastTick.timestamp,
      originTime
    )
  }
}

function buildKlinesFromTicks(ticks, interval, originTime) {
  const data = []
  let current = null

  for (const tick of ticks) {
    const candleTime = alignTime(tick.timestamp, interval, originTime)
    if (!current || current.time !== candleTime) {
      if (current) data.push(current)
      current = {
        time: candleTime,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: 1
      }
      continue
    }

    current.high = Math.max(current.high, tick.price)
    current.low = Math.min(current.low, tick.price)
    current.close = tick.price
    current.volume += 1
  }

  if (current) data.push(current)
  return data
}

export async function getKlinesFromTicks(memeId, interval, startTime, endTime, limit) {
  const originTime = await getOriginTime(memeId)

  const ticks = await TickPrice.find({
    memeId,
    timestamp: {
      $gte: startTime,
      $lte: endTime
    }
  }).sort({ timestamp: 1 })

  let data = buildKlinesFromTicks(ticks, interval, originTime)

  const current = getCurrentKline(memeId, interval)
  if (current && current.time >= startTime && current.time <= endTime) {
    if (data.length && data[data.length - 1].time === current.time) {
      data[data.length - 1] = current
    } else {
      data.push(current)
    }
  }

  if (data.length > limit) {
    data = data.slice(-limit)
  }

  return data.map(item => ({
    memeId,
    interval,
    timestamp: item
  }))
}

/* ========== 启动定时器 ========== */
export function startCollector(memeId) {
  bootstrapCache(memeId).catch(err =>
    console.error('[bootstrap error]', err)
  )

  setInterval(() => {
    collectPrice(memeId).catch(err =>
      console.error('[collector error]', err)
    )
  }, 2500)
}
