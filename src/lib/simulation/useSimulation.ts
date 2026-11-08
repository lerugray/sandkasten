"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Doctrine } from "@/lib/ai/doctrine";
import { SimulationSession, type ScenarioConfig, type SessionSnapshot } from "./session";
import { type AutopausePreferences, loadAutopausePrefs, saveAutopausePrefs } from "./autopause";

export type { ScenarioConfig } from "./session";

const TICK_INTERVAL_MS = 50; // 20 fps simulation
const PUBLISH_INTERVAL_MS = 250; // React renders at ~4 fps to avoid UI jitter

/**
 * React binding for a SimulationSession. The session owns the game; this hook ticks it,
 * forwards commands to it, and publishes snapshots for rendering.
 */
export function useSimulation(config: ScenarioConfig) {
  const sessionRef = useRef<SimulationSession | null>(null);
  if (!sessionRef.current) sessionRef.current = new SimulationSession(config);
  const session = sessionRef.current;

  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() => session.snapshot());
  const publish = useCallback(() => setSnapshot(session.snapshot()), [session]);

  const autopausePrefsRef = useRef<AutopausePreferences>(session.autopausePrefs);

  useEffect(() => {
    session.autopausePrefs = loadAutopausePrefs();
    autopausePrefsRef.current = session.autopausePrefs;
  }, [session]);

  useEffect(() => {
    session.updateConfig(config);
  }, [session, config]);

  useEffect(() => {
    let last = Date.now();
    let lastPublish = last;
    const timer = setInterval(() => {
      const now = Date.now();
      const dtMs = now - last;
      last = now;
      const publishNow = session.tick(dtMs);
      if (publishNow || now - lastPublish >= PUBLISH_INTERVAL_MS) {
        lastPublish = now;
        publish();
      }
    }, TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [session, publish]);

  // Every command acts on the session at once, then shows the result
  const command = useCallback(
    <A extends unknown[], R = void>(fn: (...args: A) => R) =>
      (...args: A): R => {
        const out = fn(...args);
        publish();
        return out;
      },
    [publish]
  );

  const pause = useCallback(() => command(() => session.pause())(), [command, session]);
  const togglePause = useCallback(() => command(() => session.togglePause())(), [command, session]);
  const setSpeed = useCallback((speed: number) => command(() => session.setSpeed(speed))(), [command, session]);
  const cycleSpeed = useCallback(() => command(() => session.cycleSpeed())(), [command, session]);
  const addWaypoint = useCallback(
    (unitId: string, position: { lng: number; lat: number }, speed?: number) =>
      command(() => session.addWaypoint(unitId, position, speed))(),
    [command, session]
  );
  const clearWaypoints = useCallback((unitId: string) => command(() => session.clearWaypoints(unitId))(), [command, session]);
  const setThrottle = useCallback((unitId: string, throttle: number) => command(() => session.setThrottle(unitId, throttle))(), [command, session]);
  const toggleRadar = useCallback((unitId: string) => command(() => session.toggleRadar(unitId))(), [command, session]);
  const setRoe = useCallback((unitId: string, roe: Doctrine["roe"]) => command(() => session.setRoe(unitId, roe))(), [command, session]);
  const engage = useCallback(
    (shooterId: string, contactId: string, weaponName?: string) => command(() => session.engage(shooterId, contactId, weaponName))(),
    [command, session]
  );
  const markMessageRead = useCallback((messageId: string) => command(() => session.markMessageRead(messageId))(), [command, session]);
  const resetSimulation = useCallback(() => command(() => session.reset())(), [command, session]);

  const setAutopausePrefs = useCallback(
    (prefs: AutopausePreferences) => {
      autopausePrefsRef.current = prefs;
      session.autopausePrefs = prefs;
      saveAutopausePrefs(prefs);
    },
    [session]
  );

  return {
    gameState: snapshot.gameState,
    eventState: snapshot.eventState,
    combatState: snapshot.combatState,
    autopauseEvent: snapshot.autopauseEvent,
    orderFeedback: snapshot.orderFeedback,
    autopausePrefsRef,
    pause,
    togglePause,
    setSpeed,
    cycleSpeed,
    addWaypoint,
    clearWaypoints,
    setThrottle,
    toggleRadar,
    setRoe,
    engage,
    markMessageRead,
    resetSimulation,
    setAutopausePrefs,
  };
}
