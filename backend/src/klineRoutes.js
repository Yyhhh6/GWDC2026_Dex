// klineRoutes.js
import express from 'express'
import { INTERVAL_MS, getKlinesFromTicks } from './klineService.js'

const router = express.Router()

/**
 * GET /api/meme/:memeId?interval=5m
 */
router.get('/meme/:memeId', async (req, res) => {
//   console.log('req: ', req)
//   console.log('res: ', res)
  const { memeId } = req.params
  const { interval } = req.query
//   console.log('memeId: ', memeId)


  if (!INTERVAL_MS[interval]) {
    return res.status(400).json({
      code: 1,
      message: 'invalid interval'
    })
  }

  const limit = Math.min(Number(req.query.limit) || 500, 2000)
  const endTime = Number(req.query.endTime) || Date.now()
  const startTime = endTime - INTERVAL_MS[interval] * limit

  const data = await getKlinesFromTicks(
    memeId,
    interval,
    startTime,
    endTime,
    limit
  )

  res.json({
    code: 0,
    data
  })
})

export default router
