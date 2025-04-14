"use client"

import { useEffect, useRef, useState } from "react"

interface StreamingTextProps {
  text: string
  className?: string
  showCursor?: boolean
}

export function StreamingText({ text, className = "", showCursor = true }: StreamingTextProps) {
  const [renderedText, setRenderedText] = useState(text)
  const prevTextRef = useRef(text)

  // Force immediate update when text changes
  useEffect(() => {
    if (text !== prevTextRef.current) {
      setRenderedText(text)
      prevTextRef.current = text
    }
  }, [text])

  return (
    <div className={`font-mono text-sm leading-relaxed whitespace-pre-wrap ${className}`}>
      {renderedText}
      {showCursor && <span className="inline-block w-2 h-4 bg-amber-500 dark:bg-amber-400 ml-1 animate-pulse"></span>}
    </div>
  )
}
