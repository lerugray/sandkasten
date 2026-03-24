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
  onMarkRead: (postId: string) => void;
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

export function MediaPost({ post, simTime, onMarkRead }: MediaPostProps) {
  const age = formatAge(simTime, post.simTime);

  const handleClick = () => {
    if (!post.read) onMarkRead(post.id);
  };

  let card: React.ReactNode;

  const TWEET_CHANNEL_LABELS: Record<string, string> = {
    "tweet": "",
    "osint-account": "OSINT",
    "tiktok-caption": "TikTok",
    "youtube-caption": "YouTube",
  };

  switch (post.channel) {
    case "tweet":
    case "osint-account":
    case "tiktok-caption":
    case "youtube-caption":
      card = <TweetCard post={post} age={age} channelLabel={TWEET_CHANNEL_LABELS[post.channel]} />;
      break;

    case "cable-news-ticker":
    case "tv-anchor":
      card = <NewsTickerCard post={post} age={age} />;
      break;

    case "radio-broadcast":
    case "embedded-journalist":
      card = <RadioCard post={post} age={age} />;
      break;

    case "telegram":
      card = <TelegramCard post={post} age={age} />;
      break;

    case "web-forum":
    case "reddit":
    case "blog-post":
      card = <ForumCard post={post} age={age} />;
      break;

    case "newspaper-headline":
    case "wire-bulletin":
    case "government-communique":
      card = <NewspaperCard post={post} age={age} />;
      break;

    default:
      card = <TweetCard post={post} age={age} />;
  }

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer transition-opacity ${post.read ? "opacity-70" : ""}`}
    >
      {card}
    </div>
  );
}
