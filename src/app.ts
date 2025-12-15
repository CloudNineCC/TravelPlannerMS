import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import compositeRouter from './routes/composite.js'
import authRouter from './routes/auth.js'
import { generateOpenAPISpec } from './openapi-generator.js'
import { jwtMiddleware } from './auth/middleware.js'

const app = express()

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ms-travel-planner' })
})

const openApiSpec = generateOpenAPISpec()
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec))
app.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec)
})

// Auth routes (no JWT required)
app.use('/auth', authRouter)

// Protected routes (require JWT)
app.use('/composite', jwtMiddleware, compositeRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

export default app