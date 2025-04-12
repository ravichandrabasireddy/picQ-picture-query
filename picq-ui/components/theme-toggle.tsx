"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  
  // Only show UI once mounted on client to prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // While not mounted, render a placeholder with same dimensions
  if (!mounted) {
    return <Button variant="outline" size="icon" className="rounded-full w-10 h-10" />;
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };
  
  return (
    <Button 
      variant="outline" 
      size="icon" 
      onClick={toggleTheme} 
      className="rounded-full"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}