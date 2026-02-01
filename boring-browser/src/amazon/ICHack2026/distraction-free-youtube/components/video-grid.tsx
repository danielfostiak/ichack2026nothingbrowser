"use client";

import { useState, useEffect } from "react";

interface Video {
  id: string;
  title: string;
  channel: string;
  duration: string;
}

interface VideoGridProps {
  searchQuery: string;
  onSelectVideo: (video: Video) => void;
}

const MOCK_VIDEOS: Record<string, Video[]> = {
  default: [
    {
      id: "dQw4w9WgXcQ",
      title: "Rick Astley - Never Gonna Give You Up",
      channel: "Rick Astley",
      duration: "3:33",
    },
    {
      id: "jNQXAC9IVRw",
      title: "Me at the zoo",
      channel: "jawed",
      duration: "0:19",
    },
    {
      id: "kJQP7kiw5Fk",
      title: "Luis Fonsi - Despacito ft. Daddy Yankee",
      channel: "Luis Fonsi",
      duration: "4:42",
    },
    {
      id: "9bZkp7q19f0",
      title: "PSY - Gangnam Style",
      channel: "officialpsy",
      duration: "4:13",
    },
    {
      id: "RgKAFK5djSk",
      title: "Wiz Khalifa - See You Again ft. Charlie Puth",
      channel: "Wiz Khalifa",
      duration: "3:58",
    },
    {
      id: "fJ9rUzIMcZQ",
      title: "Queen - Bohemian Rhapsody",
      channel: "Queen Official",
      duration: "5:59",
    },
    {
      id: "hTWKbfoikeg",
      title: "Nirvana - Smells Like Teen Spirit",
      channel: "Nirvana",
      duration: "5:01",
    },
    {
      id: "YQHsXMglC9A",
      title: "Adele - Hello",
      channel: "Adele",
      duration: "6:07",
    },
  ],
  programming: [
    {
      id: "rfscVS0vtbw",
      title: "Learn Python - Full Course for Beginners",
      channel: "freeCodeCamp.org",
      duration: "4:26:52",
    },
    {
      id: "PkZNo7MFNFg",
      title: "Learn JavaScript - Full Course for Beginners",
      channel: "freeCodeCamp.org",
      duration: "3:26:42",
    },
    {
      id: "Ke90Tje7VS0",
      title: "React Course - Beginner's Tutorial for 2024",
      channel: "freeCodeCamp.org",
      duration: "11:55:27",
    },
    {
      id: "zJSY8tbf_ys",
      title: "Node.js and Express.js - Full Course",
      channel: "freeCodeCamp.org",
      duration: "8:16:47",
    },
    {
      id: "qw--VYLpxG4",
      title: "PostgreSQL Tutorial - Full Course for Beginners",
      channel: "freeCodeCamp.org",
      duration: "4:19:24",
    },
    {
      id: "Oe421EPjeBE",
      title: "Git and GitHub for Beginners - Crash Course",
      channel: "freeCodeCamp.org",
      duration: "1:08:29",
    },
  ],
  music: [
    {
      id: "JGwWNGJdvx8",
      title: "Ed Sheeran - Shape of You",
      channel: "Ed Sheeran",
      duration: "4:24",
    },
    {
      id: "OPf0YbXqDm0",
      title: "Mark Ronson - Uptown Funk ft. Bruno Mars",
      channel: "Mark Ronson",
      duration: "4:31",
    },
    {
      id: "CevxZvSJLk8",
      title: "Katy Perry - Roar",
      channel: "Katy Perry",
      duration: "4:30",
    },
    {
      id: "60ItHLz5WEA",
      title: "Alan Walker - Faded",
      channel: "Alan Walker",
      duration: "3:32",
    },
    {
      id: "SlPhMPnQ58k",
      title: "Maroon 5 - Sugar",
      channel: "Maroon 5",
      duration: "5:01",
    },
    {
      id: "7PCkvCPvDXk",
      title: "Sia - Cheap Thrills ft. Sean Paul",
      channel: "Sia",
      duration: "3:44",
    },
  ],
  documentary: [
    {
      id: "EhAemz1v7dQ",
      title: "Planet Earth II - Cities",
      channel: "BBC Earth",
      duration: "58:24",
    },
    {
      id: "7W33HRc1A6c",
      title: "The Story of Stuff",
      channel: "Story of Stuff Project",
      duration: "21:25",
    },
    {
      id: "vuITqHwb7rE",
      title: "How The Economic Machine Works",
      channel: "Principles by Ray Dalio",
      duration: "31:00",
    },
    {
      id: "JTxsNm9IdYU",
      title: "The Social Dilemma - Technology and Society",
      channel: "Netflix Documentary",
      duration: "1:34:00",
    },
  ],
};

export function VideoGrid({ searchQuery, onSelectVideo }: VideoGridProps) {
  const [videos, setVideos] = useState<Video[]>(MOCK_VIDEOS.default);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchQuery) {
      setVideos(MOCK_VIDEOS.default);
      return;
    }

    setLoading(true);

    const timer = setTimeout(() => {
      const query = searchQuery.toLowerCase();

      if (
        query.includes("program") ||
        query.includes("code") ||
        query.includes("python") ||
        query.includes("javascript")
      ) {
        setVideos(MOCK_VIDEOS.programming);
      } else if (query.includes("music") || query.includes("song")) {
        setVideos(MOCK_VIDEOS.music);
      } else if (query.includes("documentary") || query.includes("nature")) {
        setVideos(MOCK_VIDEOS.documentary);
      } else {
        setVideos([
          ...MOCK_VIDEOS.default.slice(0, 3),
          ...MOCK_VIDEOS.programming.slice(0, 2),
          ...MOCK_VIDEOS.music.slice(0, 3),
        ]);
      }
      setLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Searching...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video) => (
        <button
          key={video.id}
          onClick={() => onSelectVideo(video)}
          className="text-left p-4 bg-card rounded-2xl border border-border hover:border-muted-foreground/50 transition-colors"
        >
          <h3 className="text-foreground leading-snug line-clamp-2 mb-2">
            {video.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {video.channel} · {video.duration}
          </p>
        </button>
      ))}
    </div>
  );
}
