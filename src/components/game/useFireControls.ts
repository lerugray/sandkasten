"use client";

import { useCallback, useMemo, useState } from "react";
import type { Unit } from "@/types/game";
import type { Contact, GameState } from "@/lib/simulation/gameState";
import type { Doctrine } from "@/lib/ai/doctrine";
import { resolveUnitDoctrine } from "@/lib/ai/effectiveDoctrine";
import { getPlatform } from "@/lib/platforms/lookup";
import type { ScenarioConfig } from "@/lib/simulation/session";
import type { FireControls } from "./OrderPanel";

const ROE_CYCLE: Doctrine["roe"][] = ["weapons-hold", "weapons-tight", "weapons-free"];
const RANK: Record<Contact["classification"], number> = { unknown: 0, detected: 1, classified: 2, tracked: 3 };

interface Args {
  unit: Unit | null | undefined;
  gameState: GameState;
  config: Pick<ScenarioConfig, "missions" | "sideDoctrine">;
  orderFeedback: FireControls["feedback"];
  setRoe: (unitId: string, roe: Doctrine["roe"]) => void;
  engage: (shooterId: string, contactId: string, weaponName?: string) => unknown;
  contactLabel: (contact: Contact) => string;
}

/** Builds the order panel's fire controls and the keys that drive them. */
export function useFireControls({ unit, gameState, config, orderFeedback, setRoe, engage, contactLabel }: Args) {
  const [targetContactId, setTargetContactId] = useState<string | null>(null);

  const contacts = useMemo(
    () => gameState.contacts.filter((c) => RANK[c.classification] >= RANK.detected),
    [gameState.contacts]
  );
  const roe = unit
    ? resolveUnitDoctrine(unit, gameState, { missions: config.missions ?? [], sideDoctrine: config.sideDoctrine ?? {} }).roe
    : "weapons-tight";
  const weaponNames = useMemo(
    () => (unit ? (getPlatform(unit.platformId)?.weapons ?? []).map((w) => w.name) : []),
    [unit]
  );

  const unitId = unit?.id;
  const engageTarget = useCallback(() => {
    if (unitId && targetContactId) engage(unitId, targetContactId);
  }, [unitId, targetContactId, engage]);

  const cycleTarget = useCallback(() => {
    if (contacts.length === 0) return;
    const i = contacts.findIndex((c) => c.id === targetContactId);
    setTargetContactId(contacts[(i + 1) % contacts.length].id);
  }, [contacts, targetContactId]);

  const setRoeFor = useCallback(
    (value: Doctrine["roe"]) => {
      if (unitId) setRoe(unitId, value);
    },
    [unitId, setRoe]
  );

  const fire: FireControls | undefined = unit
    ? {
        roe,
        onSetRoe: setRoeFor,
        contacts,
        contactLabel,
        weaponNames,
        targetContactId,
        onTargetChange: setTargetContactId,
        onEngage: (contactId, weaponName) => engage(unit.id, contactId, weaponName),
        feedback: orderFeedback,
      }
    : undefined;

  const clearTarget = useCallback(() => setTargetContactId(null), []);

  return { fire, engageTarget, cycleTarget, setRoeFor, clearTarget, roeOptions: ROE_CYCLE };
}
