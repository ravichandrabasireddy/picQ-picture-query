def get_photo_analysis_prompt(date: str, location: str) -> str:
    """
    Get the prompt for photo analysis using Gemini AI.
    
    Args:
        date: Date information to include in the analysis
        location: Location information to include in the analysis
        
    Returns:
        The formatted prompt string
    """
    return f"""You are an advanced image analysis AI capable of providing detailed, multi-faceted analysis of visual content. Your task is to thoroughly examine an image and offer comprehensive information about various aspects of its content.

You will be provided with an image, along with its associated date and location metadata. Your goal is to analyze the image and describe multiple elements within it.

Here is the image to analyze, along with its metadata:

<image>
{{IMAGE}}
</image>  <metadata>
Date (mm\\dd\\yy hour:min): {date}
Location: {location}
</metadata>
</image_data>

Analyze the image for the following aspects:
1. Description: Provide a detailed description of the overall scene or subject matter.
2. Colors: Identify the dominant colors and any significant color patterns or schemes.
3. Text: Transcribe any visible text in the image.
4. Category: Determine the general category or type of image (e.g., portrait, landscape, still life, etc.).
5. Emotion: Describe the overall emotional tone or mood conveyed by the image.
6. Main Subject: Identify and describe the primary focus or subject of the image. 7. People: Identification and description of any people, including:
- Pose
- Emotion
- Clothing
- Other relevant details
8. Animals: If present, identify and describe any animals in the image.
9. Plants: If present, identify and describe any plants or vegetation in the image.
10. Objects: List and describe any significant objects or items in the image.
11. Composition: Analyze the layout and arrangement of elements in the image.
12. Lighting: Describe the lighting conditions and any notable effects.
13. Style: Identify any particular artistic or photographic style evident in the image.
14. Metadata Context: Incorporate the provided date and location information into your analysis, discussing how it relates to or informs your understanding of the image


Format your analysis using the following XML structure:
<image_analysis>
<description></description>
<colors></colors>
<text></text>
<category></category>
<emotion></emotion>
<main_subject></main_subject> <people></people>
<animals></animals>
<plants></plants>
<objects></objects>
<composition></composition>
<lighting></lighting>
<style></style>
<metadata_context></metadata_context>
</image_analysis>

Be as thorough and detailed as possible in your analysis. If you're unsure about any element, state your level of confidence or mention that it's an interpretation rather than a definitive identification.

After completing your analysis, provide a brief summary of the most notable or interesting aspects of the image in a <summary> tag.

Begin your analysis now."""


def get_query_extraction_prompt(query: str) -> str:
    """
    Get the prompt for query extraction using Gemini AI.
    
    Returns:
        The formatted prompt string
    """
    return f"""You are tasked with extracting key details from a given query. Your goal is to analyze the query and identify important elements such as location, date, colors, category, emotion, main subject, people, animals, plants, objects, style, lighting, composition, and any other relevant details.

Here are the specific details you should try to extract:
- Location
- Date
- Colors
- Category
- Emotion
- Main subject
- People
- Animals
- Plants
- Objects
- Style
- Lighting
- Composition

Follow these steps to complete the task:

1. Carefully read and analyze the following query:
<query>
{query}
</query>

2. Extract the key details listed above from the query. If a particular detail is not present or cannot be inferred from the query, omit it from your output.

3. Format your output using XML tags. Each extracted detail should be enclosed in its own tag, named after the detail. For example:
<location>New York City</location>
<date>2023-06-15</date>

4. If you identify any additional relevant details not explicitly mentioned in the list above, include them in your output using appropriate XML tags.

5. Ensure that your entire output is enclosed within a root <extracted_details> tag.

6. Be as specific and detailed as possible in your extractions, but avoid making assumptions that are not supported by the information given in the query.

7. If the query is ambiguous or lacks sufficient information for certain details, you may use tags like <possible_location> or <implied_emotion> to indicate less certain extractions.

Here's an example of how your output should be structured:

<extracted_details>
<location>Central Park, New York</location>
<date>2023-06-15</date>
<colors>green, blue</colors>
<category>nature photography</category>
<emotion>serene</emotion>
<main_subject>landscape</main_subject>
<objects>trees, lake</objects>
<lighting>natural, sunny</lighting>
<composition>wide-angle shot</composition>
<additional_detail>early morning</additional_detail>
</extracted_details>

Remember to adjust your output based on the actual content of the query, including only the details that are relevant and can be extracted from the given information."""

