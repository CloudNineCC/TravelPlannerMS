export function generateOpenAPISpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Travel Planner Composite API',
      version: '0.1.0',
      description: 'Composite API that aggregates and orchestrates Destinations, Pricing, and Itineraries microservices'
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:8080',
        description: 'Travel Planner Composite Microservice'
      }
    ],
    paths: {
      '/composite/itineraries/{id}': {
        get: {
          summary: 'Get full itinerary with enriched data',
          description: 'Fetches itinerary details and enriches segments with city and pricing information',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/EnrichedItinerary' }
                }
              }
            },
            '500': {
              description: 'Internal server error'
            }
          }
        }
      },
      '/composite/itineraries': {
        post: {
          summary: 'Create itinerary with segments',
          description: 'Creates an itinerary with segments, validating foreign key constraints',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateItineraryRequest' }
              }
            }
          },
          responses: {
            '201': {
              description: 'Itinerary created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreatedItinerary' }
                }
              }
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: { type: 'string' },
                      details: { type: 'array' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/composite/destinations': {
        get: {
          summary: 'Get all cities with seasonal info',
          description: 'Fetches all cities and enriches them with their seasonal information',
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/EnrichedCity' }
                  }
                }
              }
            },
            '500': {
              description: 'Internal server error'
            }
          }
        }
      },
      '/composite/quotes/{itinerary_id}': {
        get: {
          summary: 'Get pricing quotes for an itinerary',
          description: 'Calculates pricing quotes for all segments in an itinerary',
          parameters: [
            {
              name: 'itinerary_id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ItineraryQuote' }
                }
              }
            },
            '500': {
              description: 'Internal server error'
            }
          }
        }
      }
    },
    components: {
      schemas: {
        EnrichedItinerary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            owner_user_id: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            segments: {
              type: 'array',
              items: { $ref: '#/components/schemas/EnrichedSegment' }
            }
          }
        },
        EnrichedSegment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            itinerary_id: { type: 'string', format: 'uuid' },
            city_id: { type: 'string', format: 'uuid' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            lodging_class: { type: 'string', enum: ['HOSTEL', 'STANDARD', 'PREMIUM'] },
            city_name: { type: 'string' },
            country_code: { type: 'string' },
            currency: { type: 'string' },
            rates: {
              type: 'array',
              items: { type: 'object' }
            }
          }
        },
        EnrichedCity: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            country_code: { type: 'string' },
            currency: { type: 'string' },
            seasons: {
              type: 'array',
              items: { $ref: '#/components/schemas/Season' }
            }
          }
        },
        Season: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            city_id: { type: 'string', format: 'uuid' },
            season_name: { type: 'string', enum: ['peak', 'shoulder', 'off'] },
            start_month: { type: 'integer', minimum: 1, maximum: 12 },
            end_month: { type: 'integer', minimum: 1, maximum: 12 }
          }
        },
        CreateItineraryRequest: {
          type: 'object',
          properties: {
            itinerary: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                owner_user_id: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string' },
                start_date: { type: 'string', format: 'date' },
                end_date: { type: 'string', format: 'date' }
              },
              required: ['name', 'owner_user_id']
            },
            segments: {
              type: 'array',
              items: { $ref: '#/components/schemas/SegmentInput' }
            }
          },
          required: ['itinerary']
        },
        SegmentInput: {
          type: 'object',
          properties: {
            city_id: { type: 'string', format: 'uuid' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            lodging_class: { type: 'string', enum: ['HOSTEL', 'STANDARD', 'PREMIUM'] },
            sequence_order: { type: 'integer' },
            notes: { type: 'string' }
          },
          required: ['city_id', 'start_date', 'end_date', 'lodging_class']
        },
        CreatedItinerary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            owner_user_id: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            segments: {
              type: 'array',
              items: { type: 'object' }
            }
          }
        },
        ItineraryQuote: {
          type: 'object',
          properties: {
            itinerary_id: { type: 'string', format: 'uuid' },
            total: { type: 'number' },
            segments: {
              type: 'array',
              items: { $ref: '#/components/schemas/SegmentQuote' }
            }
          }
        },
        SegmentQuote: {
          type: 'object',
          properties: {
            segment_id: { type: 'string', format: 'uuid' },
            city_name: { type: 'string' },
            lodging_class: { type: 'string', enum: ['HOSTEL', 'STANDARD', 'PREMIUM'] },
            nights: { type: 'integer' },
            price_per_night: { type: 'number' },
            currency: { type: 'string' },
            total: { type: 'number' }
          }
        }
      }
    }
  }
}

