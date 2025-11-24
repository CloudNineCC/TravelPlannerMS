import { Router, Request, Response } from 'express'
import { destinationsClient, pricingClient, itinerariesClient } from '../services.js'

const router = Router()

// Helper: Validate city exists in DestinationsMS
async function validateCityExists(cityId: string): Promise<{ valid: boolean; error?: string }> {
  try {
    await destinationsClient.get(`/cities/${cityId}`)
    return { valid: true }
  } catch (error: any) {
    if (error.message.includes('404')) {
      return { valid: false, error: `City with ID '${cityId}' does not exist` }
    }
    throw error // Re-throw non-404 errors
  }
}

// Helper: Validate lodging class exists in PricingMS
async function validateLodgingClass(lodgingClass: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const classes: any[] = await pricingClient.get('/lodging-classes')
    // Handle both plain string array and object array
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

// Helper: Validate segment data
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

  // Validate date range
  if (segment.start_date && segment.end_date) {
    const start = new Date(segment.start_date)
    const end = new Date(segment.end_date)
    if (end <= start) {
      errors.push('end_date must be after start_date')
    }
  }

  return { valid: errors.length === 0, errors }
}

// GET /composite/itineraries/:id - Get full itinerary with enriched data
router.get('/itineraries/:id', async (req: Request, res: Response) => {
  try {
    const itineraryId = req.params.id

    // Fetch itinerary details and segments in parallel
    const [itinerary, segments]: any[] = await Promise.all([
      itinerariesClient.get(`/itineraries/${itineraryId}`),
      itinerariesClient.get(`/itineraries/${itineraryId}/segments`),
    ])

    // Enrich segments with city and pricing data
    const enrichedSegments = await Promise.all(
      segments.map(async (segment: any) => {
        const [city, rates]: any[] = await Promise.all([
          destinationsClient.get(`/cities/${segment.city_id}`),
          pricingClient.get(`/rates?city_id=${segment.city_id}&lodging_class=${segment.lodging_class}`),
        ])

        return {
          ...segment,
          city_name: city.name,
          country_code: city.country_code,
          currency: city.currency,
          rates: rates || [],
        }
      })
    )

    res.json({
      ...itinerary,
      segments: enrichedSegments,
    })
  } catch (error: any) {
    console.error('Error fetching composite itinerary:', error)
    res.status(500).json({ error: error.message || 'Failed to fetch composite itinerary' })
  }
})

// GET /composite/destinations - Get all cities with seasonal info
router.get('/destinations', async (_req: Request, res: Response) => {
  try {
    // Fetch cities and seasons in parallel (with limit=100 to get all cities)
    const [citiesResponse, seasonsResponse]: any[] = await Promise.all([
      destinationsClient.get('/cities?limit=100'),
      destinationsClient.get('/seasons?limit=100'),
    ])

    // Extract data from paginated responses
    const cities = citiesResponse.data || citiesResponse
    const seasons = seasonsResponse.data || seasonsResponse

    // Group seasons by city_id
    const seasonsByCity = seasons.reduce((acc: any, season: any) => {
      if (!acc[season.city_id]) {
        acc[season.city_id] = []
      }
      acc[season.city_id].push(season)
      return acc
    }, {})

    // Enrich cities with their seasons
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

// POST /composite/itineraries - Create itinerary with segments (with FK validation)
router.post('/itineraries', async (req: Request, res: Response) => {
  try {
    const { itinerary, segments } = req.body

    if (!itinerary) {
      return res.status(400).json({ error: 'Missing itinerary data' })
    }

    // Validate all segments before creating anything
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

    // Create the itinerary first
    const createdItinerary: any = await itinerariesClient.post('/itineraries', itinerary)

    // Create segments if provided
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

// GET /composite/quotes/:itinerary_id - Get pricing quotes for an itinerary
router.get('/quotes/:itinerary_id', async (req: Request, res: Response) => {
  try {
    const itineraryId = req.params.itinerary_id

    // Fetch segments
    const segments: any[] = await itinerariesClient.get(`/itineraries/${itineraryId}/segments`)

    if (segments.length === 0) {
      return res.json({ total: 0, segments: [] })
    }

    // Fetch city info and rates for each segment in parallel
    const segmentQuotes = await Promise.all(
      segments.map(async (segment: any) => {
        const [city, rates]: any[] = await Promise.all([
          destinationsClient.get(`/cities/${segment.city_id}`),
          pricingClient.get(`/rates?city_id=${segment.city_id}&lodging_class=${segment.lodging_class}`),
        ])

        // Calculate nights
        const startDate = new Date(segment.start_date)
        const endDate = new Date(segment.end_date)
        const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

        // Get the rate (if available)
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

export default router