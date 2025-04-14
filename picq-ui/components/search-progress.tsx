"use client"

import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { StreamingText } from "./streaming-text"

export type SearchStep = {
  id: string
  name: string
  message: string
  completed: boolean
  current: boolean
  streamedText?: string
}

interface SearchProgressProps {
  steps: SearchStep[]
}

export function SearchProgress({ steps }: SearchProgressProps) {
  // Find the current step with streamed text
  const currentStepWithStream = steps.find((step) => step.current && step.streamedText)

  // Force re-render when steps change
  const [, forceUpdate] = useState({})

  useEffect(() => {
    // This effect will run whenever the steps change
    console.log("Steps updated:", steps)
    forceUpdate({})
  }, [steps])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold mb-6">Processing Your Query</h2>

      <div className="space-y-6">
        {steps.map((step) => (
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
      {currentStepWithStream && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-4 min-h-[100px]">
            <StreamingText
              text={currentStepWithStream.streamedText || ""}
              className="text-gray-700 dark:text-gray-300"
            />
          </div>
        </div>
      )}
    </div>
  )
}
