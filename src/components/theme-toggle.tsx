"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={dark ? "Açıq rejimə keç" : "Tünd rejimə keç"}
      aria-pressed={dark}
      title={dark ? "Açıq rejim" : "Tünd rejim"}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.dataset.theme = next ? "dark" : "light";
        try {
          localStorage.setItem("artisaat:theme", next ? "dark" : "light");
        } catch {
          /* The selected theme still works for this visit. */
        }
      }}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
