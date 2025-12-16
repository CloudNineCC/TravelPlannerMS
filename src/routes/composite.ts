import { Router, Request, Response } from 'express'
import { destinationsClient, pricingClient, itinerariesClient } from '../services.js'
import { executeInWorker } from '../workers/parallel-processor.js'

const router = Router()

async function validateCityExists(cityId: string): Promise<{ valid: boolean; error?: string }> {
  try {
    await destinationsClient.get(`/cities/${cityId}`)
    return { valid: true }
  } catch (error: any) {
    if (error.message.includes('404')) {
      return { valid: false, error: `City with ID '${cityId}' does not exist` }
    }
    throw error
  }
}

async function validateLodgingClass(lodgingClass: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const classes: any[] = await pricingClient.get('/lodging-classes')
    const exists = classes.some((lc: any) =>
      typeof lc === 'string' ? lc === lodgingClass : lc.class_name === lodgingClass
    )
    if (!exists) {
      return { valid: false, error: `Lodging class '${lodgingClass}' does not exist` }
    }
    return { valid: true }
  } catch (error: any) {
    throw error
  }
}

async function validateSegment(segment: any): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  if (!segment.city_id) {
    errors.push('Segment missing city_id')
  } else {
    const cityValidation = await validateCityExists(segment.city_id)
    if (!cityValidation.valid) {
      errors.push(cityValidation.error!)
    }
  }

  if (!segment.lodging_class) {
    errors.push('Segment missing lodging_class')
  } else {
    const lodgingValidation = await validateLodgingClass(segment.lodging_class)
    if (!lodgingValidation.valid) {
      errors.push(lodgingValidation.error!)
    }
  }

  if (!segment.start_date) {
    errors.push('Segment missing start_date')
  }

  if (!segment.end_date) {
    errors.push('Segment missing end_date')
  }

  if (segment.start_date && segment.end_date) {
    const start = new Date(segment.start_date)
    const end = new Date(segment.end_date)
    if (end <= start) {
      errors.push('end_date must be after start_date')
    }
  }

  return { valid: errors.length === 0, errors }
}

router.get('/itineraries/:id', async (req: Request, res: Response) => {
  try {
    const itineraryId = req.params.id
    const ITINERARIES_URL = process.env.ITINERARIES_MS_URL || 'http://localhost:3003'
    const DESTINATIONS_URL = process.env.DESTINATIONS_MS_URL || 'http://localhost:3001'
    const PRICING_URL = process.env.PRICING_MS_URL || 'http://localhost:3002'

    const initialTasks = [
      { type: 'fetch' as const, url: `${ITINERARIES_URL}/itineraries/${itineraryId}` },
      { type: 'fetch' as const, url: `${ITINERARIES_URL}/itineraries/${itineraryId}/segments` }
    ]

    const initialResults = await executeInWorker(initialTasks)

    if (!initialResults[0].success || !initialResults[1].success) {
      throw new Error('Failed to fetch itinerary or segments')
    }

    const itinerary = initialResults[0].data
    const segments = initialResults[1].data

    const enrichmentTasks = segments.flatMap((segment: any) => [
      { type: 'fetch' as const, url: `${DESTINATIONS_URL}/cities/${segment.city_id}` },
      { type: 'fetch' as const, url: `${PRICING_URL}/rates?city_id=${segment.city_id}&lodging_class=${segment.lodging_class}` }
    ])

    const enrichmentResults = await executeInWorker(enrichmentTasks)

    const enrichedSegments = segments.map((segment: any, index: number) => {
      const cityResult = enrichmentResults[index * 2]
      const ratesResult = enrichmentResults[index * 2 + 1]

      const city = cityResult.success ? cityResult.data : null
      const rates = ratesResult.success ? ratesResult.data : []

      return {
        ...segment,
        city_name: city?.name || '',
        country_code: city?.country_code || '',
        currency: city?.currency || '',
        rates: rates || [],
      }
    })

    res.json({
      ...itinerary,
      segments: enrichedSegments,
    })
  } catch (error: any) {
    console.error('Error fetching composite itinerary:', error)
    res.status(500).json({ error: error.message || 'Failed to fetch composite itinerary' })
  }
})

