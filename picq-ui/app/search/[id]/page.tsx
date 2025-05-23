"use client"

import { useEffect, useState, use, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Bookmark,
  BookmarkCheck,
  Copy,
  MapPin,
  Calendar,
  ImageIcon,
  AlertCircle,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { ImageDetailDialog } from "@/components/image-detail-dialog"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { saveImage, removeSavedImage, isImageSaved } from "@/lib/saved-images"
import { addRecentSearch } from "@/lib/recent-searches"
import { type SearchStep } from "@/components/search-progress"
import { SSEClient } from "@/lib/sse-client"
import { formatDate } from "@/lib/utils"

import { useParams } from 'next/navigation'


type SearchResult = {
  id: string
  photo_id: string
  photo_url: string
  formatted_address?: string
  taken_at?: string
  photo_analysis?: string
  is_best_match: boolean
  reason_for_match: string
  interesting_details: string[]
  rank: number
  similarity?: number
  reasons?: string[],
  heading?: string,

}

type SearchData = {
  search_id: string
  search_result_id?: string
  query_text: string
  query_image_url?: string
  has_results: boolean
  matches: SearchResult[]
}


function formatReasonIntoPoints(reasonText: string): string[] {
  if (!reasonText) return []

  // Split by sentences (looking for period followed by space or end of string)
  let points = reasonText.split(/\.\s+|\.$/).filter(Boolean)

  // If we have very few points, try to split by commas or semicolons
  if (points.length <= 2 && reasonText.length > 100) {
    points = reasonText.split(/[,;]\s+/).filter(Boolean)
  }

  // Limit to 5 points maximum
  points = points.slice(0, 5)

  // Make sure each point ends with a period
  return points.map((point) => {
    point = point.trim()
    return point.endsWith(".") ? point : `${point}.`
  })
}

export default function SearchResultsPage() {
  // Unwrap the params Promise to get the actual params object
  const params = useParams<{ id: string}>()
  const searchId = params.id
  const router = useRouter()
  const { toast } = useToast()
  const [searchData, setSearchData] = useState<SearchData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [savedResults, setSavedResults] = useState<Set<string>>(new Set())
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [extractedDetails, setExtractedDetails] = useState("")
  const [imageAnalysis, setImageAnalysis] = useState("")
  const [formattedQuery, setFormattedQuery] = useState("")
  const [formattingExplanation, setFormattingExplanation] = useState("")
  const [matchesWithReasoning, setMatchesWithReasoning] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [resultsReady, setResultsReady] = useState(false)
  const [showNoResults, setShowNoResults] = useState(false)

  // Track progress for all stages that produce chunks
  const [queryAnalysisProgress, setQueryAnalysisProgress] = useState<string>("");
  const [imageAnalysisProgress, setImageAnalysisProgress] = useState<string>("");
  const [formatQueryProgress, setFormatQueryProgress] = useState<string>("");
  const [reasoningProgress, setReasoningProgress] = useState<string>("");
  const [interestingDetailsProgress, setInterestingDetailsProgress] = useState<string>("");
  const [currentProgressStage, setCurrentProgressStage] = useState<string>("");
  const [currentMatchProcessing, setCurrentMatchProcessing] = useState<string>("");
  const [showProgressChunks, setShowProgressChunks] = useState<boolean>(true);

  // Add refs to track API calls, SSE client, and text accumulation
  const apiCallMadeRef = useRef(false)
  const sseClientRef = useRef<SSEClient | null>(null)
  const reasoningProgressRef = useRef<string>("")
  const interestingDetailsProgressRef = useRef<string>("")
  const currentMatchProcessingRef = useRef<string>("")

  const [searchSteps, setSearchSteps] = useState<SearchStep[]>([
    {
      id: "checking_results",
      name: "Checking Results",
      message: "Checking for existing results...",
      completed: false,
      current: true,
    },
    {
      id: "extract_query",
      name: "Query Analysis",
      message: "Extracting details from query...",
      completed: false,
      current: false,
      streamedText: "",
    },
    {
      id: "image_analysis",
      name: "Image Analysis",
      message: "Analyzing image...",
      completed: false,
      current: false,
      streamedText: "",
    },
    {
      id: "format_query",
      name: "Query Formatting",
      message: "Formatting search query...",
      completed: false,
      current: false,
      streamedText: "",
    },
    {
      id: "search",
      name: "Similarity Search",
      message: "Searching for matches...",
      completed: false,
      current: false,
    },
    {
      id: "reasoning",
      name: "Match Analysis",
      message: "Analyzing matches...",
      completed: false,
      current: false,
      streamedText: "",
    },
  ])

  // Function to update a search step with immediate UI update
  const updateSearchStep = (
    stepId: string,
    isCurrent: boolean,
    isCompleted: boolean,
    message?: string,
    streamedText?: string | ((prev: string) => string),
  ) => {
    setSearchSteps((prevSteps) => {
      // Create a new array with updated steps
      const updatedSteps = prevSteps.map((step) => {
        if (step.id === stepId) {
          // Update the target step
          const newStreamedText =
            typeof streamedText === "function"
              ? streamedText(step.streamedText || "")
              : streamedText !== undefined
                ? streamedText
                : step.streamedText

          return {
            ...step,
            current: isCurrent,
            completed: isCompleted,
            message: message || step.message,
            streamedText: newStreamedText,
          }
        } else if (isCurrent) {
          // If we're marking a step as current, ensure other steps are not current
          return {
            ...step,
            current: false,
          }
        } else {
          // Leave other steps unchanged
          return step
        }
      })

      // Debug log the updated steps
      const currentStep = updatedSteps.find(s => s.current);
      console.log(`[updateSearchStep] Updated steps for ${stepId}, current step is now: ${currentStep?.id}`);
      
      // Force React to treat this as a new array to ensure re-render
      return [...updatedSteps];
    })
    
    // Force update outside of the setState callback to ensure UI updates
    setTimeout(() => {
      setSearchSteps(currentSteps => [...currentSteps]);
    }, 0);
  }

  // Fetch search results from the API
  useEffect(() => {
    // Use a ref to prevent duplicate API calls
    if (apiCallMadeRef.current) return
    apiCallMadeRef.current = true

    const fetchSearchResults = async () => {
      try {
        // Update the first step to show it's in progress
        updateSearchStep("checking_results", true, false)

        // Fetch search results from our API route using the unwrapped searchId
        const response = await fetch(`/api/search-results/${searchId}`)

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`)
        }

        const data = await response.json()
        // Mark the first step as completed
        updateSearchStep("checking_results", false, true)

        // Set the search data
        setSearchData(data)


        // Check if we have results
        if (data.has_results && data.matches && data.matches.length > 0) {
          // We have results, so we can stop loading
          setIsLoading(false)
          setResultsReady(true)


          // Add to recent searches
          if (data.query_text) {
            try {
              const searchDataForRecent = {
                id: searchId,
                query: data.query_text,
                topMatchImageUrl: data.matches[0].photo_url || "/placeholder.svg?height=200&width=300",
                timestamp: Date.now(),
              }
              addRecentSearch(searchDataForRecent)
            } catch (error) {
              console.error("Failed to add recent search:", error)
            }
          }

          // Check which results are already saved
          const newSavedSet = new Set<string>()
          data.matches.forEach((match: { id: string }) => {
            if (isImageSaved(`${match.id}`)) {
              newSavedSet.add(match.id)
            }
          })
          setSavedResults(newSavedSet)
        } else {
          // We don't have results, so we need to initiate a search
          setIsProcessing(true)
        
          initiateSearch(data)
        }
      } catch (error) {
        console.error("Error fetching search results:", error)
        setIsLoading(false)
        setError("Failed to load search results. Please try again.")
        toast({
          title: "Error",
          description: "Failed to load search results. Please try again.",
          variant: "destructive",
        })
      }
    }

    fetchSearchResults()

    // Cleanup function to close SSE client when component unmounts
    return () => {
      if (sseClientRef.current) {
        sseClientRef.current.close()
      }
    }
  }, [searchId, toast])

  useEffect(() => {
    if (!isLoading && !isProcessing && !getBestMatch() && getOtherMatches().length === 0 && searchData) {
      // Add a short delay before showing "No Results"
      const timer = setTimeout(() => {
        setShowNoResults(true)
      }, 500); // 500ms delay
      
      return () => clearTimeout(timer);
    } else {
      setShowNoResults(false);
    }
  }, [isLoading, isProcessing, searchData]);


  // Function to initiate a search using our SSE client
  const initiateSearch = async (data: SearchData) => {
    try {
      // Close any existing SSE client
      if (sseClientRef.current) {
        sseClientRef.current.close()
      }

      // Prepare the search data
      const searchRequestData = {
        id: data.search_id,
        query: data.query_text,
        image: data.query_image_url || "",
      }

      console.log("Initiating search with data:", searchRequestData)

      // Adjust search steps based on whether we have an image or not
      if (!data.query_image_url) {
        // Remove the image analysis step if there's no image
        setSearchSteps(prevSteps => 
          prevSteps.filter(step => step.id !== "image_analysis")
        );
        console.log("No image provided, removing image analysis step");
      }

      // Set up the SSE client for real-time updates
      const eventSourceUrl = `/api/initiate-search?${new URLSearchParams({
        id: searchRequestData.id,
        query: searchRequestData.query,
        image: searchRequestData.image,
      }).toString()}`

      console.log("Connecting to SSE endpoint:", eventSourceUrl)

      // Create a new SSE client with proper error handling
      const sseClient = new SSEClient(eventSourceUrl, {
        onOpen: () => {
          console.log("SSE connection opened successfully")
        },
        onError: (error) => {
          console.error("SSE connection error:", error)
          setError("Connection to search process lost. Please try again.")
          setIsProcessing(false)
          toast({
            title: "Connection Error",
            description: "Connection to search process lost. Please try again.",
            variant: "destructive",
          })
        },
        onClose: () => {
          console.log("SSE connection closed")
        },
      })

      // Store the SSE client in the ref
      sseClientRef.current = sseClient

      // Set up event handlers for each event type with immediate UI updates
      sseClient.on("extract_query_start", (data) => {
        console.log("extract_query_start event received:", data)
        // Update step and set current progress stage
        setCurrentStep("extract_query")
        setCurrentProgressStage("query_analysis")
        setQueryAnalysisProgress("")
        updateSearchStep("extract_query", true, false, data.message, "")
      })

      sseClient.on("extract_query_chunk", (data) => {
        console.log("extract_query_chunk event received:", data)
        if (data.chunk) {
          // Update both the search step and the dedicated progress display
          updateSearchStep("extract_query", true, false, undefined, (prev) => prev + data.chunk)
          // Also accumulate in the queryAnalysisProgress state for the detailed display
          setQueryAnalysisProgress(prev => prev + data.chunk)
        }
      })

      sseClient.on("extract_query_complete", (data) => {
        console.log("extract_query_complete event received:", data)
        updateSearchStep("extract_query", false, true, "Query analysis complete")
        setExtractedDetails(data.extracted_details || "")
        // Clear the current progress stage since this stage is complete
        setCurrentProgressStage("")
      })

      sseClient.on("image_analysis_start", (data) => {
        console.log("image_analysis_start event received:", data)
        // Update step and set current progress stage
        setCurrentStep("image_analysis")
        setCurrentProgressStage("image_analysis")
        setImageAnalysisProgress("")
        updateSearchStep("image_analysis", true, false, data.message, "")
      })

      sseClient.on("image_analysis_chunk", (data) => {
        console.log("image_analysis_chunk event received:", data)
        if (data.chunk) {
          // Update both the search step and the dedicated progress display
          updateSearchStep("image_analysis", true, false, undefined, (prev) => prev + data.chunk)
          // Also accumulate in the imageAnalysisProgress state for the detailed display
          setImageAnalysisProgress(prev => prev + data.chunk)
        }
      })

      sseClient.on("image_analysis_complete", (data) => {
        console.log("image_analysis_complete event received:", data)
        updateSearchStep("image_analysis", false, true, "Image analysis complete")
        setImageAnalysis(data.image_analysis || "")
        // Clear the current progress stage since this stage is complete
        setCurrentProgressStage("")
      })

      sseClient.on("format_query_start", (data) => {
        console.log("format_query_start event received:", data)
        // Set current progress stage and reset the progress text
        setCurrentProgressStage("format_query")
        setFormatQueryProgress("")
        setCurrentStep("format_query")
        updateSearchStep("format_query", true, false, data.message, "")
      })

      sseClient.on("format_query_chunk", (data) => {
        console.log("format_query_chunk event received:", data)
        if (data.chunk) {
          // Update both the search step and the dedicated progress display
          updateSearchStep("format_query", true, false, undefined, (prev) => prev + data.chunk)
          // Also accumulate in the formatQueryProgress state for the detailed display
          setFormatQueryProgress(prev => prev + data.chunk)
        }
      })

      sseClient.on("format_query_complete", (data) => {
        console.log("format_query_complete event received:", data)
        updateSearchStep("format_query", false, true, "Query formatting complete")
        setFormattedQuery(data.formatted_query || "")
        setFormattingExplanation(data.explanation || "")
        // Clear the current progress stage since this stage is complete
        setCurrentProgressStage("")
      })

      sseClient.on("search_start", (data) => {
        console.log("search_start event received:", data)
        // Force immediate UI update
        setCurrentStep("search")
        updateSearchStep("search", true, false, data.message)
      })

      sseClient.on("search_complete", (data) => {
        console.log("search_complete event received:", data)
        updateSearchStep("search", false, true, `Found ${data.matches_count || 0} matches`)
      })

      sseClient.on("reasoning_start", (data) => {
        console.log("reasoning_start event received:", data)
        // Force immediate UI update
        setCurrentStep("reasoning")
        updateSearchStep("reasoning", true, false, data.message)
      })

      sseClient.on("reasoning_progress", (data) => {
        console.log("reasoning_progress event received:", data)
        
        // Only reset progress when we're starting a new match
        if (data.message && data.message.includes("Processing match") && data.message !== currentMatchProcessingRef.current) {
          // This is a new match message, so clear previous progress
          console.log("New match detected, resetting progress:", data.message)
          reasoningProgressRef.current = ""
          interestingDetailsProgressRef.current = ""
          currentMatchProcessingRef.current = data.message
          setReasoningProgress("")
          setInterestingDetailsProgress("")
          setCurrentMatchProcessing(data.message)
          updateSearchStep("reasoning", true, false, data.message)
        }
        
        // Always concatenate chunks for the current match using both state and ref
        if (data.chunk) {
          console.log("Adding chunk to reasoning progress:", data.chunk.substring(0, 30) + "...")
          reasoningProgressRef.current += data.chunk
          setReasoningProgress(reasoningProgressRef.current)
        }
      })

      sseClient.on("interesting_details_progress", (data) => {
        console.log("interesting_details_progress event received:", data)
        
        // Check if this is a new message type
        const isNewMessage = !currentMatchProcessing.includes(data.message);
        
        // Only update the step message if it's a new type of message
        if (isNewMessage && data.message) {
          updateSearchStep("reasoning", true, false, data.message)
        }
        
        // Always concatenate chunks without resetting
        if (data.chunk) {
          setInterestingDetailsProgress(prev => prev + data.chunk)
        }
      })

      sseClient.on("match_reasoning_complete", (data) => {
        console.log("match_reasoning_complete event received:", data)
        setMatchesWithReasoning((prev) => [...prev, data])
        
        // Reset progress tracking for the next match
        setInterestingDetailsProgress("")
        setCurrentMatchProcessing("")
      })

      sseClient.on("reasoning_complete", (data) => {
        console.log("reasoning_complete event received:", data)
        updateSearchStep("reasoning", false, true, `Analyzed ${data.matches_count || 0} matches`)
      })

      sseClient.on("complete", (data) => {
        console.log("complete event received:", data)
        // Final results are ready
        setIsProcessing(false)
        setIsLoading(false)

        // Refresh the search results
        fetchFinalResults()

        // Close the SSE client
        sseClient.close()
        sseClientRef.current = null
      })

      // Connect to the SSE endpoint
      sseClient.connect()

      console.log("SSE client set up successfully")
    } catch (error) {
      console.error("Error initiating search:", error)
      setIsLoading(false)
      setIsProcessing(false)
      setError("Failed to initiate search. Please try again.")
      toast({
        title: "Error",
        description: "Failed to initiate search. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Function to fetch the final results after the search is complete
  const fetchFinalResults = async () => {
    try {
      const response = await fetch(`/api/search-results/${searchId}`)

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const data = await response.json()
      setSearchData(data)
      if (data && data.matches && data.matches.length > 0) {
        setResultsReady(true)
      }

      // Check which results are already saved
      const newSavedSet = new Set<string>()
      data.matches.forEach((match: { id: string }) => {
        if (isImageSaved(`${match.id}`)) {
          newSavedSet.add(match.id)
        }
      })
      setSavedResults(newSavedSet)

      // Add to recent searches
      if (data.query_text && data.has_results && data.matches && data.matches.length > 0) {
        try {
          // Find the best match (top result)
          const bestMatch = data.matches.find((match: { is_best_match: any }) => match.is_best_match)

          const searchDataForRecent = {
            id: searchId,
            query: data.query_text,
            resultUrl: window.location.href, // Store the current URL
            topMatchImageUrl: bestMatch?.photo_url || null, // Store the top match image URL
            timestamp: Date.now(),
          }
          console.log("Adding recent search 2:", searchDataForRecent)
          addRecentSearch(searchDataForRecent)
        } catch (error) {
          console.error("Failed to add recent search:", error)
        }
      }
    } catch (error) {
      console.error("Error fetching final results:", error)
      toast({
        title: "Error",
        description: "Failed to load final search results. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBackClick = () => {
    router.push("/")
  }

  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result)
    setDialogOpen(true)
  }

  const toggleSaveResult = (result: SearchResult) => {
   const resultId = `${result.id}`

    // Check if already saved
   const isSaved = savedResults.has(resultId)

    if (isSaved) {
      // Remove from saved
      removeSavedImage(resultId)
      setSavedResults((prev) => {
        const newSet = new Set(prev)
        newSet.delete(resultId)
        return newSet
      })

      setTimeout(() => {
        toast({
          title: "Removed from saved items",
          description: "The image has been removed from your saved items.",
        })
      }, 0)
    } else {

      console.log("Saving image:", result)
      // Add to saved
      saveImage({
        id: resultId,
        title: result.photo_id,
        image: result.photo_url,
        reason: result.reason_for_match,
        interestingDetails: result.interesting_details,
        savedAt: Date.now(),
        heading: result.heading,
        location: result.formatted_address,
        takenAt: result.taken_at,
      })

      setSavedResults((prev) => {
        const newSet = new Set(prev)
        newSet.add(result.id)
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

  const handleSaveChange = (imageId: string, isSaved: boolean) => {
    setSavedResults((prev) => {
      const newSet = new Set(prev);
      if (isSaved) {
        newSet.add(imageId);
      } else {
        newSet.delete(imageId);
      }
      return newSet;
    });
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
        })
      }, 0)
    }
  }

  // Get best match and other matches
  const getBestMatch = () => {
    if (!searchData || !searchData.matches) return null
    return searchData.matches.find((match) => match.is_best_match)
  }

  const getOtherMatches = () => {
    if (!searchData || !searchData.matches) return []
    return searchData.matches.filter((match) => !match.is_best_match).sort((a, b) => a.rank - b.rank)
  }

  if (isLoading && !searchData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="ghost"
            className="pl-0 text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
            onClick={handleBackClick}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Button>
          <ThemeToggle />
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <Card className="w-full max-w-2xl p-6 border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 border-2 border-amber-500 dark:border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="ml-3 text-lg">Loading search data...</p>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="ghost"
            className="pl-0 text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
            onClick={handleBackClick}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Button>
          <ThemeToggle />
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <Card className="w-full max-w-2xl p-6 border-gray-200 dark:border-gray-800">
            <div className="flex items-start gap-4 text-red-500">
              <AlertCircle className="h-6 w-6 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold mb-2">Error</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                <Button onClick={handleBackClick}>Return to Search</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (!searchData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="ghost"
            className="pl-0 text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
            onClick={handleBackClick}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Button>
          <ThemeToggle />
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <Card className="w-full max-w-2xl p-6 border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold mb-4">Search Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              We couldn't find the search you're looking for. It may have been removed or expired.
            </p>
            <Button onClick={handleBackClick}>Return to Search</Button>
          </Card>
        </div>
      </div>
    )
  }

  const bestMatch = getBestMatch()
  const otherMatches = getOtherMatches()

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
            {searchData.query_image_url && (
              <div className="w-full md:w-1/3 lg:w-1/4 p-4 md:p-6">
                <div className="relative aspect-square w-full max-w-[240px] mx-auto md:mx-0">
                  <div className="absolute inset-0 rounded-lg overflow-hidden shadow-md border border-amber-200 dark:border-amber-800/30">
                    <img
                      src={searchData.query_image_url || "/placeholder.svg"}
                      alt="Query image"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-amber-300/20 dark:ring-amber-500/20"></div>
                </div>
              </div>
            )}
            <div className={`flex-1 p-4 md:p-6 ${searchData.query_image_url ? "md:pl-4" : ""}`}>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="h-4 w-1 bg-amber-500 dark:bg-amber-500 rounded-full mr-2"></div>
                  <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 font-semibold">
                    Your search
                  </p>
                </div>
                <p className="text-lg md:text-xl font-medium text-gray-800 dark:text-gray-100 leading-relaxed">
                  {searchData.query_text}
                </p>
                <div className="pt-2">
                <div
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isProcessing
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                        : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                    }`}
                  >
                    {isProcessing ? (
                      <span className="relative flex h-2 w-2 mr-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 dark:bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 dark:bg-amber-300"></span>
                      </span>
                    ) : (
                      <Check className="h-3 w-3 mr-1.5 text-green-500 dark:text-green-300" />
                    )}
                    {isProcessing ? "Processing with AI" : "Processed with AI"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isProcessing ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Card className="w-full max-w-2xl p-6 border-gray-200 dark:border-gray-800">
            {/* Custom Search Progress UI instead of SearchProgress component */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium mb-4">Processing Your Query</h3>
              
              {/* Progress Steps */}
              <ul className="space-y-4">
                {searchSteps.map((step) => {
                  const isVisible = step.current || step.completed;
                  return (
                    <li
                      key={step.id}
                      className={`transition-all duration-300 bg-zinc-50 dark:bg-zinc-900 border ${
                        step.current ? "border-amber-600" : step.completed ? "border-green-500" : "border-zinc-700"
                      } p-4 rounded-lg ${step.current ? "shadow-md shadow-amber-900/20" : ""}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          {step.completed ? (
                            <CheckCircle2 className="text-green-500 w-4 h-4" />
                          ) : step.current ? (
                            <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-gray-500" />
                          )}
                          <span className={`font-medium ${step.current ? "text-amber-600 dark:text-amber-400" : ""}`}>{step.name}</span>
                        </div>
                        <span className={`text-sm ${
                          !isVisible ? "text-gray-400" : 
                          step.current ? "text-amber-600 dark:text-amber-400" :
                          "text-green-600 dark:text-green-400"
                        } capitalize`}>
                          {!isVisible && "Waiting..."}
                          {step.current && "In Progress"}
                          {step.completed && "Completed"}
                        </span>
                      </div>

                      {/* Streamed text for this step - Only show if not shown in the dedicated progress box */}
                      {step.current && step.streamedText && 
                       !(
                         (step.id === "extract_query" && currentProgressStage === "query_analysis") || 
                         (step.id === "image_analysis" && currentProgressStage === "image_analysis") ||
                         (step.id === "format_query" && currentProgressStage === "format_query") ||
                         (step.id === "reasoning" && currentMatchProcessing)
                       ) && (
                        <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto scroll-smooth">
                          {step.streamedText}
                          {step.current && (
                            <span className="inline-block w-2 h-4 bg-amber-500 ml-1 animate-pulse"></span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              
              {/* Match Processing Details shared box - shows query analysis, reasoning or interesting details */}
              {(currentProgressStage === "query_analysis" || currentProgressStage === "image_analysis" || currentProgressStage === "format_query" || currentMatchProcessing) && (
                <div className="mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4">
                  <div className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-3">
                    {currentProgressStage === "query_analysis" && "Analyzing your query..."}
                    {currentProgressStage === "image_analysis" && "Analyzing your image..."}
                    {currentProgressStage === "format_query" && "Formatting your query..."}
                    {currentMatchProcessing && currentMatchProcessing}
                  </div>
                  
                  {/* Show just one progress box based on current stage */}
                  {currentProgressStage === "query_analysis" && queryAnalysisProgress && (
                    <div>
                      <div className="flex items-center text-sm font-medium mb-2">
                        <div className="h-3 w-3 rounded-full bg-blue-500 mr-2"></div>
                        <span className="text-blue-700 dark:text-blue-400">Query Analysis Progress</span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-3 rounded-md text-sm font-mono whitespace-pre-wrap max-h-60 overflow-y-auto border border-blue-100 dark:border-blue-900/30">
                        {queryAnalysisProgress}
                        <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
                      </div>
                    </div>
                  )}
                  
                  {currentProgressStage === "image_analysis" && imageAnalysisProgress && (
                    <div>
                      <div className="flex items-center text-sm font-medium mb-2">
                        <div className="h-3 w-3 rounded-full bg-purple-500 mr-2"></div>
                        <span className="text-purple-700 dark:text-purple-400">Image Analysis Progress</span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-3 rounded-md text-sm font-mono whitespace-pre-wrap max-h-60 overflow-y-auto border border-purple-100 dark:border-purple-900/30">
                        {imageAnalysisProgress}
                        <span className="inline-block w-2 h-4 bg-purple-500 ml-1 animate-pulse"></span>
                      </div>
                    </div>
                  )}
                  
                  {currentProgressStage === "format_query" && formatQueryProgress && (
                    <div>
                      <div className="flex items-center text-sm font-medium mb-2">
                        <div className="h-3 w-3 rounded-full bg-yellow-500 mr-2"></div>
                        <span className="text-yellow-700 dark:text-yellow-400">Query Formatting Progress</span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-3 rounded-md text-sm font-mono whitespace-pre-wrap max-h-60 overflow-y-auto border border-yellow-100 dark:border-yellow-900/30">
                        {formatQueryProgress}
                        <span className="inline-block w-2 h-4 bg-yellow-500 ml-1 animate-pulse"></span>
                      </div>
                    </div>
                  )}
                  
                  {currentMatchProcessing && interestingDetailsProgress && (
                    <div>
                      <div className="flex items-center text-sm font-medium mb-2">
                        <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-green-700 dark:text-green-400">Interesting Details Progress</span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-3 rounded-md text-sm font-mono whitespace-pre-wrap max-h-60 overflow-y-auto border border-green-100 dark:border-green-900/30">
                        {interestingDetailsProgress}
                        <span className="inline-block w-2 h-4 bg-green-500 ml-1 animate-pulse"></span>
                      </div>
                    </div>
                  )}
                  
                  {currentMatchProcessing && !interestingDetailsProgress && reasoningProgress && (
                    <div>
                      <div className="flex items-center text-sm font-medium mb-2">
                        <div className="h-3 w-3 rounded-full bg-amber-500 mr-2"></div>
                        <span className="text-amber-700 dark:text-amber-400">Reasoning Progress</span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-3 rounded-md text-sm font-mono whitespace-pre-wrap max-h-60 overflow-y-auto border border-amber-100 dark:border-amber-900/30">
                        {reasoningProgress}
                        <span className="inline-block w-2 h-4 bg-amber-500 ml-1 animate-pulse"></span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end mt-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowProgressChunks(!showProgressChunks)}
                      className="text-xs"
                    >
                      {showProgressChunks ? 'Hide Details' : 'Show Details'}
                    </Button>
                  </div>
                </div>
              )}
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
          {bestMatch && (
            <div>
              <h2 className="text-xl font-bold mb-4">Best Match</h2>
              <Card
                className="overflow-hidden border-gray-200 dark:border-gray-800 cursor-pointer transition-all hover:shadow-md group"
                onClick={() => handleResultClick(bestMatch)}
              >
                <div className="aspect-video relative">
                  <img
                    src={bestMatch.photo_url || "/placeholder.svg"}
                    alt={bestMatch.heading}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        {/* Image heading on hover */}
                {bestMatch.heading && (
                  <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center text-white text-sm font-medium">
                      <ImageIcon className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                      <span>{bestMatch.heading}</span>
                    </div>
                  </div>
                )}

               
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm hover:bg-white dark:hover:bg-black/70 shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSaveResult(bestMatch)
                      }}
                    >
                      {savedResults.has(bestMatch.id) ? (
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
                        window.open(bestMatch.photo_url, "_blank")
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-medium mb-2">{bestMatch.heading}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-sm text-gray-500 dark:text-gray-400">
                  {bestMatch.formatted_address && (
                    <div className="flex items-center">
                      <MapPin className="h-3.5 w-3.5 mr-1 text-amber-500 dark:text-amber-400" />
                      <span>{bestMatch.formatted_address}</span>
                    </div>
                  )}
                  {bestMatch.taken_at && (
                    <div className="flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1 text-amber-500 dark:text-amber-400" />
                      <span>{formatDate(bestMatch.taken_at)}</span>
                    </div>
                  )}
                  
                  <div className="pl-3 border-l-2 border-gray-100 dark:border-gray-800 space-y-3">
                      {formatReasonIntoPoints(bestMatch.reason_for_match).map((point, index) => (
                        <div key={index} className="flex items-start gap-2 group">
                          <span className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-300 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors text-xs font-medium">
                            {index + 1}
                          </span>
                          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Other Matches */}
          {otherMatches.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-4">Other Matches</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {otherMatches.map((match) => (
                  <Card
                    key={match.id}
                    className="overflow-hidden border-gray-200 dark:border-gray-800 cursor-pointer transition-all hover:shadow-md group"
                    onClick={() => handleResultClick(match)}
                  >
                    <div className="aspect-video relative">
                      <img
                        src={match.photo_url || "/placeholder.svg"}
                        alt={match.heading}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                       {match.heading && (
                      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center text-white text-sm font-medium">
                          <ImageIcon className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                          <span>{match.heading}</span>
                        </div>
                      </div>
                    )}

                    
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm hover:bg-white dark:hover:bg-black/70 shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSaveResult(match)
                          }}
                        >
                          {savedResults.has(match.id) ? (
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
                            window.open(match.photo_url, "_blank")
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-md font-medium mb-2">{match.heading}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-gray-500 dark:text-gray-400">
                      {match.formatted_address && (
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1 text-amber-500 dark:text-amber-400" />
                          <span>{match.formatted_address}</span>
                        </div>
                      )}
                      {match.taken_at && (
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1 text-amber-500 dark:text-amber-400" />
                          <span>{formatDate(match.taken_at)}</span>
                        </div>
                      )}
                     <div className="pl-3 border-l-2 border-gray-100 dark:border-gray-800 space-y-2">
                          {formatReasonIntoPoints(match.reason_for_match)
                            .slice(0, 2)
                            .map((point, index) => (
                              <div key={index} className="flex items-start gap-2 group">
                                <span className="h-4 w-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-300 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors text-xs font-medium">
                                  {index + 1}
                                </span>
                                <p className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed line-clamp-2">
                                  {point}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {!isLoading && !isProcessing && showNoResults && (
            <div className="flex flex-col items-center justify-center py-8">
              <Card className="w-full max-w-2xl p-6 border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-bold mb-4">No Results Found</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  We couldn't find any matches for your search. Please try a different query or image.
                </p>
                <Button onClick={handleBackClick}>Return to Search</Button>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Image Detail Dialog */}
      {selectedResult && (
        <ImageDetailDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          image={selectedResult.photo_url}
          title={selectedResult.heading || ""}
          reason={selectedResult.reason_for_match}
          id={selectedResult.id}  
          formattedAddress={selectedResult.formatted_address}
          takenAt={formatDate(selectedResult.taken_at)}
          heading={selectedResult.heading}
          interestingDetails={selectedResult.interesting_details}
          matchId={selectedResult.id} 
          onSaveChange={handleSaveChange}
        />
      )}
    </div>
  )
}