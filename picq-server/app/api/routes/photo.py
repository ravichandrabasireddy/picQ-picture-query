from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status, Request
from typing import Dict, Any, List

from ..photo_engine.ingest_photo import ingest_photo
from ...core.logging_config import setup_logging

router = APIRouter(
    prefix="/photo",
    tags=["photo"],
)

logger = setup_logging()

# Define allowed image MIME types
ALLOWED_IMAGE_TYPES: List[str] = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/tiff", 
    "image/bmp",
    "image/heic"
]

@router.post("/analyze", status_code=status.HTTP_200_OK, response_model=Dict[str, Any])
async def analyze_photo(
    file: UploadFile = File(...),
    request: Request = None
) -> Dict[str, Any]:
    """
    Upload a photo for analysis and storage
    
    - **file**: Image file to analyze (supported formats: JPEG, PNG, GIF, WebP, TIFF, BMP, HEIC)
    
    Returns:
        Dict containing success status, photo ID, URL, and analysis text
    """
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file uploaded"
        )
        
    # Check if file is an accepted image type
    content_type = file.content_type
    if not content_type or content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, 
            detail=f"Unsupported file format. Please upload a photo in one of these formats: {', '.join([t.split('/')[1].upper() for t in ALLOWED_IMAGE_TYPES])}"
        )
    
    # Get the application-wide Gemini client
    genai_client = request.app.state.genai_client
    if not genai_client:
        logger.warning("Application Gemini client not available, will create one on demand")
    
    # Process the uploaded photo with the existing client
    try:
        result = await ingest_photo(file, genai_client)
        return result
    except Exception as e:
        logger.error(f"Error processing photo: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process the photo. Please try again with a different image."
        )

