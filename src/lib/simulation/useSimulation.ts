"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Scenario } from "@/types/game";
import { createInitialGameState, SPEED_OPTIONS, type GameState } from "./gameState";
import { simulationTick, resetDetectionTimer } from "./engine";
import { type AIState, resetAITimer } from "@/lib/ai/aiController";
import type { EventState, EventMessage } from "@/lib/ai/events";
import type { Mission } from "@/lib/ai/missions";
import type { Doctrine } from "@/lib/ai/doctrine";
import { createCombatState, resetCombatTimer, type CombatState } from "./combat";
import type { InfoWarConfig } from "@/lib/infowar/types";
import {
  type AutopausePreferences,
  type AutopauseResult,
  DEFAULT_AUTOPAUSE,
  loadAutopausePrefs,
  saveAutopausePrefs,
  checkAutopauseTriggers,
  buildFriendlyDamageMap,
} from "./autopause";

const TICK_INTERVAL_MS = 50; // 20 fps simulation

export interface ScenarioConfig {
  scenario: Scenario;
  missions?: Mission[];
  sideDoctrine?: Record<string, Partial<Doctrine>>;
  events?: EventState;
  infowar?: InfoWarConfig;
}

export function useSimulation(config: ScenarioConfig) {
  const { scenario, missions = [], sideDoctrine = {}, events } = config;

  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(scenario)
  );

  const [eventState, setEventState] = useState<EventState | undefined>(events);
  const [combatState, setCombatState] = useState<CombatState>(() => createCombatState());

  const [autopauseEvent, setAutopauseEvent] = useState<AutopauseResult | null>(null);
  const autopausePrefsRef = useRef<AutopausePreferences>(DEFAULT_AUTOPAUSE);
  const seenTriggersRef = useRef<Set<string>>(new Set());

  // Load autopause prefs from localStorage on mount
  useEffect(() => {
    autopausePrefsRef.current = loadAutopausePrefs();
  }, []);

  const aiStateRef = useRef<AIState>({
    missions,
    sideDoctrine,
  });

  // Keep AI state in sync with config changes
  useEffect(() => {
    aiStateRef.current = { missions, sideDoctrine };
  }, [missions, sideDoctrine]);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const eventStateRef = useRef(eventState);
  eventStateRef.current = eventState;

  const combatStateRef = useRef(combatState);
  combatStateRef.current = combatState;

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const lastRenderRef = useRef<number>(Date.now());

  // Main simulation loop
  // Sim ticks at 50ms but React only re-renders at ~4fps (250ms) to avoid jitter
  useEffect(() => {
    tickRef.current = setInterval(() => {
      const now = Date.now();
      const dtMs = now - lastTickRef.current;
      lastTickRef.current = now;

      if (!gameStateRef.current.isPaused) {
        const prevContacts = gameStateRef.current.contacts;
        const prevMsgCount = eventStateRef.current?.messages?.length ?? 0;
        const prevDamage = buildFriendlyDamageMap(
          gameStateRef.current,
          gameStateRef.current.scenario.playerSide
        );
        const prevCombat = combatStateRef.current;

        const result = simulationTick(
          gameStateRef.current,
          dtMs,
          aiStateRef.current,
          eventStateRef.current,
          combatStateRef.current
        );

        // Always update refs (sim state is authoritative)
        gameStateRef.current = result.gameState;
        if (result.eventState) {
          eventStateRef.current = result.eventState;
        }
        if (result.combatState) {
          combatStateRef.current = result.combatState;
        }

        // Check autopause triggers
        const nextMsgCount = result.eventState?.messages?.length ?? prevMsgCount;
        const nextDamage = buildFriendlyDamageMap(
          result.gameState,
          result.gameState.scenario.playerSide
        );
        const trigger = checkAutopauseTriggers(
          autopausePrefsRef.current,
          prevContacts,
          result.gameState.contacts,
          prevCombat,
          result.combatState,
          prevMsgCount,
          nextMsgCount,
          prevDamage,
          nextDamage,
          result.gameState.scenario.playerSide,
          seenTriggersRef.current
        );

        if (trigger) {
          // Force pause and immediate render
          gameStateRef.current = { ...result.gameState, isPaused: true };
          lastRenderRef.current = now;
          setGameState(gameStateRef.current);
          if (result.eventState) setEventState(result.eventState);
          if (result.combatState) setCombatState(result.combatState);
          setAutopauseEvent(trigger);
          return; // skip normal throttled render
        }

        // Throttle React re-renders to avoid UI jitter
        const timeSinceRender = now - lastRenderRef.current;
        if (timeSinceRender >= 250) {
          lastRenderRef.current = now;
          setGameState(result.gameState);
          if (result.eventState) {
            setEventState(result.eventState);
          }
          if (result.combatState) {
            setCombatState(result.combatState);
          }
        }
      }
    }, TICK_INTERVAL_MS);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const togglePause = useCallback(() => {
    setGameState((prev) => {
      lastTickRef.current = Date.now();
      if (prev.isPaused) {
        // Resuming — clear seen triggers so autopause can fire again
        seenTriggersRef.current.clear();
        setAutopauseEvent(null);
      }
      return { ...prev, isPaused: !prev.isPaused };
    });
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setGameState((prev) => ({ ...prev, speed }));
  }, []);

  const cycleSpeed = useCallback(() => {
    setGameState((prev) => {
      const currentIdx = SPEED_OPTIONS.indexOf(prev.speed as typeof SPEED_OPTIONS[number]);
      const nextIdx = (currentIdx + 1) % SPEED_OPTIONS.length;
      return { ...prev, speed: SPEED_OPTIONS[nextIdx] };
    });
  }, []);

  const addWaypoint = useCallback(
    (unitId: string, position: { lng: number; lat: number }, speed?: number) => {
      setGameState((prev) => {
        const orders = prev.orders.get(unitId);
        if (!orders) return prev;

        const newOrders = new Map(prev.orders);
        newOrders.set(unitId, {
          ...orders,
          waypoints: [
            ...orders.waypoints,
            { position, speed },
          ],
        });

        return { ...prev, orders: newOrders };
      });
    },
    []
  );

  const clearWaypoints = useCallback((unitId: string) => {
    setGameState((prev) => {
      const orders = prev.orders.get(unitId);
      if (!orders) return prev;

      const newOrders = new Map(prev.orders);
      newOrders.set(unitId, { ...orders, waypoints: [] });
      return { ...prev, orders: newOrders };
    });
  }, []);

  const setThrottle = useCallback((unitId: string, throttle: number) => {
    setGameState((prev) => {
      const orders = prev.orders.get(unitId);
      if (!orders) return prev;

      const newOrders = new Map(prev.orders);
      newOrders.set(unitId, { ...orders, throttle });
      return { ...prev, orders: newOrders };
    });
  }, []);

  const toggleRadar = useCallback((unitId: string) => {
    setGameState((prev) => {
      const orders = prev.orders.get(unitId);
      if (!orders) return prev;

      const newOrders = new Map(prev.orders);
      newOrders.set(unitId, { ...orders, radarActive: !orders.radarActive });
      return { ...prev, orders: newOrders };
    });
  }, []);

  const markMessageRead = useCallback((messageId: string) => {
    setEventState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === messageId ? { ...m, read: true } : m
        ),
      };
    });
  }, []);

  const setAutopausePrefs = useCallback((prefs: AutopausePreferences) => {
    autopausePrefsRef.current = prefs;
    saveAutopausePrefs(prefs);
  }, []);

  const resetSimulation = useCallback(() => {
    resetDetectionTimer();
    resetAITimer();
    resetCombatTimer();
    seenTriggersRef.current.clear();
    setAutopauseEvent(null);
    setGameState(createInitialGameState(scenario));
    setEventState(events);
    setCombatState(createCombatState());
  }, [scenario, events]);

  return {
    gameState,
    eventState,
    combatState,
    autopauseEvent,
    autopausePrefsRef,
    togglePause,
    setSpeed,
    cycleSpeed,
    addWaypoint,
    clearWaypoints,
    setThrottle,
    toggleRadar,
    markMessageRead,
    resetSimulation,
    setAutopausePrefs,
  };
}
