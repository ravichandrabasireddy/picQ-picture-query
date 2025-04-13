import os
import datetime
from typing import Dict, Any
from fastapi import UploadFile, HTTPException
from google import genai
from google.genai import types

from ...core.utils import download_image
from ...core.database import get_supabase_client
from ...core.logging_config import setup_logging
from .get_photo_url import upload_image_to_storage
from ..agents.photo_feature_extract_agent import generate_analysis

logger = setup_logging()

async def generate_embeddings(text_content: str) -> list:
    """
    Generate vector embeddings from text content using Gemini API
    
    Args:
        text_content: The text to convert to vector embeddings
        
    Returns:
        List of embedding values
    """
    try:
        client = genai.Client(api_key=os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY"))
        
        result = client.models.embed_content(
            model="gemini-embedding-exp-03-07",
            contents=text_content,
            config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY")
        )
        
        # Return the embedding values
        return result.embeddings
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate embeddings: {str(e)}")

async def store_photo_in_db(
    photo_url: str, 
    metadata: Dict[str, Any], 
    photo_analysis: str, 
    embeddings: list
) -> str:
    """
    Store photo information in the database using Supabase
    
    Args:
        photo_url: URL of the uploaded photo
        metadata: Extracted metadata from the photo
        photo_analysis: Text analysis of the photo
        embeddings: Vector embeddings of the analysis
        
    Returns:
        str: ID of the inserted photo record
    """
    try:
        # Format datetime if available
        taken_at = None
        if metadata.get("datetime"):
            try:
                # Convert from "YYYY:MM:DD HH:MM:SS" format
                taken_at = datetime.datetime.strptime(
                    metadata["datetime"], 
                    "%Y:%m:%d %H:%M:%S"
                ).isoformat()
            except:
                logger.warning(f"Could not parse datetime: {metadata['datetime']}")
        
        # Get Supabase client
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
        # Prepare data for insertion
        photo_data = {
            "photo_url": photo_url,
            "latitude": metadata.get("gps_latitude"),
            "longitude": metadata.get("gps_longitude"),
            "taken_at": taken_at,
            "device": metadata.get("device"),
            "place_id": metadata.get("place_id"),
            "formatted_address": metadata.get("formatted_address"),
            "location_types": metadata.get("location_types"),
            "photo_analysis": photo_analysis,
            "photo_analysis_vector": embeddings
        }
        
        # Insert data into the photos table
        result = supabase.table('photos').insert(photo_data).execute()
        
        if len(result.data) > 0:
            photo_id = result.data[0]['id']
            logger.info(f"Photo stored successfully with ID: {photo_id}")
            return str(photo_id)
        else:
            raise Exception("No ID returned from database insert")
            
    except Exception as e:
        logger.error(f"Error storing photo in database: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to store photo: {str(e)}")

async def ingest_photo(file: UploadFile) -> Dict[str, Any]:
    """
    Process an uploaded photo:
    1. Upload to storage and get URL
    2. Extract metadata
    3. Generate photo analysis
    4. Create vector embeddings
    5. Store in database
    
    Args:
        file: The image file from form data
        
    Returns:
        dict: Information about the processed photo including its ID
    """
    try:
        # 1. Upload image to storage
        upload_result = await upload_image_to_storage(file)
        photo_url = upload_result["url"]
        metadata = upload_result["metadata"]
        
        # 2. Download the image for analysis
        image_path = await download_image(photo_url)
        
        # 3. Get location and date information for analysis
        location = metadata.get("formatted_address", "")
        date = metadata.get("datetime", "")
        
        # 4. Generate photo analysis
        analysis_stream = await generate_analysis(image_path, date, location)
        photo_analysis = ""
        async for chunk in analysis_stream:
            photo_analysis += chunk.text
        
        # 5. Create vector embeddings
        embeddings = await generate_embeddings(photo_analysis)
        
        # 6. Store in database
        photo_id = await store_photo_in_db(photo_url, metadata, photo_analysis, embeddings)
        
        return {
            "success": True,
            "photo_id": photo_id,
            "photo_url": photo_url,
            "analysis": photo_analysis
        }
    
    except Exception as e:
        logger.error(f"Error ingesting photo: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing photo: {str(e)}")