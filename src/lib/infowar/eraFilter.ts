/**
 * Era detection and channel availability.
 *
 * Derives the media era from scenario startTime and determines
 * which media channels are available in that era.
 */

import type { MediaEra, MediaChannel } from "./types";

const ERA_CHANNELS: Record<MediaEra, MediaChannel[]> = {
  "pre-1980": [
    "radio-broadcast",
    "newspaper-headline",
    "wire-bulletin",
    "government-communique",
  ],
  "1980s-1990s": [
    "radio-broadcast",
    "newspaper-headline",
    "wire-bulletin",
    "government-communique",
    "cable-news-ticker",
    "tv-anchor",
  ],
  "2000s": [
    "radio-broadcast",
    "newspaper-headline",
    "wire-bulletin",
    "government-communique",
    "cable-news-ticker",
    "tv-anchor",
    "blog-post",
    "web-forum",
    "embedded-journalist",
  ],
  "2010s": [
    "radio-broadcast",
    "newspaper-headline",
    "wire-bulletin",
    "government-communique",
    "cable-news-ticker",
    "tv-anchor",
    "blog-post",
    "web-forum",
    "embedded-journalist",
    "tweet",
    "reddit",
    "youtube-caption",
    "telegram",
  ],
  "2020s+": [
    "radio-broadcast",
    "newspaper-headline",
    "wire-bulletin",
    "government-communique",
    "cable-news-ticker",
    "tv-anchor",
    "blog-post",
    "web-forum",
    "embedded-journalist",
    "tweet",
    "reddit",
    "youtube-caption",
    "telegram",
    "tiktok-caption",
    "osint-account",
  ],
};

export function getEra(startTimeMs: number): MediaEra {
  const year = new Date(startTimeMs).getFullYear();
  if (year < 1980) return "pre-1980";
  if (year < 2000) return "1980s-1990s";
  if (year < 2010) return "2000s";
  if (year < 2020) return "2010s";
  return "2020s+";
}

export function getAvailableChannels(era: MediaEra): MediaChannel[] {
  return ERA_CHANNELS[era];
}
