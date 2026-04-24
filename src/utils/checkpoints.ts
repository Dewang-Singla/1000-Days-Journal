export const DEFAULT_CHECKPOINTS: string[] = [
  "Did I spend most of my day doing what my ideal self would do?",
  "Did I protect my focus and not let distractions, interruptions, or impulses control my day?",
  "Did I avoid actions that go against the person I want to become?",
  "Did I complete the important tasks I planned for today?",
  "Did I start my work on time and avoid unnecessary delay?",
  "Did I make real progress on long-term goals, not only urgent tasks?",
  "Did I stay disciplined even when I did not feel motivated?",
  "Did I learn from mistakes instead of repeating them?",
  "Did I act with clarity and purpose instead of avoidance?",
  "Did I avoid unnecessary negativity and comparison that pull me off track?",
];

export function normalizeCheckpointPrompts(value: unknown): string[] {
  const incoming = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

  const base = [...DEFAULT_CHECKPOINTS];
  for (let i = 0; i < 10; i += 1) {
    const next = incoming[i];
    if (typeof next === "string") {
      base[i] = next;
    }
  }

  return base;
}
