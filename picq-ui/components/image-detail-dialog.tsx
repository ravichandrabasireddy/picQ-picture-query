"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Send,
  X,
  Info,
  MessageSquare,
  Sparkles,
  MapPin,
  Calendar,
  Download,
  Copy,
  Bookmark,
  BookmarkCheck,
} from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { saveImage, removeSavedImage, isImageSaved } from "@/lib/saved-images"

type ChatMessage = {
  id: string
  is_user: boolean
  message_text: string
  created_at: string
}

type ChatHistory = {
  chat_id: string
  match_id: string
  messages: ChatMessage[]
}

// Helper function to extract text from XML/code blocks
function extractTextFromXML(text: string): string {
  // Remove code block markers with or without xml specification
  text = text
    .replace(/```xml\n?/g, "")
    .replace(/```\n?/g, "")
    .replace(/```/g, "")

  // Remove XML answer tags and any whitespace between them
  text = text.replace(/<answer>\s*/g, "").replace(/\s*<\/answer>/g, "")

  // Trim whitespace
  return text.trim()
}


type ImageDetailProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  image: string
  title: string
  reason: string
  id: string
  formattedAddress?: string
  takenAt?: string
  interestingDetails?: string[]
  heading?: string

  matchId: string
}


export function ImageDetailDialog({
  open,
  onOpenChange,
  image,
  title,
  reason,
  id,
  formattedAddress,
  takenAt,
  interestingDetails = [],
  heading,  
  matchId
}: ImageDetailProps) {

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
  
  const [chatHistory, setChatHistory] = useState<ChatHistory | null>(null)
  const [isFetchingChat, setIsFetchingChat] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"details" | "chat">("details")
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    {
      role: "assistant",
      content: "Ask me anything about this image!",
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [streamedResponse, setStreamedResponse] = useState("")
  const [currentStatus, setCurrentStatus] = useState<string | null>(null)
  // Use provided location and date or fallback to defaults
  const imageLocation = formattedAddress || "San Francisco, California"
  const imageDate = takenAt || "June 15, 2023"
  // Use provided interesting facts or fallback to defaults
  const facts =
  Array.isArray(interestingDetails) && interestingDetails.length > 0
      ? interestingDetails
      : [
          "This image was captured using a high-resolution camera with specialized lighting techniques.",
          "The color palette features predominantly warm tones with complementary cool accents.",
          "The composition follows the rule of thirds, creating a balanced and visually appealing arrangement.",
          "This style is reminiscent of contemporary visual aesthetics popular in digital media.",
          "The visual elements in this image create a sense of depth and dimension through careful layering.",
        ]
        useEffect(() => {
          if (open && matchId && activeTab === "chat") {
            fetchChatHistory()
          }
        }, [open, matchId, activeTab])
      
        // Function to fetch chat history
        const fetchChatHistory = async () => {
          if (!matchId) return
      
          setIsFetchingChat(true)
          setChatError(null)
      
          try {
            const response = await fetch(`/api/chats/${matchId}`)
      
            if (!response.ok) {
              throw new Error(`Failed to fetch chat history: ${response.status}`)
            }
      
            const data = await response.json()
            setChatHistory(data)
      
            // Convert the chat history to the format used by the component
            if (data.messages && data.messages.length > 0) {
              const formattedMessages = data.messages.map((msg: ChatMessage) => ({
                role: msg.is_user ? ("user" as const) : ("assistant" as const),
                content: msg.is_user ? msg.message_text : extractTextFromXML(msg.message_text),
              }))
      
              // Only update messages if we have chat history
              if (formattedMessages.length > 0) {
                setMessages(formattedMessages)
              }
            }
          } catch (error) {
            console.error("Error fetching chat history:", error)
            setChatError("Failed to load chat history. You can still start a new conversation.")
          } finally {
            setIsFetchingChat(false)
          }
        }

        const handleSendMessage = async (e: React.FormEvent) => {
          e.preventDefault()
          if (!inputValue.trim() || isLoading) return
      
          // Add user message
          const userMessage = { role: "user" as const, content: inputValue }
          setMessages((prev) => [...prev, userMessage])
      
          // Clear input and set loading state
          const userInput = inputValue
          setInputValue("")
          setIsLoading(true)
          setStreamedResponse("")
          setCurrentStatus("Sending message...")
          try {
            // If we have a matchId, send the message to the API
            if (matchId) {
              // Add a temporary placeholder for the AI response
              setMessages((prev) => [...prev, { role: "assistant" as const, content: "" }])
      
              // Prepare the request body
              const requestBody = {
                message: userInput,
              }
      
              // Send the message to the API with streaming response
              const response = await fetch(`/api/chats/${matchId}/send`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
              })
      
              if (!response.ok) {
                throw new Error(`Failed to send message: ${response.status}`)
              }
      
              // Handle the streaming response
              const reader = response.body?.getReader()
              if (!reader) {
                throw new Error("Failed to get response reader")
              }
      
              const decoder = new TextDecoder()
              let responseText = ""
              let buffer = ""
      
              // Process the stream
              while (true) {
                const { done, value } = await reader.read()
      
                if (done) {
                  break
                }
      
                // Decode the chunk and add it to the buffer
                const chunk = decoder.decode(value, { stream: true })
                buffer += chunk
      
                // Process complete lines in the buffer
                let lineEnd = buffer.indexOf("\n")
                while (lineEnd >= 0) {
                  const line = buffer.substring(0, lineEnd).trim()
                  buffer = buffer.substring(lineEnd + 1)
      
                  if (line) {
                    try {
                      // Parse the event data
                      const eventData = JSON.parse(line)
      
                      // Handle different event types
                      switch (eventData.event) {
                        case "processing":
                        case "generating":
                          const statusData = JSON.parse(eventData.data)
                          setCurrentStatus(statusData.message || "Processing...")
                          break
      
                        case "answer_start":
                          setCurrentStatus("Generating answer...")
                          responseText = ""
                          break
      
                        case "answer_chunk":
                          const chunkData = JSON.parse(eventData.data)
                          if (chunkData.chunk) {
                            responseText += chunkData.chunk
      
                            // Format the text for display
                            const formattedText = extractTextFromXML(responseText)
                            setStreamedResponse(formattedText)
      
                            // Update the last message with the current streamed response
                            setMessages((prev) => {
                              const newMessages = [...prev]
                              newMessages[newMessages.length - 1] = {
                                role: "assistant",
                                content: formattedText,
                              }
                              return newMessages
                            })
                          }
                          break
      
                        case "complete":
                          setCurrentStatus(null)
                          const completeData = JSON.parse(eventData.data)
                          if (completeData.answer) {
                            const finalText = extractTextFromXML(completeData.answer)
      
                            // Update the last message with the final response
                            setMessages((prev) => {
                              const newMessages = [...prev]
                              newMessages[newMessages.length - 1] = {
                                role: "assistant",
                                content: finalText,
                              }
                              return newMessages
                            })
                          }
                          break
                      }
                    } catch (error) {
                      console.error("Error parsing event data:", error, line)
                    }
                  }
      
                  // Look for the next line
                  lineEnd = buffer.indexOf("\n")
                }
              }
            } else {
              // Fallback to simulated response if no matchId
              let simulatedResponse = ""
              const fullResponse = `I analyzed the image further based on your question about "${userInput}". This appears to be a ${
                Math.random() > 0.5 ? "natural" : "composed"
              } scene with interesting visual elements. The lighting suggests it was ${
                Math.random() > 0.5 ? "captured during daytime" : "taken in controlled conditions"
              }. The subject matter relates to your search query in several ways, particularly through its ${
                Math.random() > 0.5 ? "thematic elements" : "visual composition"
              }.`
      
              // Add a temporary placeholder for the AI response
              setMessages((prev) => [...prev, { role: "assistant" as const, content: "" }])
      
              // Simulate streaming by adding characters one by one
              for (let i = 0; i < fullResponse.length; i++) {
                await new Promise((resolve) => setTimeout(resolve, 10))
                simulatedResponse += fullResponse[i]
      
                // Update the streamed response
                setStreamedResponse(simulatedResponse)
      
                // Update the last message with the current streamed response
                setMessages((prev) => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = {
                    role: "assistant",
                    content: simulatedResponse,
                  }
                  return newMessages
                })
              }
            }
          } catch (error) {
            console.error("Error sending message:", error)
            toast({
              title: "Error",
              description: "Failed to send message. Please try again.",
              variant: "destructive",
            })
      
            // Remove the temporary placeholder message
            setMessages((prev) => prev.slice(0, -1))
          } finally {
            setIsLoading(false)
            setStreamedResponse("")
            setCurrentStatus(null)
          }
        }

  const toggleSave = () => {
    const imageId = id || `dialog_${title.replace(/\s+/g, "_").toLowerCase()}`

    if (isSaved) {
      // Remove from saved
      removeSavedImage(imageId)
      setIsSaved(false)

      setTimeout(() => {
        toast({
          title: "Removed from saved items",
          description: "The image has been removed from your saved items.",
        })
      }, 0)
    } else {
      // Add to saved
      saveImage({
        id: imageId,
        title,
        image,
        reason,
        savedAt: Date.now(),
        location:formattedAddress,
        takenAt: takenAt,
        interestingDetails: interestingDetails,
        heading: heading,
      })
      setIsSaved(true)

      setTimeout(() => {
        toast({
          title: "Saved successfully",
          description: "The image has been added to your saved items.",
        })
      }, 0)
    }
  }

  const handleDownload = () => {
    // Create a temporary link element
    const link = document.createElement("a")
    link.href = image
    link.download = `${title.replace(/\s+/g, "-").toLowerCase()}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      toast({
        title: "Download started",
        description: "Your image is being downloaded.",
      })
    }, 0)
  }

  // Simplified share function that only uses clipboard
  const handleShare = () => {
    try {
      navigator.clipboard
        .writeText(image)
        .then(() => {
          setTimeout(() => {
            toast({
              title: "Link copied",
              description: "Image link has been copied to your clipboard.",
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

  // Scroll to bottom of messages when new ones are added
  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, activeTab, streamedResponse])

  useEffect(() => {
    if (open) {
      const imageId = id || `dialog_${title.replace(/\s+/g, "_").toLowerCase()}`
      setIsSaved(isImageSaved(imageId))
    }
  }, [open, id, title])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full h-[85vh] p-0 gap-0 rounded-xl overflow-hidden border-0 shadow-2xl">
        <div className="flex flex-col md:flex-row h-full overflow-hidden">
          {/* Left side - Image */}
          <div className="w-full md:w-1/2 h-[30vh] md:h-full relative bg-black p-4 flex items-center justify-center">
            <div className="relative w-full h-full rounded-lg overflow-hidden shadow-lg">
              <img src={image || "/placeholder.svg"} alt={title} className="w-full h-full object-contain z-0" />

              {/* Title and close button */}
              <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 bg-black/60">
                <h2 className="text-white text-xl font-bold drop-shadow-md line-clamp-1">{title}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Action buttons */}
              <div className="absolute top-16 right-4 z-20 flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60"
                  onClick={toggleSave}
                >
                  {isSaved ? <BookmarkCheck className="h-5 w-5 text-amber-500" /> : <Bookmark className="h-5 w-5" />}
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60"
                  onClick={handleDownload}
                >
                  <Download className="h-5 w-5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60"
                  onClick={handleShare}
                >
                  <Copy className="h-5 w-5" />
                </Button>
              </div>

              {/* Location and date */}
              <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-black/60">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center text-white/90 text-sm">
                    <MapPin className="h-3.5 w-3.5 mr-1.5" />
                    <span>{imageLocation}</span>
                  </div>
                  <div className="flex items-center text-white/90 text-sm">
                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                    <span>{imageDate}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Content */}
          <div className="w-full md:w-1/2 flex flex-col h-[calc(85vh-30vh)] md:h-full bg-white dark:bg-gray-900">
            {/* Custom Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-800">
              <div className="flex">
                <button
                  className={cn(
                    "flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative",
                    activeTab === "details"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
                  )}
                  onClick={() => setActiveTab("details")}
                >
                  <Info className="h-4 w-4" />
                  <span>Details</span>
                  {activeTab === "details" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 dark:bg-amber-500" />
                  )}
                </button>
                <button
                  className={cn(
                    "flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative",
                    activeTab === "chat"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
                  )}
                  onClick={() => setActiveTab("chat")}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat</span>
                  {activeTab === "chat" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 dark:bg-amber-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {/* Details Tab */}
              <div
                className={cn(
                  "h-full transition-opacity duration-300",
                  activeTab === "details" ? "opacity-100" : "opacity-0 hidden",
                )}
              >
                <ScrollArea className="h-full">
                  <div className="p-6 space-y-6">
                    {/* Reason section */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-6 w-1 bg-amber-500 dark:bg-amber-500 rounded-full" />
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                        Reason for Match <span className="text-amber-500 dark:text-amber-400">✨</span>
                        </h3>
                      </div>
                      <div className="pl-3 border-l-2 border-gray-100 dark:border-gray-800 space-y-3">
                        {formatReasonIntoPoints(reason).map((point, index) => (
                          <div key={index} className="flex items-start gap-2 group">
                            <span className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-300 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors text-xs font-medium">
                              {index + 1}
                            </span>
                            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{point}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Interesting facts section */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-6 w-1 bg-amber-500 dark:bg-amber-500 rounded-full" />
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-1">
                          <span>Interesting Details</span>
                          <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                        </h3>
                      </div>
                      <div className="pl-3 border-l-2 border-gray-100 dark:border-gray-800">
                        <ul className="space-y-3">
                          {facts.map((fact, index) => (
                            <li
                              key={index}
                              className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed flex items-start gap-2 group"
                            >
                              <span className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-300 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                                {index + 1}
                              </span>
                              <span>{fact}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* Chat Tab */}
              <div
                className={cn(
                  "h-full flex flex-col transition-opacity duration-300",
                  activeTab === "chat" ? "opacity-100" : "opacity-0 hidden",
                )}
              >
                {/* Messages area */}
                <ScrollArea className="flex-1 px-4">
                  <div className="py-4 space-y-4">
                  {isFetchingChat ? (
                      <div className="flex justify-center items-center h-32">
                        <div className="flex flex-col items-center">
                          <div className="h-8 w-8 border-2 border-amber-500 dark:border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">Loading chat history...</p>
                        </div>
                      </div>
                    ) : chatError ? (
                      <div className="flex justify-center items-center h-32">
                        <div className="text-center p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800/30 max-w-md">
                          <p className="text-red-600 dark:text-red-400 mb-2">{chatError}</p>
                          <Button variant="outline" size="sm" onClick={fetchChatHistory} className="text-xs">
                            Retry
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                    {messages.map((message, index) => (
                          <div
                            key={index}
                            className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] rounded-2xl p-4",
                                message.role === "user"
                                  ? "bg-amber-500 dark:bg-amber-600 text-white rounded-tr-none"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-tl-none",
                              )}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            </div>
                          </div>
                        ))}
                        {currentStatus && (
                          <div className="flex justify-center my-2">
                            <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-500 dark:text-gray-400 flex items-center">
                              <div className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 mr-2 animate-pulse"></div>
                              {currentStatus}
                            </div>
                          </div>
                        )}
                     {isLoading && !streamedResponse && !currentStatus &&  ( 
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-tl-none p-4 bg-gray-100 dark:bg-gray-800">
                          <div className="flex space-x-2">
                            <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce"></div>
                            <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce delay-75"></div>
                            <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce delay-150"></div>
                          </div>
                        </div>
                      </div>
                       )}
                      </>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input area */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Ask a question about this image..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="flex-1 bg-gray-100 dark:bg-gray-800 border-0 focus-visible:ring-amber-500"
                      disabled={isLoading || isFetchingChat}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 rounded-full h-10 w-10 flex-shrink-0"
                      disabled={isLoading || isFetchingChat || !inputValue.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
