from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime
import uuid


class SearchType(str, Enum):
    """Types of searches a user can perform"""
    text_only = "text_only"
    image_only = "image_only"
    text_and_image = "text_and_image"


class TimingStats(BaseModel):
    """Track timing for different stages of the search pipeline"""
    vectorization_ms: Optional[float] = None
    retrieval_ms: Optional[float] = None
    analysis_ms: Optional[float] = None
    total_ms: Optional[float] = None


class GeoLocation(BaseModel):
    """Geographic location data"""
    latitude: float
    longitude: float
    

class PhotoMetadata(BaseModel):
    """Metadata about a photo"""
    location: Optional[GeoLocation] = None
    taken_at: Optional[datetime] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    camera_model: Optional[str] = None


class Photo(BaseModel):
    """A photo with its analysis and metadata"""
    id: uuid.UUID
    photo_url: HttpUrl
    photo_analysis: Optional[str] = None
    photo_analysis_vector: Optional[List[float]] = None
    metadata: Optional[PhotoMetadata] = None
    created_at: datetime
    updated_at: datetime


class MatchReason(BaseModel):
    """Details about why a photo matched the search query"""
    reason: str
    confidence: float
    matching_features: List[str]


class Match(BaseModel):
    """A match between a search query and a photo"""
    id: uuid.UUID
    photo: Photo
    is_best_match: bool
    rank: int
    reason_for_match: Optional[str] = None
    interesting_details: Optional[str] = None
    match_reason: Optional[MatchReason] = None
    created_at: datetime
    updated_at: datetime


class ChatMessage(BaseModel):
    """A message in a chat about a photo match"""
    id: uuid.UUID
    is_user: bool
    message_text: str
    created_at: datetime


class UserChat(BaseModel):
    """A conversation between user and AI about a matched photo"""
    id: uuid.UUID
    match_id: uuid.UUID
    messages: List[ChatMessage] = []
    created_at: datetime
    updated_at: datetime


class SearchResult(BaseModel):
    """Results of a search query"""
    id: uuid.UUID
    search_id: uuid.UUID
    matches: List[Match]
    best_match: Optional[Match] = None
    created_at: datetime
    updated_at: datetime


class SearchResultMetadata(BaseModel):
    """Metadata about search results"""
    total_matches: int
    query_type: SearchType
    timing: TimingStats
    search_confidence: float


class SearchRequest(BaseModel):
    """A request to search for photos"""
    query_text: Optional[str] = None
    query_image_url: Optional[HttpUrl] = None


class CompleteSearchResult(BaseModel):
    """Complete search results with metadata"""
    id: uuid.UUID
    query_text: Optional[str] = None
    query_image_url: Optional[HttpUrl] = None
    results: SearchResult
    metadata: SearchResultMetadata
    created_at: datetime


class VectorSearchParams(BaseModel):
    """Parameters for vector similarity search"""
    vector: List[float]
    limit: int = 4
    similarity_threshold: float = 0.7


class GeoSearchParams(BaseModel):
    """Parameters for geographic search"""
    location: GeoLocation
    radius_km: float = 10
    limit: int = 4


class PaginationParams(BaseModel):
    """Parameters for pagination"""
    page: int = 1
    page_size: int = 20