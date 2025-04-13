#!/usr/bin/env python3
# filepath: /Users/ravichandrabasireddy/Documents/GitHub/picQ-picture-query/picq-server/bulk_ingest.py

import os
import sys
import argparse
import mimetypes
import requests
import logging
from pathlib import Path
from tqdm import tqdm  # For progress bar

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define allowed image MIME types (same as in photo.py)
ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/tiff", 
    "image/bmp",
    "image/heic"
]

# Common image extensions for fallback detection
COMMON_IMAGE_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp', '.heic', '.heif'
}

def get_mime_type(file_path):
    """Determine the MIME type of a file."""
    mime_type, _ = mimetypes.guess_type(file_path)
    return mime_type

def is_valid_image(file_path):
    """Check if the file is a valid image type."""
    # Check by MIME type first
    mime_type = get_mime_type(file_path)
    if mime_type in ALLOWED_IMAGE_TYPES:
        return True
    
    # Fallback to extension check
    file_extension = os.path.splitext(file_path)[1].lower()
    return file_extension in COMMON_IMAGE_EXTENSIONS

def scan_directory(directory_path):
    """Scan directory for image files."""
    image_files = []
    
    logger.info(f"Scanning directory: {directory_path}")
    
    for root, _, files in os.walk(directory_path):
        for file in files:
            file_path = os.path.join(root, file)
            if is_valid_image(file_path):
                image_files.append(file_path)
    
    logger.info(f"Found {len(image_files)} valid image files")
    return image_files

def analyze_image(file_path, api_url="http://localhost:8000/photo/analyze"):
    """Send image to the API for analysis."""
    try:
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f, get_mime_type(file_path) or 'application/octet-stream')}
            response = requests.post(api_url, files=files)
            
        if response.status_code == 200:
            logger.info(f"Successfully analyzed: {os.path.basename(file_path)}")
            return response.json()
        else:
            logger.error(f"Failed to analyze {os.path.basename(file_path)}: {response.status_code}, {response.text}")
            return None
    except Exception as e:
        logger.error(f"Error analyzing {file_path}: {str(e)}")
        return None

def main():
    parser = argparse.ArgumentParser(description='Bulk ingest images from a folder to the photo analyzer API.')
    parser.add_argument('folder', nargs='?', default=None, help='Path to the folder containing images')
    parser.add_argument('--api-url', default='http://localhost:8000/photo/analyze', help='URL for the photo analyze API endpoint')
    
    args = parser.parse_args()
    
    # If no folder path is provided, ask for it
    folder_path = args.folder
    if not folder_path:
        folder_path = input("Please enter the path to the folder containing images: ").strip()
    
    # Check if the folder exists
    if not os.path.isdir(folder_path):
        logger.error(f"The folder '{folder_path}' does not exist or is not a directory.")
        sys.exit(1)
    
    # Initialize mimetypes
    mimetypes.init()
    
    # Add HEIC to mimetypes if not present
    if '.heic' not in mimetypes.types_map:
        mimetypes.add_type('image/heic', '.heic')
    if '.HEIC' not in mimetypes.types_map:
        mimetypes.add_type('image/heic', '.HEIC')
    
    # Scan directory for image files
    image_files = scan_directory(folder_path)
    
    if not image_files:
        logger.warning(f"No valid image files found in '{folder_path}'")
        sys.exit(0)
    
    # Process each image file
    success_count = 0
    failed_count = 0
    total_count = len(image_files)
    logger.info("Starting bulk analysis...")
    
    for i, file_path in enumerate(tqdm(image_files, desc="Processing images"), 1):
        logger.info(f"Processing image {i}/{total_count}: {os.path.basename(file_path)}")
        result = analyze_image(file_path, args.api_url)
        if result:
            success_count += 1
        else:
            failed_count += 1
        
        # Log running counts after each image
        logger.info(f"Progress: {i}/{total_count} - Success: {success_count}, Failed: {failed_count}")
    
    logger.info(f"Completed processing: {success_count} successful, {failed_count} failed out of {len(image_files)} images")

if __name__ == "__main__":
    main()