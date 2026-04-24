import type { DayEntry } from "../db";

export function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

export function hasEntryContent(entry: DayEntry): boolean {
  return (
    stripHtml(entry.journal).trim().length > 0 ||
    entry.quoteOfDay.trim().length > 0 ||
    entry.todos.length > 0 ||
    entry.memories.length > 0
  );
}