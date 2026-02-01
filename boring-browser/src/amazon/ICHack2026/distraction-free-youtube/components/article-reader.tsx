"use client";

import { ArrowLeft } from "lucide-react";

interface Article {
  id: string;
  title: string;
  source: string;
  readTime: string;
  content: string;
}

interface ArticleReaderProps {
  article: Article;
  onBack: () => void;
}

export function ArticleReader({ article, onBack }: ArticleReaderProps) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <article>
          <header className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground leading-snug mb-3">
              {article.title}
            </h1>
            <p className="text-muted-foreground">
              {article.source} · {article.readTime}
            </p>
          </header>

          <div className="prose prose-invert prose-gray max-w-none">
            {article.content.split("\n\n").map((paragraph, index) => (
              <p
                key={index}
                className="text-foreground/90 leading-relaxed mb-6"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
