// Type for recent search data
export type RecentSearch = {
  id: string
  query: string
  imageUrl: string
  resultUrl?: string // URL to the search results page
  topMatchImageUrl?: string // URL of the top match image
  timestamp: number
}

// Key for localStorage
const RECENT_SEARCHES_KEY = "picq_recent_searches"
const MAX_RECENT_SEARCHES = 4 // Reduced from 8 to save space

// Get all recent searches
export function getRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return []

  try {
    const searches = localStorage.getItem(RECENT_SEARCHES_KEY)
    return searches ? JSON.parse(searches) : []
  } catch (error) {
    console.error("Error retrieving recent searches:", error)
    return []
  }
}

// Add a recent search
export function addRecentSearch(search: RecentSearch): void {
  if (typeof window === "undefined") return

  try {
    // Make sure we're not storing data URLs which can be huge
    const safeSearch = {
      ...search,
      // If it's a data URL or undefined/null, replace with a placeholder
      imageUrl:
        !search.imageUrl || search.imageUrl.startsWith("data:")
          ? "/placeholder.svg?height=200&width=300"
          : search.imageUrl,
      // If topMatchImageUrl is a data URL or undefined/null, replace with a placeholder
      topMatchImageUrl:
        !search.topMatchImageUrl || search.topMatchImageUrl.startsWith("data:")
          ? "/placeholder.svg?height=200&width=300"
          : search.topMatchImageUrl,
    }

    const searches = getRecentSearches()

    // Remove any existing search with the same ID to avoid duplicates
    const filteredSearches = searches.filter((s) => s.id !== safeSearch.id)

    // Add the new search at the beginning
    const updatedSearches = [safeSearch, ...filteredSearches]

    // Limit to MAX_RECENT_SEARCHES
    const limitedSearches = updatedSearches.slice(0, MAX_RECENT_SEARCHES)

    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(limitedSearches))
    } catch (storageError) {
      console.error("Storage quota exceeded, trying with fewer items", storageError)

      // If we hit quota limits, try with even fewer items
      if (limitedSearches.length > 1) {
        const reducedSearches = [safeSearch, ...filteredSearches.slice(0, 1)]
        try {
          localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(reducedSearches))
        } catch (finalError) {
          // Last resort: just store the current search
          try {
            localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([safeSearch]))
          } catch (lastError) {
            console.error("Could not store any searches", lastError)
            // Clear storage as a last resort to recover
            localStorage.removeItem(RECENT_SEARCHES_KEY)
          }
        }
      }
    }
  } catch (error) {
    console.error("Error adding recent search:", error)
  }
}

// Remove a recent search
export function removeRecentSearch(id: string): void {
  if (typeof window === "undefined") return

  try {
    const searches = getRecentSearches()
    const updatedSearches = searches.filter((s) => s.id !== id)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updatedSearches))
  } catch (error) {
    console.error("Error removing recent search:", error)
    // Try to recover by removing all searches
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch (clearError) {
      console.error("Failed to clear searches", clearError)
    }
  }
}

// Clear all recent searches
export function clearAllRecentSearches(): void {
  if (typeof window === "undefined") return

  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch (error) {
    console.error("Error clearing recent searches:", error)
  }
}
