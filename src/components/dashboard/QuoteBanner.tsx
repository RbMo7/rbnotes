"use client";

import type { Quote } from "@/lib/quotes";

export function QuoteBanner({ quote }: { quote: Quote }) {
  return (
    <p className="font-label-sm text-label-sm text-outline text-center italic max-w-md text-balance">
      &ldquo;{quote.text}&rdquo; <span className="not-italic">— {quote.author}</span>
    </p>
  );
}