router.get('/destinations', async (_req: Request, res: Response) => {
  try {
    const [citiesResponse, seasonsResponse]: any[] = await Promise.all([
      destinationsClient.get('/cities?limit=100'),
      destinationsClient.get('/seasons?limit=100'),
    ])

    const cities = citiesResponse.data || citiesResponse
    const seasons = seasonsResponse.data || seasonsResponse

    const seasonsByCity = seasons.reduce((acc: any, season: any) => {
      if (!acc[season.city_id]) {
        acc[season.city_id] = []
      }
      acc[season.city_id].push(season)
      return acc
    }, {})

    const enrichedCities = cities.map((city: any) => ({
      ...city,
      seasons: seasonsByCity[city.id] || [],
    }))

    res.json(enrichedCities)
  } catch (error: any) {
    console.error('Error fetching destinations:', error)
    res.status(500).json({ error: error.message || 'Failed to fetch destinations' })
  }
})

router.post('/itineraries', async (req: Request, res: Response) => {
  try {
    const { itinerary, segments } = req.body

    if (!itinerary) {
      return res.status(400).json({ error: 'Missing itinerary data' })
    }

    if (segments && Array.isArray(segments) && segments.length > 0) {
      const validationResults = await Promise.all(
        segments.map((segment: any, index: number) =>
          validateSegment(segment).then(result => ({ index, ...result }))
        )
      )

      const invalidSegments = validationResults.filter(r => !r.valid)
      if (invalidSegments.length > 0) {
        return res.status(400).json({
          error: 'Segment validation failed',
          details: invalidSegments.map(seg => ({
            segment_index: seg.index,
            errors: seg.errors
          }))
        })
      }
    }

    const createdItinerary: any = await itinerariesClient.post('/itineraries', itinerary)

    let createdSegments: any[] = []
    if (segments && Array.isArray(segments) && segments.length > 0) {
      createdSegments = await Promise.all(
        segments.map((segment: any) =>
          itinerariesClient.post(`/itineraries/${createdItinerary.id}/segments`, segment)
        )
      )
    }

    res.status(201).json({
      ...createdItinerary,
      segments: createdSegments,
    })
  } catch (error: any) {
    console.error('Error creating composite itinerary:', error)
    res.status(500).json({ error: error.message || 'Failed to create composite itinerary' })
  }
})

router.get('/quotes/:itinerary_id', async (req: Request, res: Response) => {
  try {
    const itineraryId = req.params.itinerary_id

    const segments: any[] = await itinerariesClient.get(`/itineraries/${itineraryId}/segments`)

    if (segments.length === 0) {
      return res.json({ total: 0, segments: [] })
    }

    const segmentQuotes = await Promise.all(
      segments.map(async (segment: any) => {
        const [city, rates]: any[] = await Promise.all([
          destinationsClient.get(`/cities/${segment.city_id}`),
          pricingClient.get(`/rates?city_id=${segment.city_id}&lodging_class=${segment.lodging_class}`),
        ])

        const startDate = new Date(segment.start_date)
        const endDate = new Date(segment.end_date)
        const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

        const rate = Array.isArray(rates) && rates.length > 0 ? rates[0] : null
        const pricePerNight = rate ? parseFloat(rate.price_per_night) : 0
        const segmentTotal = pricePerNight * nights

        return {
          segment_id: segment.id,
          city_name: city.name,
          lodging_class: segment.lodging_class,
          nights,
          price_per_night: pricePerNight,
          currency: city.currency,
          total: segmentTotal,
        }
      })
    )

    const grandTotal = segmentQuotes.reduce((sum, quote) => sum + quote.total, 0)

    res.json({
      itinerary_id: itineraryId,
      total: grandTotal,
      segments: segmentQuotes,
    })
  } catch (error: any) {
    console.error('Error calculating quotes:', error)
    res.status(500).json({ error: error.message || 'Failed to calculate quotes' })
  }
})

router.post('/quotes', async (req: Request, res: Response) => {
  try {
    const quote = await pricingClient.post('/quotes', req.body)
    res.status(201).json(quote)
  } catch (error: any) {
    console.error('Error creating quote:', error)
    res.status(500).json({ error: error.message || 'Failed to create quote' })
  }
})

export default router
