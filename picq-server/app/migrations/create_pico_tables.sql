-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create searches table
CREATE TABLE public.searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT NOT NULL,
    query_image_url TEXT,
    photo_id UUID references public.photos(id) ON DELETE CASCADE ,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create search_results table
CREATE TABLE public.search_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create photos table
CREATE TABLE public.photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_url TEXT NOT NULL,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    taken_at TIMESTAMP WITH TIME ZONE,
    photo_analysis TEXT,
    photo_analysis_vector vector(1536),  -- Adjust dimensions as needed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create matches table
CREATE TABLE public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_result_id UUID REFERENCES public.search_results(id) ON DELETE CASCADE NOT NULL,
    photo_id UUID REFERENCES public.photos(id) NOT NULL,
    is_best_match BOOLEAN DEFAULT FALSE,
    reason_for_match TEXT,
    interesting_details TEXT,
    rank SMALLINT NOT NULL,  -- 0 = best match, 1-3 = other matches
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_chats table
CREATE TABLE public.user_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_chat_id UUID REFERENCES public.user_chats(id) ON DELETE CASCADE NOT NULL,
    is_user BOOLEAN NOT NULL,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_photos_vector ON public.photos USING ivfflat (photo_analysis_vector vector_cosine_ops);
CREATE INDEX idx_search_result_id ON public.matches (search_result_id);
CREATE INDEX idx_photo_id ON public.matches (photo_id);
CREATE INDEX idx_match_id ON public.user_chats (match_id);
CREATE INDEX idx_user_chat_id ON public.chat_messages (user_chat_id);