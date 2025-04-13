import os
from google import genai
from google.genai import types

from ...core.prompts import get_query_extraction_prompt
from ...core.config import get_settings

async def generate_query_extraction(query: str, client=None):
    """Generate query extraction using Gemini API.
    
    Args:
        query: The user's search query to analyze
        client: Google Generative AI client instance (if None, a new one will be created)
        
    Returns:
        Stream of content chunks from the Gemini API
    """
    if client is None:
        settings = get_settings()
        client = genai.Client(
            api_key=settings.GOOGLE_GENERATIVE_AI_API_KEY,
        )

    model = "gemini-2.5-pro-preview-03-25"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=get_query_extraction_prompt(query)),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        response_mime_type="text/plain",
    )
    
    return client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    )