"use client";

/**
 * React hook that bridges simulation state to the InfoWar engine.
 *
 * Observes gameState/combatState/eventState for changes, extracts triggers,
 * dispatches them to the engine, and collects generated posts.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { GameState } from "@/lib/simulation/gameState";
import type { CombatState } from "@/lib/simulation/combat";
import type { EventState } from "@/lib/ai/events";
import type { InfoWarState, InfoWarConfig, MediaPost } from "./types";
import { getEra } from "./eraFilter";
import { extractTriggers, resetTriggerCounter } from "./eventBridge";
import { processTriggers, resetPostCounter } from "./infowarEngine";
import { ollamaService } from "./ollamaService";

const HEALTH_CHECK_INTERVAL_MS = 30_000;

export function useInfoWar(
  gameState: GameState,
  combatState: CombatState | undefined,
  eventState: EventState | undefined,
  config?: InfoWarConfig
) {
  const [infoWarState, setInfoWarState] = useState<InfoWarState>(() => ({
    enabled: config?.enabled !== false,
    ollamaConnected: false,
    posts: [],
    pendingTriggers: [],
    generatingCount: 0,
    era: getEra(gameState.simTime),
    personas: [],
    model: config?.model ?? "mistral",
  }));

  // Track previous state lengths for diffing
  const prevCombatLogLenRef = useRef(0);
  const prevMessageCountRef = useRef(0);

  // Health check on mount + periodic
  useEffect(() => {
    if (!infoWarState.enabled) return;

    const check = () => {
      ollamaService.checkConnection(infoWarState.model).then((hasModel) => {
        setInfoWarState((prev) => ({
          ...prev,
          ollamaConnected: ollamaService.connected,
        }));
      });
    };

    check();
    const interval = setInterval(check, HEALTH_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [infoWarState.enabled, infoWarState.model]);

  // Update era when simTime changes significantly
  useEffect(() => {
    const era = getEra(gameState.simTime);
    setInfoWarState((prev) =>
      prev.era !== era ? { ...prev, era } : prev
    );
  }, [gameState.simTime]);

  // Post callback — adds a generated post to state
  const handleNewPost = useCallback((post: MediaPost) => {
    setInfoWarState((prev) => ({
      ...prev,
      posts: [post, ...prev.posts].slice(0, 200), // Keep last 200
      generatingCount: Math.max(0, prev.generatingCount - 1),
    }));
  }, []);

  // Main trigger extraction + dispatch
  useEffect(() => {
    if (!infoWarState.enabled || !infoWarState.ollamaConnected) return;
    if (gameState.isPaused) return;

    const combatLog = combatState?.combatLog ?? [];
    const messages = eventState?.messages ?? [];

    const triggers = extractTriggers(
      combatLog,
      prevCombatLogLenRef.current,
      messages,
      prevMessageCountRef.current
    );

    // Update refs after extraction
    prevCombatLogLenRef.current = combatLog.length;
    prevMessageCountRef.current = messages.length;

    if (triggers.length === 0) return;

    const dispatched = processTriggers(
      triggers,
      infoWarState.era,
      config,
      handleNewPost
    );

    if (dispatched > 0) {
      setInfoWarState((prev) => ({
        ...prev,
        generatingCount: prev.generatingCount + dispatched,
      }));
    }
  }, [
    combatState?.combatLog.length,
    eventState?.messages.length,
    infoWarState.enabled,
    infoWarState.ollamaConnected,
    infoWarState.era,
    gameState.isPaused,
    config,
    handleNewPost,
  ]);

  const toggleEnabled = useCallback(() => {
    setInfoWarState((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const markPostRead = useCallback((postId: string) => {
    setInfoWarState((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        p.id === postId ? { ...p, read: true } : p
      ),
    }));
  }, []);

  const resetInfoWar = useCallback(() => {
    resetTriggerCounter();
    resetPostCounter();
    prevCombatLogLenRef.current = 0;
    prevMessageCountRef.current = 0;
    setInfoWarState((prev) => ({
      ...prev,
      posts: [],
      pendingTriggers: [],
      generatingCount: 0,
    }));
  }, []);

  return {
    infoWarState,
    toggleEnabled,
    markPostRead,
    resetInfoWar,
  };
}
