#!/usr/bin/env python3
# filepath: /Users/ravichandrabasireddy/Documents/GitHub/picQ-picture-query/picq-server/bulk_ingest.py

import os
import sys
import argparse
import mimetypes
import logging
import asyncio
import shutil
from pathlib import Path
import aiohttp
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

async def analyze_image(session, file_path, api_url="http://localhost:8000/photo/analyze"):
    """Send image to the API for analysis using aiohttp."""
    try:
        return await _analyze_image(session, file_path, api_url)
    except Exception as e:
        logger.error(f"Error analyzing {file_path}: {str(e)}")
        return None

async def _analyze_image(session, file_path, api_url, compress=False, max_size_kb=500):
    """Internal function to handle the actual HTTP request without compression."""
    try:
        file_name = os.path.basename(file_path)
        original_mime_type = get_mime_type(file_path) or 'application/octet-stream'
        
        # Use original file (no compression)
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        data = aiohttp.FormData()
        data.add_field('file', 
                      file_data,
                      filename=file_name,
                      content_type=original_mime_type)
        
        async with session.post(api_url, data=data) as response:
            if response.status == 200:
                logger.info(f"Successfully analyzed: {file_name}")
                return await response.json()
            else:
                error_text = await response.text()
                logger.error(f"Failed to analyze {file_name}: {response.status}, {error_text}")
                return None
    except Exception as e:
        logger.error(f"Error processing {file_path}: {str(e)}")
        return None

async def process_images(image_files, api_url, processed_dir=None):
    """Process images one at a time in serial fashion and move successful ones."""
    success_count = 0
    failed_count = 0
    total_count = len(image_files)
    
    # Create processed directory if it doesn't exist
    if processed_dir and not os.path.exists(processed_dir):
        os.makedirs(processed_dir)
        logger.info(f"Created directory for processed images: {processed_dir}")
    
    # Create a progress bar
    pbar = tqdm(total=total_count, desc="Processing images")
    
    async with aiohttp.ClientSession() as session:
        for file_path in image_files:
            try:
                # Process each image serially
                result = await _analyze_image(session, file_path, api_url)
                
                if result:
                    success_count += 1
                    file_name = os.path.basename(file_path)
                    logger.info(f"Successfully processed: {file_name}")
                    
                    # Move the file to processed directory if specified
                    if processed_dir:
                        destination = os.path.join(processed_dir, file_name)
                        try:
                            shutil.move(file_path, destination)
                            logger.info(f"Moved {file_name} to {processed_dir}")
                        except Exception as move_error:
                            logger.error(f"Failed to move {file_name}: {str(move_error)}")
                else:
                    failed_count += 1
                    logger.warning(f"Failed to process: {os.path.basename(file_path)}")
                
                # Update the progress bar
                pbar.update(1)
                
                # Only log periodically to avoid excessive output
                if (success_count + failed_count) % 5 == 0:
                    logger.info(f"Progress: {success_count + failed_count}/{total_count} - Success: {success_count}, Failed: {failed_count}")
                
            except Exception as e:
                failed_count += 1
                logger.error(f"Error processing {file_path}: {str(e)}")
                pbar.update(1)
    
    pbar.close()
    return success_count, failed_count

async def async_main(folder_path, api_url, processed_dir=None):
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
        return
    
    # Process each image file serially
    logger.info("Starting bulk analysis...")
    success_count, failed_count = await process_images(
        image_files, api_url, processed_dir
    )
    
    logger.info(f"Completed processing: {success_count} successful, {failed_count} failed out of {len(image_files)} images")

def main():
    parser = argparse.ArgumentParser(description='Bulk ingest images from a folder to the photo analyzer API.')
    parser.add_argument('folder', nargs='?', default=None, help='Path to the folder containing images')
    parser.add_argument('--api-url', default='http://localhost:8000/photo/analyze', help='URL for the photo analyze API endpoint')
    parser.add_argument('--processed-dir', default=None, help='Directory to move successfully processed images to')
    
    args = parser.parse_args()
    
    # If no folder path is provided, ask for it
    folder_path = args.folder
    if not folder_path:
        folder_path = input("Please enter the path to the folder containing images: ").strip()
    
    # Check if the folder exists
    if not os.path.isdir(folder_path):
        logger.error(f"The folder '{folder_path}' does not exist or is not a directory.")
        sys.exit(1)
    
    # If processed dir not specified, ask if user wants to use a default location
    processed_dir = args.processed_dir
    if not processed_dir:
        use_default = input("Do you want to move processed images to a 'processed' subfolder? (y/n): ").strip().lower()
        if use_default == 'y':
            processed_dir = os.path.join(folder_path, "processed")
    
    # Run the async main function
    asyncio.run(async_main(
        folder_path, 
        args.api_url, 
        processed_dir
    ))

if __name__ == "__main__":
    main()