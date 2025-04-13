import aiohttp
import tempfile
import os
from typing import Optional
from fastapi import HTTPException
from google import genai
from google.genai import types
from .config import get_settings
from .logging_config import setup_logging

# Initialize settings and logger
settings = get_settings()
logger = setup_logging()

async def download_image(url: str) -> str:
    """Download image from URL and save to a temporary file.
    
    Args:
        url: URL of the image to download
        
    Returns:
        Path to the downloaded temporary file
        
    Raises:
        Exception: If the download fails
    """
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 200:
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
                temp_file_path = temp_file.name
                
                with open(temp_file_path, 'wb') as f:
                    f.write(await response.read())
                
                return temp_file_path
            else:
                raise Exception(f"Failed to download image: {response.status}")

async def generate_embeddings(text_content: str, client=None) -> list:
    """
    Generate vector embeddings from text content using Gemini API
    
    Args:
        text_content: The text to convert to vector embeddings
        client: Optional existing Google Generative AI client
        
    Returns:
        List of embedding values
    """
    try:
        if not client:
            # Use settings instead of environment variables directly
            client = genai.Client(api_key=settings.GOOGLE_GENERATIVE_AI_API_KEY)
            logger.info("Created new Gemini client for embeddings")
        
        # Use embedding model from settings if available, otherwise use default
        embedding_model = getattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-exp-03-07")
        
        result = client.models.embed_content(
            model=embedding_model,
            contents=text_content,
            
            config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY", output_dimensionality=1536)
        )
        
        # Extract the numerical values from the ContentEmbedding object
        # The values are in result.embeddings[0].values for the Gemini API
        if result and result.embeddings:
            embedding_values = result.embeddings[0].values
            logger.info(f"Generated embeddings with {len(embedding_values)} dimensions")
            return embedding_values
        else:
            raise ValueError("No embeddings returned from API")
            
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate embeddings: {str(e)}")