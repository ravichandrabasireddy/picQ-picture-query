"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Trash2, Download, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { useToast } from "@/components/ui/use-toast"
import { getSavedImages, removeSavedImage, type SavedImage } from "@/lib/saved-images"
import { ImageDetailDialog } from "@/components/image-detail-dialog"

export default function SavedImagesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [savedImages, setSavedImages] = useState<SavedImage[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<SavedImage | null>(null)

  useEffect(() => {
    // Load saved images on component mount
    setSavedImages(getSavedImages())
  }, [])

  const handleBackClick = () => {
    router.push("/")
  }

  const handleRemove = (id: string) => {
    removeSavedImage(id)
    setSavedImages(getSavedImages())

    setTimeout(() => {
      toast({
        title: "Image removed",
        description: "The image has been removed from your saved items.",
      })
    }, 0)
  }

  const handleImageClick = (image: SavedImage) => {
    setSelectedImage(image)
    setDialogOpen(true)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
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

        <h1 className="text-3xl font-bold">Saved Images</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Your collection of saved images from picQ</p>
      </div>

      {savedImages.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-medium mb-2">No saved images yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Images you save will appear here. Start by searching and saving images you like.
          </p>
          <Button
            onClick={handleBackClick}
            className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            Search Images
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedImages.map((image) => (
            <Card key={image.id} className="overflow-hidden border-gray-200 dark:border-gray-800 group">
              <div className="aspect-video relative cursor-pointer" onClick={() => handleImageClick(image)}>
                <img
                  src={image.image || "/placeholder.svg"}
                  alt={image.title}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 dark:group-hover:bg-black/20 transition-colors" />

                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm hover:bg-white dark:hover:bg-black/70 shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(image.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm hover:bg-white dark:hover:bg-black/70 shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(image.image, "_blank")
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-medium mb-1 line-clamp-1">{image.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Saved on {formatDate(image.savedAt)}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 p-0 h-auto"
                  onClick={() => handleImageClick(image)}
                >
                  View Details <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Image Detail Dialog */}
      {selectedImage && (
        <ImageDetailDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          image={selectedImage.image}
          title={selectedImage.title}
          reason={selectedImage.reason || ""}
        />
      )}
    </div>
  )
}
