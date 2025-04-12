#!/bin/bash

# Get the storage bucket from environment variables
BUCKET=$(grep NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET .env.local | cut -d '=' -f2 | tr -d '"')

# Deploy CORS configuration
gsutil cors set cors.json gs://$BUCKET

echo "CORS configuration deployed to $BUCKET" 