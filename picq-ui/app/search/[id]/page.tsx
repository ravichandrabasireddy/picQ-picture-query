"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Download, Bookmark, BookmarkCheck, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getMockSearchResults, mockSearchProcess } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { ImageDetailDialog } from "@/components/image-detail-dialog"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { saveImage, removeSavedImage, isImageSaved } from "@/lib/saved-images"
import { addRecentSearch } from "@/lib/recent-searches"

type SearchStep = {
  id: string
  name: string
  message: string
  completed: boolean
  current: boolean
}

type SearchResult = {
  title: string
  image: string
  reason: string
}

export default function SearchResultsPage({ params }: { params: { id: string } }) {
  const id = React.use(params as unknown as Promise<{ id: string }>).id

  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const query = searchParams.get("q") || ""
  const [searchImage, setSearchImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [streamedText, setStreamedText] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [savedResults, setSavedResults] = useState<Set<number>>(new Set())
  const [searchSteps, setSearchSteps] = useState<SearchStep[]>([
    {
      id: "photo_processing",
      name: "Photo Processing",
      message: "Processing photo...",
      completed: false,
      current: false,
    },
    {
      id: "extracting_details",
      name: "Detail Extraction",
      message: "Extracting visual details...",
      completed: false,
      current: false,
    },
    {
      id: "formatting_query",
      name: "Query Formatting",
      message: "Formatting search query...",
      completed: false,
      current: false,
    },
    { id: "retrieving", name: "Result Retrieval", message: "Retrieving results...", completed: false, current: false },
  ])
  const [currentStep, setCurrentStep] = useState<string | null>(null)

  useEffect(() => {
    // Try to get the search image from sessionStorage first, then localStorage as fallback
    try {
      const storedImage =
        sessionStorage.getItem(`search_image_${id}`) || localStorage.getItem(`search_image_${id}`)
      if (storedImage) {
        setSearchImage(storedImage)
      }
    } catch (error) {
      console.error("Error retrieving image:", error)
      // We can still proceed without the image
    }

    // Start the mock SSE process
    const cleanup = mockSearchProcess(
      query,
      (event, data) => {
        if (event === "complete") {
          // When complete, set the search results and finish loading
          const results = getMockSearchResults(query)
          setSearchResults(results)

          // Add to recent searches when search is complete
          if (query) {
            try {
              const searchData = {
                id: id,
                query: query,
                // Use a placeholder image instead of the actual image to save space
                imageUrl: "/placeholder.svg?height=200&width=300",
                timestamp: Date.now(),
              }
              addRecentSearch(searchData)
            } catch (error) {
              console.error("Failed to add recent search:", error)
              // Continue without adding to recent searches
            }
          }

          setIsLoading(false)
        } else {
          // Update the current step
          setCurrentStep(event)

          // Update the steps array to mark the current step and completed steps
          setSearchSteps((prevSteps) =>
            prevSteps.map((step) => {
              if (step.id === event) {
                return { ...step, current: true, message: data?.message || step.message }
              } else if (prevSteps.findIndex((s) => s.id === event) > prevSteps.findIndex((s) => s.id === step.id)) {
                return { ...step, completed: true, current: false }
              } else {
                return { ...step, current: false }
              }
            }),
          )
        }
      },
      (text) => {
        // Update the streamed text
        setStreamedText(text)
      },
    )

    // Check which results are already saved
    if (searchResults) {
      const newSavedSet = new Set<number>()

      // Check if main result is saved
      if (isImageSaved(`${id}_main`)) {
        newSavedSet.add(-1)
      }

      // Check if other results are saved
      searchResults.otherMatches?.forEach((_: any, index: number) => {
        if (isImageSaved(`${id}_${index}`)) {
          newSavedSet.add(index)
        }
      })

      setSavedResults(newSavedSet)
    }

    return () => {
      cleanup()

      // Clean up storage when component unmounts
      try {
        sessionStorage.removeItem(`search_image_${id}`)
        localStorage.removeItem(`search_image_${id}`)
      } catch (error) {
        console.error("Error cleaning up storage:", error)
      }
    }
  }, [id, query])

  const handleBackClick = () => {
    router.push("/")
  }

  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result)
    setDialogOpen(true)
  }

  const toggleSaveResult = (index: number, result: SearchResult) => {
    const isMainResult = index === -1
    const currentResult = isMainResult ? searchResults.bestMatch : searchResults.otherMatches[index]
    const resultId = `${id}_${isMainResult ? "main" : index}`

    // Check if already saved
    const isSaved = savedResults.has(index)

    if (isSaved) {
      // Remove from saved
      removeSavedImage(resultId)
      setSavedResults((prev) => {
        const newSet = new Set(prev)
        newSet.delete(index)
        return newSet
      })

      setTimeout(() => {
        toast({
          title: "Removed from saved items",
          description: "The image has been removed from your saved items.",
        })
      }, 0)
    } else {
      // Add to saved
      saveImage({
        id: resultId,
        title: currentResult.title,
        image: currentResult.image,
        reason: currentResult.reason,
        savedAt: Date.now(),
      })

      setSavedResults((prev) => {
        const newSet = new Set(prev)
        newSet.add(index)
        return newSet
      })

      setTimeout(() => {
        toast({
          title: "Saved successfully",
          description: "The image has been added to your saved items.",
        })
      }, 0)
    }
  }

  // Simplified share function that only uses clipboard
  const handleShare = () => {
    try {
      // Skip Web Share API entirely and go straight to clipboard
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          setTimeout(() => {
            toast({
              title: "Link copied",
              description: "Search link has been copied to your clipboard.",
            })
          }, 0)
        })
        .catch((err) => {
          console.error("Error copying:", err)
          setTimeout(() => {
            toast({
              title: "Sharing not available",
              description: "Please manually copy the URL from your browser.",
              variant: "destructive",
            })
          }, 0)
        })
    } catch (error) {
      console.error("Share error:", error)
      setTimeout(() => {
        toast({
          title: "Sharing not available",
          description: "Please manually copy the URL from your browser.",
          variant: "destructive",
        })
      }, 0)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="ghost"
            className="pl-0 text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
            onClick={handleBackClick}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-full" onClick={handleShare} aria-label="Copy link">
              <Copy className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-lg border border-amber-200 dark:border-amber-800/30">
          <div className="flex flex-col md:flex-row items-center">
            {searchImage && (
              <div className="w-full md:w-1/3 lg:w-1/4 p-4 md:p-6">
                <div className="relative aspect-square w-full max-w-[240px] mx-auto md:mx-0">
                  <div className="absolute inset-0 rounded-lg overflow-hidden shadow-md border border-amber-200 dark:border-amber-800/30">
                    <img
                      src={searchImage || "/placeholder.svg"}
                      alt="Query image"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-amber-300/20 dark:ring-amber-500/20"></div>
                </div>
              </div>
            )}
            <div className={`flex-1 p-4 md:p-6 ${searchImage ? "md:pl-4" : ""}`}>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="h-4 w-1 bg-amber-500 dark:bg-amber-500 rounded-full mr-2"></div>
                  <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 font-semibold">
                    Your search
                  </p>
                </div>
                <p className="text-lg md:text-xl font-medium text-gray-800 dark:text-gray-100 leading-relaxed">
                  {query}
                </p>
                <div className="pt-2">
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 dark:bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 dark:bg-amber-300"></span>
                    </span>
                    {isLoading ? "Processing with AI" : "Processed with AI"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Card className="w-full max-w-2xl p-6 border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold mb-6">Processing Your Query</h2>

            <div className="space-y-6">
              {searchSteps.map((step) => (
                <div key={step.id} className="flex items-start gap-4">
                  <div className="mt-0.5">
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : step.current ? (
                      <div className="h-5 w-5 rounded-full border-2 border-amber-500 dark:border-amber-500 border-t-transparent animate-spin" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-700" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3
                      className={`font-medium ${
                        step.current
                          ? "text-amber-600 dark:text-amber-400"
                          : step.completed
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {step.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {step.current ? step.message : step.completed ? "Completed" : "Waiting..."}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Streamed text display */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-4 min-h-[100px]">
                <p className="text-gray-700 dark:text-gray-300 font-mono text-sm leading-relaxed">
                  {streamedText}
                  <span className="inline-block w-2 h-4 bg-amber-500 dark:bg-amber-400 ml-1 animate-pulse"></span>
                </p>
              </div>
            </div>
          </Card>

          {/* Skeleton loaders for results */}
          <div className="w-full mt-8 space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-4">Best Match</h2>
              <Card className="overflow-hidden border-gray-200 dark:border-gray-800">
                <div className="aspect-video relative">
                  <Skeleton className="h-full w-full" />
                </div>
                <div className="p-4 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4">Other Matches</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden border-gray-200 dark:border-gray-800">
                    <div className="aspect-video relative">
                      <Skeleton className="h-full w-full" />
                    </div>
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Best Match */}
          <div>
            <h2 className="text-xl font-bold mb-4">Best Match</h2>
            <Card
              className="overflow-hidden border-gray-200 dark:border-gray-800 cursor-pointer transition-all hover:shadow-md group"
              onClick={() => handleResultClick(searchResults.bestMatch)}
            >
              <div className="aspect-video relative">
                <img
                  src={searchResults.bestMatch.image || "/placeholder.svg"}
                  alt={searchResults.bestMatch.title}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm hover:bg-white dark:hover:bg-black/70 shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSaveResult(-1, searchResults.bestMatch)
                    }}
                  >
                    {savedResults.has(-1) ? (
                      <BookmarkCheck className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm hover:bg-white dark:hover:bg-black/70 shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(searchResults.bestMatch.image, "_blank")
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-medium mb-2">{searchResults.bestMatch.title}</h3>
                <p className="text-gray-700 dark:text-gray-300">{searchResults.bestMatch.reason}</p>
              </div>
            </Card>
          </div>

          {/* Other Matches */}
          <div>
            <h2 className="text-xl font-bold mb-4">Other Matches</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {searchResults.otherMatches.map((match: SearchResult, index: number) => (
                <Card
                  key={index}
                  className="overflow-hidden border-gray-200 dark:border-gray-800 cursor-pointer transition-all hover:shadow-md group"
                  onClick={() => handleResultClick(match)}
                >
                  <div className="aspect-video relative">
                    <img
                      src={match.image || "/placeholder.svg"}
                      alt={match.title}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm hover:bg-white dark:hover:bg-black/70 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSaveResult(index, match)
                        }}
                      >
                        {savedResults.has(index) ? (
                          <BookmarkCheck className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Bookmark className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm hover:bg-white dark:hover:bg-black/70 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(match.image, "_blank")
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-md font-medium mb-2">{match.title}</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{match.reason}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Image Detail Dialog */}
      {selectedResult && (
        <ImageDetailDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          image={selectedResult.image}
          title={selectedResult.title}
          reason={selectedResult.reason}
        />
      )}
    </div>
  )
}
