import { Sparkles } from "lucide-react"
import PicQSearch from "@/components/pic-q-search"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Link href="/saved">
          <Button
            variant="outline"
            size="sm"
            className="text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
          >
            Saved Images
          </Button>
        </Link>
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
