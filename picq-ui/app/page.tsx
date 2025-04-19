import { Sparkles, Bookmark } from "lucide-react"
import PicQSearch from "@/components/pic-q-search"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/saved">
                {/* Icon button for mobile, text button for desktop */}
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
                  aria-label="Saved Images"
                >
                  <Bookmark className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden md:flex text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
                >
                  Saved Images
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent className="md:hidden">
              <p>Saved Images</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ThemeToggle />
      </div>
      <div className="w-full max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight flex items-center justify-center">
            pic<span className="text-amber-500 dark:text-amber-400">Q</span>
            <Sparkles className="h-5 w-5 ml-2 text-amber-500 dark:text-amber-400" />
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">Intelligent visual discovery</p>
        </div>
        <PicQSearch />
      </div>
    </main>
  )
}
