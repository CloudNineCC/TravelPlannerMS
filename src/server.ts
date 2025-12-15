import 'dotenv/config'
import app from './app.js'

const port = process.env.PORT ? Number(process.env.PORT) : 8080
const host = process.env.HOST || '0.0.0.0'

app.listen(port, host, () => {
  console.log(`ms-travel-planner listening on http://${host}:${port}`)
  console.log('Service URLs:')
  console.log(`  Destinations: ${process.env.DESTINATIONS_MS_URL || 'http://localhost:3001'}`)
  console.log(`  Pricing: ${process.env.PRICING_MS_URL || 'http://localhost:3002'}`)
  console.log(`  Itineraries: ${process.env.ITINERARIES_MS_URL || 'http://localhost:3003'}`)
})