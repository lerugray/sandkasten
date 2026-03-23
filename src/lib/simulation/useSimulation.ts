"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Scenario } from "@/types/game";
import { createInitialGameState, SPEED_OPTIONS, type GameState } from "./gameState";
import { simulationTick, resetDetectionTimer } from "./engine";

const TICK_INTERVAL_MS = 50; // 20 fps simulation

export function useSimulation(scenario: Scenario) {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(scenario)
  );

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // Main simulation loop
  useEffect(() => {
    tickRef.current = setInterval(() => {
      const now = Date.now();
      const dtMs = now - lastTickRef.current;
      lastTickRef.current = now;

      if (!gameStateRef.current.isPaused) {
        setGameState((prev) => simulationTick(prev, dtMs));
      }
    }, TICK_INTERVAL_MS);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const togglePause = useCallback(() => {
    setGameState((prev) => {
      lastTickRef.current = Date.now(); // prevent time jump
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

  const resetSimulation = useCallback(() => {
    resetDetectionTimer();
    setGameState(createInitialGameState(scenario));
  }, [scenario]);

  return {
    gameState,
    togglePause,
    setSpeed,
    cycleSpeed,
    addWaypoint,
    clearWaypoints,
    setThrottle,
    toggleRadar,
    resetSimulation,
  };
}
