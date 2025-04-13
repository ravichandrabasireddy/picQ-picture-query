
import os
from google import genai
from google.genai import types

from ...core.prompts import get_photo_analysis_prompt



async def generate_analysis(image_path: str, date: str, location: str, client=None):
    """Generate image analysis using Gemini API.
    
    Args:
        image_path: Path to the image file
        date: Date information to include in the analysis
        location: Location information to include in the analysis
        client: Google Generative AI client instance (if None, a new one will be created)
        
    Returns:
        Stream of content chunks from the Gemini API
    """
    if client is None:
        client = genai.Client(
            api_key=os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY"),
        )

    file = client.files.upload(file=image_path)
    
    model = "gemini-2.5-pro-preview-03-25"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_uri(
                    file_uri=file.uri,
                    mime_type=file.mime_type,
                ),
                types.Part.from_text(text=get_photo_analysis_prompt(date, location)),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        response_mime_type="text/plain",
    )
    
    try:
        return client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        )
    finally:
        # Cleanup the temporary file
        try:
            os.unlink(image_path)
        except:
            pass