def get_format_query_prompt(original_query: str, extracted_details: str, image_analysis: str = None) -> str:
    """
    Get the prompt for formatting a query using Gemini AI.
    
    Returns:
        The formatted prompt string
    """
    return f"""You are an AI assistant specializing in formatting search queries for finding similar images based on given details and image analysis. Your task is to create a structured query that captures the essential visual and conceptual elements of the desired image.

You will be provided with the following information:

If an image was uploaded, you will have the image analysis:
<image_analysis>
{image_analysis}
</image_analysis>

<original_query>
{original_query}
</original_query>

<extracted_details>
{extracted_details}
</extracted_details>

Your goal is to analyze this information and create a formatted search query that combines the most relevant details. Follow these steps:

1. Analyze the provided information, focusing on key visual and conceptual elements.
2. Identify the most important aspects that define the image or desired image, such as:
   - Main subject
   - Colors
   - Composition
   - Lighting
   - Emotion or mood
   - Objects or elements present
   - Style or category
3. Combine these elements into a concise yet descriptive search query.
4. Ensure that the query captures both the visual and conceptual aspects of the image or desired image.
5. Use natural language and descriptive terms that would be effective for image search.

Before formulating your final response, wrap your analysis and decision-making process inside <query_formulation> tags. Consider the following:
- List and categorize key elements from the image analysis and extracted details.
- Consider the importance of each element for the search query.
- Brainstorm potential query formulations.
- What are the most distinctive features of the desired image?
- How can you balance visual descriptions with conceptual themes?
- What specific details will help narrow down the search results?

After your analysis, provide your response in JSON format with two main keys: "formatted_query" and "explanation". The "formatted_query" should be a string containing your optimized search query, and the "explanation" should be a brief justification of your choices.

Example output structure (do not use this content, only the structure):

<jsonoutput>

  "formatted_query": "Your formatted query here",
  "explanation": "Your explanation here"
</jsonoutput>

Remember to focus on the most distinctive and important aspects of the image or desired image in your formatted query. Your goal is to create a query that would effectively find similar images in terms of both visual elements and conceptual themes."""


def get_reasoning_prompt(query: str, extracted_details: str, formatted_query: str, similar_image_analysis: str,  image_analysis: str = None) -> str:
    """
    Get the prompt for reasoning using Gemini AI.
    
    Returns:
        The formatted prompt string
    """
    return f"""You are an AI assistant specialized in image analysis and comparison. Your task is to explain why a similar image matches a given query and/or image. You will be provided with several pieces of information to analyze and compare.

First, review the following input information:

1. Analysis of a similar image found based on the query:
<similar_image_analysis>
{similar_image_analysis}
</similar_image_analysis>

2. Original query:
<original_query>
{query}
</original_query>

3. Image analysis (if an image was provided with the query):
<query_image_analysis>
{image_analysis}
</query_image_analysis>

4. Extracted details from the query:
<query_extracted_details>
{extracted_details}
</query_extracted_details>

5. Formatted query:
<query_formatted>
{formatted_query}
</query_formatted>

Your task is to compare the information from the original query, image analysis (if provided), extracted details, and formatted query with the similar image analysis. Identify the key similarities and matches between them, and provide reasoning for why the similar image is a close match.

Follow these steps:

1. Analyze all the provided information carefully.
2. Compare the query-related information with the similar image analysis.
3. Identify the most significant similarities and relevant details.
4. Formulate clear and concise reasons explaining why the similar image matches the query.
5. Present your reasoning in bullet points.
6. Format your output as a JSON object containing an array of strings, where each string is one of your bullet points.

Before providing your final output, wrap your analysis process inside <analysis> tags:

<analysis>
1. Visual Elements:
   - List key visual elements in the query/query image
   - List key visual elements in the similar image
   - Note similarities and differences

2. Subject Matter:
   - Identify the main subject(s) in the query/query image
   - Identify the main subject(s) in the similar image
   - Compare and contrast the subjects

3. Emotions and Mood:
   - Describe the emotions/mood conveyed in the query/query image
   - Describe the emotions/mood conveyed in the similar image
   - Analyze how well they align

4. Composition and Style:
   - Note composition aspects of the query/query image
   - Note composition aspects of the similar image
   - Compare similarities in style and arrangement

5. Key Similarities:
   - List the most significant matches between query and similar image
   - Include both obvious and subtle similarities

6. Notable Differences:
   - Mention any important differences, if applicable
   - Explain why these differences don't outweigh the similarities

[Use this structure to thoroughly analyze and compare the query and similar image information. Consider all relevant details to prepare your reasoning.]
</analysis>

After your analysis, provide your final output in the following JSON format:

<jsonoutput>
  "reasons": [
    "First reason explaining the match",
    "Second reason explaining the match",
    "Third reason explaining the match",
    ...
  ]
</jsonoutput>

Ensure that each reason in the array is a clear and concise explanation of why a specific aspect of the similar image matches the original query or image. Focus on the most significant similarities and relevant details."""

