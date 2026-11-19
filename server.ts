import fs from 'node:fs'
import path from 'node:path'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { createApiRouter, isAllowedOrigin } from './server/routes.ts'
import { DomoraStore } from './server/store.ts'

export function createApp(store = new DomoraStore()) {
  const app = express()
  app.set('trust proxy', 1)

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true)
          return
        }
        callback(null, true)
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
    }),
  )
  app.use(cookieParser())
  app.use(express.json())

  const apiRouter = createApiRouter(store)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })
  app.use('/api', apiRouter)

  // Return JSON 404 for unknown /api/* routes instead of serving SPA index.html
  app.use('/api', (_req, res) => {
    res.status(404).json({ detail: 'Not found' })
  })

  // Serve built frontend static assets
  const distDir = path.resolve(process.cwd(), 'frontend', 'dist')
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir))
    app.use((_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  return app
}

// Start server when run directly
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))

if (isDirectRun) {
  const port = Number(process.env.PORT || '3000')
  const host = '0.0.0.0'
  const app = createApp()
  app.listen(port, host, () => {
    console.log(`Domora server listening on http://${host}:${port}`)
  })
}
export { isAllowedOrigin }
