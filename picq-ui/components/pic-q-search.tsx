"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Upload, X, Sparkles, Compass, Clock, ChevronRight, Trash2, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/components/ui/use-toast"
import { getRecentSearches, removeRecentSearch, clearAllRecentSearches, type RecentSearch } from "@/lib/recent-searches"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function PicQSearch() {
  const router = useRouter()
  const { toast } = useToast()
  const [searchText, setSearchText] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load recent searches on component mount
  useEffect(() => {
    try {
      setRecentSearches(getRecentSearches())
    } catch (error) {
      console.error("Failed to load recent searches:", error)
      // Continue without recent searches
    }
  }, [])

  // Reduced to 4 diverse visual inspiration queries
  const recommendedQueries = [
     "A group of four people at Yosemite in the month of June last year",
     "Do you remember seeing a person walking with his Dog on the beach, I think it was last month",
     "A car ride on a very cold moody december",
     "The adventurer in me trying rock climbing for the first time"
  ]

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Check file size - limit to 10MB
      if (file.size > 10 * 1024 * 1024) {
        setTimeout(() => {
          toast({
            title: "Image too large",
            description: "Please select an image smaller than 10MB.",
            variant: "destructive",
          })
        }, 0)
        return
      }

      setImageFile(file)
      const reader = new FileReader()
      reader.onload = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const clearImage = () => {
    setImagePreview(null)
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Function to resize an image to reduce its size
  const resizeImage = (dataUrl: string, maxWidth = 800, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const width = Math.min(maxWidth, img.width)
        const scaleFactor = width / img.width
        const height = img.height * scaleFactor

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0, width, height)

        // Use a lower quality to reduce file size
        resolve(canvas.toDataURL("image/jpeg", quality))
      }
      img.src = dataUrl
    })
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchText.trim() && !imageFile) {
      setTimeout(() => {
        toast({
          title: "Please enter a search query or upload an image",
          description: "You need to provide at least one search criteria.",
          variant: "destructive",
        })
      }, 0)
      return
    }

    setIsSearching(true)

    try {
      // Prepare form data for the API call
      const formData = new FormData()
      formData.append("query_text", searchText)

      // Add image to form data if available
      if (imageFile) {
        formData.append("query_image", imageFile)
      }

      // Make POST request to our API route instead of directly to the external API
      const response = await fetch("/api/search", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.search_id) {
        // Use the search_id from the API response for routing
        // Removed the query parameter as it's not needed
        router.push(`/search/${data.search_id}`)

        // Add to recent searches
        
      } else {
        throw new Error("API response did not include a valid search_id")
      }
    } catch (error) {
      console.error("Search error:", error)
      setTimeout(() => {
        toast({
          title: "Search failed",
          description: "There was an error processing your search. Please try again.",
          variant: "destructive",
        })
      }, 0)
      setIsSearching(false)
    }
  }

  const handleQueryClick = (query: string, searchId?: string) => {
    if (searchId) {
      // If we have a search ID, navigate directly to the results page
      router.push(`/search/${searchId}`)
    } else {
      // Otherwise, just set the search text
      setSearchText(query)
    }
  }

  const handleDeleteRecentSearch = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      removeRecentSearch(id)
      setRecentSearches(getRecentSearches())

      setTimeout(() => {
        toast({
          title: "Search removed",
          description: "The search has been removed from your recent searches.",
        })
      }, 0)
    } catch (error) {
      console.error("Failed to delete search:", error)
      setTimeout(() => {
        toast({
          title: "Failed to remove search",
          description: "There was an error removing the search. Please try again.",
          variant: "destructive",
        })
      }, 0)
    }
  }

  const handleClearAllRecentSearches = () => {
    try {
      clearAllRecentSearches()
      setRecentSearches([])

      setTimeout(() => {
        toast({
          title: "Recent searches cleared",
          description: "All recent searches have been cleared.",
        })
      }, 0)
    } catch (error) {
      console.error("Failed to clear searches:", error)
      setTimeout(() => {
        toast({
          title: "Failed to clear searches",
          description: "There was an error clearing your searches. Please try again.",
          variant: "destructive",
        })
      }, 0)
    }
  }

  // Handle drag and drop functionality
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith("image/")) {
        // Check file size - limit to 10MB
        if (file.size > 10 * 1024 * 1024) {
          setTimeout(() => {
            toast({
              title: "Image too large",
              description: "Please upload an image smaller than 10MB.",
              variant: "destructive",
            })
          }, 0)
          return
        }

        setImageFile(file)
        const reader = new FileReader()
        reader.onload = () => {
          setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setTimeout(() => {
          toast({
            title: "Invalid file type",
            description: "Please upload an image file.",
            variant: "destructive",
          })
        }, 0)
      }
    }
  }

  // Format the date for display
  const formatDate = (timestamp: number) => {
    const now = new Date()
    const searchDate = new Date(timestamp)

    // If it's today, show "Today"
    if (searchDate.toDateString() === now.toDateString()) {
      return "Today"
    }

    // If it's yesterday, show "Yesterday"
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (searchDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    }

    // Otherwise show the date
    return searchDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-8">
      <Card
        className={`p-6 border-gray-200 dark:border-gray-800 transition-all ${
          isDragging ? "border-amber-500 dark:border-amber-400 border-dashed bg-amber-50 dark:bg-amber-900/10" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Describe what you're looking for in natural language..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full h-10 pl-10"
                aria-label="Search query"
              />
              <Sparkles className="h-4 w-4 absolute left-3 top-3 text-amber-500 dark:text-amber-400" />
            </div>

            {/* Center buttons on mobile, keep normal alignment on desktop */}
            <div className="flex justify-center md:justify-start gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-shrink-0 h-10 w-10"
                      aria-label="Upload image"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Upload an image for visual search</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="submit"
                      className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 flex-shrink-0 h-10 w-10"
                      aria-label="Search"
                      disabled={isSearching}
                    >
                      {isSearching ? (
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Search with AI</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

          {!imagePreview && (
            <div className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>Drag and drop an image here, or click the upload button</p>
            </div>
          )}

          {imagePreview && (
            <div className="relative mt-4 inline-block">
              <div className="relative group">
                <img
                  src={imagePreview || "/placeholder.svg"}
                  alt="Preview"
                  className="max-h-48 rounded-md object-contain border border-gray-300 dark:border-gray-700"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={clearImage}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{imageFile?.name}</p>
            </div>
          )}
        </form>
      </Card>

      {recentSearches.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recent Searches</h3>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                  >
                    <Trash className="h-4 w-4 mr-1" />
                    <span className="text-xs">Clear All</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Recent Searches</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to clear all your recent searches? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAllRecentSearches}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <Separator className="bg-gray-200 dark:bg-gray-800" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <TooltipProvider>
              {recentSearches.map((item) => (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <div
                      className="group cursor-pointer relative"
                      onClick={() => handleQueryClick(item.query, item.id)}
                      >
                      <div className="relative overflow-hidden rounded-lg aspect-[4/3]">
                        <img
                          src={item.topMatchImageUrl || "/placeholder.svg?height=200&width=300"}
                          alt={item.query}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-white text-sm font-medium line-clamp-2 leading-tight">{item.query}</p>
                          <p className="text-white/70 text-xs mt-1">{formatDate(item.timestamp)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                          onClick={(e) => handleDeleteRecentSearch(e, item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{item.query}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </div>
      )}

      <Card className="p-6 border-gray-200 dark:border-gray-800">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Visual Inspiration</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <TooltipProvider>
              {recommendedQueries.map((query, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <Card
                      className="bg-gray-100 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800/50 hover:border-amber-500/30 dark:hover:border-amber-800/50 transition-colors cursor-pointer"
                      onClick={() => handleQueryClick(query)}
                    >
                      <div className="p-3 flex items-center">
                        <div className="flex-1">
                          <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-1">{query}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-amber-500/70 flex-shrink-0 ml-2" />
                      </div>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{query}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </div>
      </Card>
    </div>
  )
}
