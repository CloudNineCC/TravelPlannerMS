#!/bin/bash

set -e

PROJECT_ID="cloudnine-475221"
REGION="us-central1"
SERVICE_NAME="travel-planner-ms"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Get environment variables (can be set before calling this script)
DESTINATIONS_MS_URL="${DESTINATIONS_MS_URL:-http://136.113.150.64:3001}"
PRICING_MS_URL="${PRICING_MS_URL:-http://136.113.150.64:3002}"
ITINERARIES_MS_URL="${ITINERARIES_MS_URL:-https://itineraries-ms-izocsrgyaq-uc.a.run.app}"

echo "Deploying ${SERVICE_NAME} to Cloud Run..."

# Build Docker image
echo "Building Docker image..."
docker build -t ${IMAGE_NAME}:latest .

# Push to Google Container Registry
echo "Pushing image to GCR..."
docker push ${IMAGE_NAME}:latest

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME}:latest \
  --platform managed \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --allow-unauthenticated \
  --set-env-vars "DESTINATIONS_MS_URL=${DESTINATIONS_MS_URL}" \
  --set-env-vars "PRICING_MS_URL=${PRICING_MS_URL}" \
  --set-env-vars "ITINERARIES_MS_URL=${ITINERARIES_MS_URL}" \
  --set-secrets "GOOGLE_CLIENT_ID=google-client-id:latest" \
  --set-secrets "JWT_SECRET=jwt-secret:latest" \
  --port 8080 \
  --max-instances 10 \
  --min-instances 0

echo "✓ ${SERVICE_NAME} deployed successfully!"
gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)'
