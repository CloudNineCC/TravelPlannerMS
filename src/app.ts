import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import compositeRouter from './routes/composite.js'

const app = express()

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ms-travel-planner' })
})

app.use('/composite', compositeRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

export default app