"use client";

import { useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { VideoGrid } from "@/components/video-grid";
import { VideoPlayer } from "@/components/video-player";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    title: string;
    channel: string;
    duration: string;
  } | null>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedVideo(null);
  };

  const handleSelectVideo = (video: {
    id: string;
    title: string;
    channel: string;
    duration: string;
  }) => {
    setSelectedVideo(video);
  };

  const handleBack = () => {
    setSelectedVideo(null);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            Youtube
          </h1>
          
        </header>

        <SearchBar onSearch={handleSearch} />

        {selectedVideo ? (
          <VideoPlayer video={selectedVideo} onBack={handleBack} />
        ) : (
          <VideoGrid
            searchQuery={searchQuery}
            onSelectVideo={handleSelectVideo}
          />
        )}
      </div>
    </main>
  );
}
