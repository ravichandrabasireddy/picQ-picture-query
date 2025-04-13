import uuid
import os
import io
import aiohttp
from typing import Optional, Dict, Any
from fastapi import UploadFile, HTTPException
from PIL import Image, ExifTags
from PIL.ExifTags import TAGS, GPSTAGS
from ...core.database import get_supabase_client
from ...core.logging_config import setup_logging
from ...core.config import get_settings

logger = setup_logging()
settings = get_settings()

# Valid image MIME types
ALLOWED_IMAGE_TYPES = [
    "image/jpeg", 
    "image/png", 
    "image/gif", 
    "image/webp", 
    "image/tiff", 
    "image/bmp",
    "image/heic"
]

# Get geocoding API details from settings
GEOCODING_URI_BASE = settings.GEOCODING_URI_BASE
GEOCODING_API_KEY = settings.GEOCODING_API_KEY

async def get_location_details_from_coordinates(lat: float, lng: float) -> Dict[str, Any]:
    """
    Get detailed location information using Google Maps Geocoding API with aiohttp
    
    Args:
        lat: Latitude
        lng: Longitude
        
    Returns:
        dict: Location details including place_id, formatted_address, and types
    """
    location_details = {
        "place_id": None,
        "formatted_address": None,
        "location_types": None
    }
    
    if not GEOCODING_API_KEY:
        logger.warning("Geocoding API key not found in environment variables")
        return location_details
        
    try:
        # Construct the API URL parameters
        params = {
            "latlng": f"{lat},{lng}",
            "key": GEOCODING_API_KEY
        }
        
        # Make the async request using aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(GEOCODING_URI_BASE, params=params) as response:
                data = await response.json()
                
                # Check if we have results
                if data.get("status") == "OK" and data.get("results"):
                    # Get the first result (most accurate)
                    first_result = data["results"][0]
                    
                    # Extract the required fields
                    location_details["place_id"] = first_result.get("place_id")
                    location_details["formatted_address"] = first_result.get("formatted_address")
                    location_details["location_types"] = first_result.get("types")
                    
                    logger.info(f"Retrieved location details for coordinates: {lat}, {lng}")
                else:
                    logger.warning(f"No results found for coordinates: {lat}, {lng}")
            
    except Exception as e:
        logger.error(f"Error fetching location details: {str(e)}")
        
    return location_details



async def extract_image_metadata(image: Image.Image) -> Dict[str, Any]:
    """
    Extract metadata from image including location and timestamp

    Args:
        image: PIL Image object

    Returns:
        dict: Extracted metadata
    """
    metadata = {
        "datetime": None,
        "gps_latitude": None,
        "gps_longitude": None,
        "location": None,
        "device": None,
        "place_id": None,
        "formatted_address": None,
        "location_types": None
    }

    try:
        if hasattr(image, '_getexif') and image._getexif():
            exif = {
                TAGS.get(k, k): v
                for k, v in image._getexif().items()
                if k in TAGS
            }

            # Extract date/time
            if "DateTimeOriginal" in exif:
                metadata["datetime"] = exif["DateTimeOriginal"]
            elif "DateTime" in exif:
                metadata["datetime"] = exif["DateTime"]

            # Extract device info
            if "Make" in exif and "Model" in exif:
                metadata["device"] = f"{exif['Make']} {exif['Model']}"

            # Extract GPS data if available
            if "GPSInfo" in exif:
                gps_info = {}
                for key, val in exif["GPSInfo"].items():
                    if key in GPSTAGS:
                        gps_info[GPSTAGS[key]] = val

                if "GPSLatitude" in gps_info and "GPSLongitude" in gps_info:
                    logger.info(f"Extracting GPS coordinates from image metadata {gps_info}")

                    def convert_to_degrees(value):
                        def to_float(x):
                            return float(x) if not isinstance(x, tuple) else x[0] / x[1]
                        d = to_float(value[0])
                        m = to_float(value[1])
                        s = to_float(value[2])
                        return d + (m / 60.0) + (s / 3600.0)

                    def convert_to_decimal(value, ref):
                        decimal = convert_to_degrees(value)
                        if ref in ['S', 'W']:
                            decimal = -decimal
                        return decimal

                    lat = convert_to_decimal(
                        gps_info["GPSLatitude"],
                        gps_info.get("GPSLatitudeRef", "N")
                    )
                    lng = convert_to_decimal(
                        gps_info["GPSLongitude"],
                        gps_info.get("GPSLongitudeRef", "E")
                    )

                    metadata["gps_latitude"] = lat
                    metadata["gps_longitude"] = lng
                    metadata["location"] = f"{lat}, {lng}"

                    # Get detailed location information if coordinates are available
                    if lat and lng:
                        location_details = await get_location_details_from_coordinates(lat, lng)
                        metadata.update(location_details)

    except Exception as e:
        logger.error(f"Error extracting image metadata: {str(e)}")

    return metadata
async def upload_image_to_storage(
    file: UploadFile,
    bucket_name: str = "picq-photo"
) -> dict:
    """
    Upload an image from form data to Supabase storage and return the URL.
    
    Args:
        file: The file from form data
        bucket_name: The Supabase storage bucket name
        
    Returns:
        dict: Contains success status, URL, filename, and extracted metadata
        
    Raises:
        HTTPException: If file is not an image or upload fails
    """
    try:
        # Check if file is an image
        content_type = file.content_type
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400, 
                detail=f"File must be an image. Received: {content_type}"
            )
        
        # Read file content
        contents = await file.read()
        
        # Verify it's a valid image by trying to open it
        try:
            img = Image.open(io.BytesIO(contents))
            # Extract metadata
            metadata = await extract_image_metadata(img)
        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Generate a unique filename
        file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        
        # Get Supabase client
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
        # Upload file to Supabase storage
        supabase.storage.from_(bucket_name).upload(unique_filename, contents, {
            'content-type': f'image/{file_ext[1:]}'})
        
        # Get public URL for the uploaded file
        file_url = supabase.storage.from_(bucket_name).get_public_url(unique_filename)
        
        logger.info(f"File uploaded successfully: {unique_filename}")
        return {
            "success": True,
            "url": file_url,
            "filename": unique_filename,
            "metadata": metadata
        }
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")