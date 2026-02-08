// {
//   "code": 0,
//   "data": [
//     {
//       "timestamp": 1700000000000,
//       "open": 0.12,
//       "high": 0.15,
//       "low": 0.11,
//       "close": 0.14,
//       "volume": 12345
//     }
//   ]
// }

// app.js
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import klineRoutes from './klineRoutes.js'
import { startCollector } from './klineService.js'

const app = express()

/* CORS */
app.use(cors({
  origin: 'http://localhost:5173'
}))

/* MongoDB */
await mongoose.connect('mongodb://localhost:27017/meme')

/* Routes */
app.use('/api', klineRoutes)

/* 启动价格采集（示例 memeId） */
startCollector('65f123456789abcdef000001')

app.listen(3000, () => {
  console.log('API server running at http://localhost:3000')
})
