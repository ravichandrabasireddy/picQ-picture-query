create or replace function match_photos (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  photo_url text,
  photo_analysis text,
  similarity float
)
language sql stable
as $$
  select
    photos.id,
    photos.photo_url,
    photos.photo_analysis,
    1 - (photos.photo_analysis_vector <=> query_embedding) as similarity
  from photos
  where photos.photo_analysis_vector <=> query_embedding < 1 - match_threshold
  order by photos.photo_analysis_vector <=> query_embedding
  limit match_count;
$$;
