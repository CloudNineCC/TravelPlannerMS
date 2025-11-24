import { HttpClient } from './http-client.js'

// Service URLs from environment variables
const DESTINATIONS_URL = process.env.DESTINATIONS_MS_URL || 'http://localhost:3001'
const PRICING_URL = process.env.PRICING_MS_URL || 'http://localhost:3002'
const ITINERARIES_URL = process.env.ITINERARIES_MS_URL || 'http://localhost:3003'

// HTTP clients for each microservice
export const destinationsClient = new HttpClient(DESTINATIONS_URL)
export const pricingClient = new HttpClient(PRICING_URL)
export const itinerariesClient = new HttpClient(ITINERARIES_URL)