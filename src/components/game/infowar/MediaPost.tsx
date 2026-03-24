import type { MediaPost as MediaPostType } from "@/lib/infowar/types";
import { TweetCard } from "./channels/TweetCard";
import { NewsTickerCard } from "./channels/NewsTickerCard";
import { RadioCard } from "./channels/RadioCard";
import { TelegramCard } from "./channels/TelegramCard";
import { ForumCard } from "./channels/ForumCard";
import { NewspaperCard } from "./channels/NewspaperCard";

interface MediaPostProps {
  post: MediaPostType;
  simTime: number;
}

function formatAge(simTime: number, postTime: number): string {
  const diffMs = simTime - postTime;
  if (diffMs < 0) return "soon";
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export function MediaPost({ post, simTime }: MediaPostProps) {
  const age = formatAge(simTime, post.simTime);

  switch (post.channel) {
    case "tweet":
    case "osint-account":
    case "tiktok-caption":
    case "youtube-caption":
      return <TweetCard post={post} age={age} />;

    case "cable-news-ticker":
    case "tv-anchor":
      return <NewsTickerCard post={post} age={age} />;

    case "radio-broadcast":
    case "embedded-journalist":
      return <RadioCard post={post} age={age} />;

    case "telegram":
      return <TelegramCard post={post} age={age} />;

    case "web-forum":
    case "reddit":
    case "blog-post":
      return <ForumCard post={post} age={age} />;

    case "newspaper-headline":
    case "wire-bulletin":
    case "government-communique":
      return <NewspaperCard post={post} age={age} />;

    default:
      return <TweetCard post={post} age={age} />;
  }
}
