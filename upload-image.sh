#!/usr/bin/env bash

# Script to quickly upload a single image to Cloudflare R2
# Usage: ./upload-image.sh path/to/image.jpg [domain]

# Check if the image path is provided
if [ -z "$1" ]; then
  echo "Error: Image path is required."
  echo "Usage: ./upload-image.sh path/to/image.jpg [domain]"
  exit 1
fi

# Get the image path from the first argument
IMAGE_PATH="$1"

# Check if the file exists
if [ ! -f "$IMAGE_PATH" ]; then
  echo "Error: Image file does not exist: $IMAGE_PATH"
  exit 1
fi

# Check if domain is provided as a second argument
if [ -n "$2" ]; then
  # Use the domain provided as the second argument
  bun run bunki upload-image "$IMAGE_PATH" --domain "$2"
else
  # Use the default domain from config
  bun run bunki upload-image "$IMAGE_PATH"
fi