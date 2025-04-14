import os
from google import genai
from google.genai import types

from ...core.prompts import get_intresting_details_prompt
from ...core.config import get_settings

async def generate_intresting_details(image_analysis: str, client=None):
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
                types.Part.from_text(text=get_intresting_details_prompt(image_analysis)),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=genai.types.Schema(
                        type = genai.types.Type.OBJECT,
                        required = ["interesting_details"],
                        properties = {
                            "interesting_details": genai.types.Schema(
                                type = genai.types.Type.ARRAY,
                                items = genai.types.Schema(
                                    type = genai.types.Type.STRING,
                                ),
                            ),
                            "explanation": genai.types.Schema(
                                type = genai.types.Type.STRING,
                            ),
                            "heading": genai.types.Schema(
                                type = genai.types.Type.STRING,
                            ),
                        },
                    ),
    )
    
    return client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    )