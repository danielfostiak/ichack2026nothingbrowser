"use client";

import { ArrowLeft } from "lucide-react";

interface VideoPlayerProps {
  video: {
    id: string;
    title: string;
    channel: string;
    duration: string;
  };
  onBack: () => void;
}

export function VideoPlayer({ video, onBack }: VideoPlayerProps) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to videos
      </button>

      <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-6">
        <iframe
          src={`https://www.youtube.com/embed/${video.id}?rel=0&modestbranding=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>

      <div>
        <h2 className="text-lg font-medium text-foreground mb-1">
          {video.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {video.channel} · {video.duration}
        </p>
      </div>
    </div>
  );
}