def get_image_answering_prompt(query: str, image_analysis: str) -> str:
    """
    Get the prompt for image answering using Gemini AI.
    
    Returns:
        The formatted prompt string
    """
    return f"""You are an expert in analyzing and answering questions about images based on extracted details. You will be provided with an image analysis and a question about the image. Your task is to answer the question accurately and comprehensively using the information given in the image analysis.

Here is the extracted information from the image:

<image_analysis>
{image_analysis}
</image_analysis>

When answering questions about this image, follow these guidelines:

1. Carefully read and consider all the information provided in the image analysis.
2. Focus on the specific aspects of the image that are relevant to the question.
3. Use details from multiple categories in the analysis when appropriate to provide a comprehensive answer.
4. If the question asks about something not explicitly mentioned in the analysis, use the available information to make reasonable inferences, but clearly state when you are making an inference.
5. If you cannot answer the question based on the provided information, state this clearly and explain why.
6. Provide explanations and justifications for your answers, referencing specific details from the image analysis.

Format your response as follows:
1. Begin with a brief restatement of the question.
2. Provide your answer and explanation, using details from the image analysis to support your response.
3. If relevant, mention any limitations or uncertainties in your answer based on the available information.

Write your entire response inside <answer> tags.

Here is the question about the image:

<question>
{query}
</question>

Please provide your expert analysis and answer to this question based on the image details provided."""

def get_intresting_details_prompt(image_analysis: str) -> str:
    """
    Get the prompt for extracting interesting details from image analysis using Gemini AI.
    
    Returns:
        The formatted prompt string
    """
    return f"""You will be given an XML-formatted image analysis. Your task is to find and highlight interesting details about the image based on this analysis. Here's how to proceed:

1. First, you will receive the image analysis in the following format:

<image_analysis>
{image_analysis}
</image_analysis>

2. Your goal is to carefully examine each section of the analysis and identify the most intriguing or noteworthy aspects of the image.

3. For each section of the XML, consider the following:

   - Description: Look for unique or vivid details about the overall scene.
   - Colors: Note any striking or unusual color combinations.
   - Text: If present, consider its relevance or any interesting messages.
   - Category: Think about what makes this image stand out in its category.
   - Emotion: Reflect on the emotional impact and what contributes to it.
   - Main subject: Consider what makes the main subject interesting or important.
   - People, Animals, Plants: Look for unusual characteristics or interactions.
   - Objects: Identify any objects that seem out of place or particularly significant.
   - Composition: Note any striking compositional elements.
   - Lighting: Consider how lighting contributes to the image's mood or focus.
   - Style: Reflect on what makes the style unique or impactful.
   - Metadata context: Consider how this adds to the image's story or significance.
   - Summary: Use this to guide your overall interpretation.

4. As you analyze each section, make notes in a <scratchpad> about potential interesting details. Consider how different elements interact or contribute to the overall impact of the image.

5. After your analysis, synthesize your findings to identify the most interesting aspects of the image. Consider unexpected combinations, contrasts, or elements that tell a compelling story.

6. Present your findings in the  JSON format:

<interesting_details>
1. [First interesting detail]
2. [Second interesting detail]
3. [Third interesting detail]
...
</interesting_details>

<explanation>
Provide a brief explanation of why these details are particularly interesting or noteworthy, connecting different aspects of the image analysis where relevant.
</explanation>

<heading>
Provide a short, catchy title or heading that encapsulates the essence of the interesting details you've identified. This should be engaging and reflective of the image's unique qualities.
</heading>

Remember to focus on the most intriguing elements that make this image unique or captivating based on the provided analysis."""