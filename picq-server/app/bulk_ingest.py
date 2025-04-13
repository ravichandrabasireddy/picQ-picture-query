#!/usr/bin/env python3
# filepath: /Users/ravichandrabasireddy/Documents/GitHub/picQ-picture-query/picq-server/bulk_ingest.py

import os
import sys
import argparse
import mimetypes
import logging
import asyncio
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

async def analyze_image(session, file_path, api_url="http://localhost:8000/photo/analyze", semaphore=None):
    """Send image to the API for analysis using aiohttp."""
    try:
        # Use semaphore if provided to limit concurrent requests
        if semaphore:
            async with semaphore:
                return await _analyze_image(session, file_path, api_url)
        else:
            return await _analyze_image(session, file_path, api_url)
    except Exception as e:
        logger.error(f"Error analyzing {file_path}: {str(e)}")
        return None

async def _analyze_image(session, file_path, api_url):
    """Internal function to handle the actual HTTP request."""
    try:
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        file_name = os.path.basename(file_path)
        mime_type = get_mime_type(file_path) or 'application/octet-stream'
        
        data = aiohttp.FormData()
        data.add_field('file', 
                      file_data,
                      filename=file_name,
                      content_type=mime_type)
        
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

async def process_images(image_files, api_url, max_concurrent=10):
    """Process multiple images concurrently with a limit."""
    success_count = 0
    failed_count = 0
    total_count = len(image_files)
    
    # Create a semaphore to limit concurrent requests
    semaphore = asyncio.Semaphore(max_concurrent)
    
    # Create a progress bar
    pbar = tqdm(total=total_count, desc="Processing images")
    
    async with aiohttp.ClientSession() as session:
        tasks = []
        for file_path in image_files:
            task = asyncio.create_task(analyze_image(session, file_path, api_url, semaphore))
            
            # Add a callback to update counters and progress bar
            def callback(task, file_path=file_path, i=len(tasks)+1):
                nonlocal success_count, failed_count
                try:
                    result = task.result()
                    if result:
                        success_count += 1
                    else:
                        failed_count += 1
                    
                    logger.info(f"Progress: {i}/{total_count} - Success: {success_count}, Failed: {failed_count}")
                    pbar.update(1)
                except Exception as e:
                    failed_count += 1
                    logger.error(f"Callback error for {file_path}: {str(e)}")
                    pbar.update(1)
            
            task.add_done_callback(callback)
            tasks.append(task)
        
        # Wait for all tasks to complete
        await asyncio.gather(*tasks, return_exceptions=True)
    
    pbar.close()
    return success_count, failed_count

async def async_main(folder_path, api_url, max_concurrent):
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
    
    # Process each image file concurrently
    logger.info("Starting bulk analysis...")
    success_count, failed_count = await process_images(image_files, api_url, max_concurrent)
    
    logger.info(f"Completed processing: {success_count} successful, {failed_count} failed out of {len(image_files)} images")

def main():
    parser = argparse.ArgumentParser(description='Bulk ingest images from a folder to the photo analyzer API.')
    parser.add_argument('folder', nargs='?', default=None, help='Path to the folder containing images')
    parser.add_argument('--api-url', default='http://localhost:8000/photo/analyze', help='URL for the photo analyze API endpoint')
    parser.add_argument('--max-concurrent', type=int, default=10, help='Maximum number of concurrent requests')
    
    args = parser.parse_args()
    
    # If no folder path is provided, ask for it
    folder_path = args.folder
    if not folder_path:
        folder_path = input("Please enter the path to the folder containing images: ").strip()
    
    # Check if the folder exists
    if not os.path.isdir(folder_path):
        logger.error(f"The folder '{folder_path}' does not exist or is not a directory.")
        sys.exit(1)
    
    # Run the async main function
    asyncio.run(async_main(folder_path, args.api_url, args.max_concurrent))

if __name__ == "__main__":
    main()