export type SavedImage = {
  id: string
  title: string
  image: string
  savedAt: number
  reason?: string
}

// Key for localStorage
const SAVED_IMAGES_KEY = "picq_saved_images"
const MAX_SAVED_IMAGES = 8

// Get all saved images
export function getSavedImages(): SavedImage[] {
  if (typeof window === "undefined") return []

  try {
    const saved = localStorage.getItem(SAVED_IMAGES_KEY)
    return saved ? JSON.parse(saved) : []
  } catch (error) {
    console.error("Error retrieving saved images:", error)
    return []
  }
}

// Save an image
export function saveImage(image: SavedImage): void {
  if (typeof window === "undefined") return

  try {
    // Make sure we're not storing data URLs which can be huge
    const safeImage = {
      ...image,
      // If it's a data URL, replace with a placeholder
      image: image.image.startsWith("data:") ? "/placeholder.svg?height=400&width=600" : image.image,
    }

    const savedImages = getSavedImages()
    // Check if already saved to avoid duplicates
    const exists = savedImages.some((img) => img.id === safeImage.id)

    if (!exists) {
      const updatedSaved = [safeImage, ...savedImages]

      // Limit to MAX_SAVED_IMAGES
      const limitedImages = updatedSaved.slice(0, MAX_SAVED_IMAGES)

      try {
        localStorage.setItem(SAVED_IMAGES_KEY, JSON.stringify(limitedImages))
      } catch (storageError) {
        console.error("Storage quota exceeded, trying with fewer items", storageError)

        // If we hit quota limits, try with even fewer items
        if (limitedImages.length > 1) {
          const reducedImages = [safeImage, ...savedImages.slice(0, 1)]
          try {
            localStorage.setItem(SAVED_IMAGES_KEY, JSON.stringify(reducedImages))
          } catch (finalError) {
            // Last resort: just store the current image
            try {
              localStorage.setItem(SAVED_IMAGES_KEY, JSON.stringify([safeImage]))
            } catch (lastError) {
              console.error("Could not store any images", lastError)
              // Clear storage as a last resort to recover
              localStorage.removeItem(SAVED_IMAGES_KEY)
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error saving image:", error)
  }
}

// Remove a saved image
export function removeSavedImage(id: string): void {
  if (typeof window === "undefined") return

  try {
    const savedImages = getSavedImages()
    const updatedSaved = savedImages.filter((img) => img.id !== id)
    localStorage.setItem(SAVED_IMAGES_KEY, JSON.stringify(updatedSaved))
  } catch (error) {
    console.error("Error removing saved image:", error)
    // Try to recover by removing all images
    try {
      localStorage.removeItem(SAVED_IMAGES_KEY)
    } catch (clearError) {
      console.error("Failed to clear saved images", clearError)
    }
  }
}

// Check if an image is saved
export function isImageSaved(id: string): boolean {
  if (typeof window === "undefined") return false

  try {
    const savedImages = getSavedImages()
    return savedImages.some((img) => img.id === id)
  } catch (error) {
    console.error("Error checking saved image:", error)
    return false
  }
}
