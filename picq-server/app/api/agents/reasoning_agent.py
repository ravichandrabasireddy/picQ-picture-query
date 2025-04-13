import os
from google import genai
from google.genai import types

from ...core.prompts import get_reasoning_prompt
from ...core.config import get_settings

async def generate_reasoning(query: str, extracted_details: str, formatted_query: str, similar_image_analysis: str, image_analysis: str = None, client=None):
    """Generate reasoning for why a similar image matches the query using Gemini API.
    
    Args:
        query: The user's original search query
        extracted_details: Extracted details from the query
        formatted_query: The formatted search query
        similar_image_analysis: Analysis of the similar image found
        image_analysis: Optional analysis of the query image (if one was provided)
        client: Google Generative AI client instance (if None, a new one will be created)
        
    Returns:
        Stream of content chunks from the Gemini API
    """
    if client is None:
        settings = get_settings()
        client = genai.Client(
            api_key=settings.GOOGLE_GENERATIVE_AI_API_KEY,
        )

    model = "gemini-2.0-flash"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=get_reasoning_prompt(query, extracted_details, formatted_query, similar_image_analysis, image_analysis)),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=types.Schema(
            type=types.Type.OBJECT,
            required=["reasons"],
            properties={
                "reasons": types.Schema(
                    type=types.Type.ARRAY,
                    items=types.Schema(
                        type=types.Type.STRING,
                    ),
                ),
            },
        ),
    )
    
    return client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    )