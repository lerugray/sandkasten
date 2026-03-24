/**
 * Demo scenario configuration — wires up the scenario with missions,
 * doctrine, and TCA events for a playable Strait of Hormuz encounter.
 */

import type { ScenarioConfig } from "@/lib/simulation/useSimulation";
import type { Mission } from "@/lib/ai/missions";
import type { Doctrine } from "@/lib/ai/doctrine";
import type { EventState, ScenarioEvent } from "@/lib/ai/events";
import { demoScenario } from "./demo";

// --- Missions for Iran (AI side) ---

const iranMissions: Mission[] = [
  {
    id: "iran-coastal-patrol",
    name: "Coastal Patrol",
    side: "Iran",
    type: "patrol",
    assignedUnitIds: ["ir-fac-1", "ir-fac-2", "ir-fac-3"],
    referencePoints: [
      { lng: 56.3, lat: 27.0 },
      { lng: 56.5, lat: 26.6 },
      { lng: 56.2, lat: 26.2 },
      { lng: 55.8, lat: 26.5 },
    ],
    prosecutionRange: 130, // km — C-802 range is 120km, give slight buffer
    repeating: true,
    doctrineOverrides: {
      roe: "weapons-free",
      radarUsage: "active",
    },
  },
  {
    id: "iran-missile-boat-patrol",
    name: "Missile Boat Patrol",
    side: "Iran",
    type: "patrol",
    assignedUnitIds: ["ir-pc-1", "ir-pc-2"],
    referencePoints: [
      { lng: 55.8, lat: 26.6 },
      { lng: 56.4, lat: 26.3 },
      { lng: 56.0, lat: 26.0 },
    ],
    prosecutionRange: 130,
    repeating: true,
  },
  {
    id: "iran-coastal-defense",
    name: "Coastal Defense",
    side: "Iran",
    type: "escort",
    assignedUnitIds: ["ir-ff-1"],
    escortTargetId: "ir-fac-1", // Stay near the FAC group lead
    referencePoints: [],
    prosecutionRange: 30,
    repeating: true,
  },
  {
    id: "iran-cap",
    name: "CAP Station Alpha",
    side: "Iran",
    type: "cap",
    assignedUnitIds: ["ir-f4-1", "ir-f14-1"],
    referencePoints: [
      { lng: 55.5, lat: 27.2 },
      { lng: 56.0, lat: 27.0 },
    ],
    prosecutionRange: 80, // km — intercept range for fighters
    repeating: true,
    doctrineOverrides: {
      roe: "weapons-free",
      radarUsage: "active",
    },
  },
];

// --- Side doctrine ---

const sideDoctrine: Record<string, Partial<Doctrine>> = {
  Iran: {
    roe: "weapons-free",
    engagementRange: "max",
    radarUsage: "active",
    evasion: "if-attacked",
    withdrawOnDamage: "damaged",
  },
};

// --- Scenario events ---

const scenarioStartTime = new Date("2026-03-15T06:00:00Z").getTime();

const scenarioEvents: ScenarioEvent[] = [
  {
    name: "Scenario Briefing",
    repeatable: false,
    triggers: [{ type: "ScenarioLoaded" }],
    conditions: [],
    actions: [
      {
        type: "DisplayMessage",
        side: "US Navy",
        title: "OPERATION SENTINEL PASSAGE",
        text: "Your carrier strike group must transit the Strait of Hormuz and reach the Persian Gulf. Iranian naval forces are patrolling the strait. Rules of engagement: weapons tight — engage only if fired upon. Intelligence indicates Iranian fast attack craft armed with C-802 anti-ship missiles in the area.",
      },
    ],
  },
  {
    name: "First Contact Alert",
    repeatable: false,
    triggers: [{ type: "UnitDetected", side: "Iran", detectedBySide: "US Navy" }],
    conditions: [],
    actions: [
      {
        type: "DisplayMessage",
        side: "US Navy",
        title: "CONTACT REPORT",
        text: "Radar contact detected. Possible Iranian naval vessel. Maintain course and speed. Continue to monitor.",
      },
      { type: "ChangeScore", side: "US Navy", amount: 10 },
    ],
  },
  {
    name: "Iranian Escalation",
    repeatable: false,
    triggers: [
      { type: "UnitDetected", side: "US Navy", detectedBySide: "Iran" },
    ],
    conditions: [],
    actions: [
      {
        type: "DisplayMessage",
        side: "US Navy",
        title: "INTELLIGENCE UPDATE",
        text: "SIGINT intercepts indicate Iranian naval command has ordered patrol boats to increase readiness. IRGCN units are going weapons-free.",
      },
      {
        type: "ChangeDoctrine",
        side: "Iran",
        changes: { roe: "weapons-free", radarUsage: "active" },
      },
    ],
  },
  {
    name: "Reinforcement Boghammar",
    repeatable: false,
    triggers: [
      { type: "Time", time: scenarioStartTime + 45 * 60 * 1000 }, // T+45 minutes
    ],
    conditions: [
      { type: "RandomChance", probability: 0.6 },
    ],
    actions: [
      {
        type: "DisplayMessage",
        side: "US Navy",
        title: "NEW CONTACTS",
        text: "Multiple fast-moving surface contacts detected departing Bandar Abbas. Assess as IRGCN Boghammar-class fast attack craft.",
      },
      {
        type: "SpawnUnit",
        side: "Iran",
        units: [
          {
            id: "ir-bog-1",
            name: "Boghammar 501",
            platformId: 2106,
            position: { lng: 56.27, lat: 27.18 },
            heading: 200,
            speed: 30,
            mission: "Coastal Patrol",
          },
          {
            id: "ir-bog-2",
            name: "Boghammar 502",
            platformId: 2106,
            position: { lng: 56.30, lat: 27.15 },
            heading: 210,
            speed: 30,
            mission: "Coastal Patrol",
          },
        ],
      },
    ],
  },
  {
    name: "Transit Complete",
    repeatable: false,
    triggers: [
      { type: "Time", time: scenarioStartTime + 120 * 60 * 1000 }, // T+2 hours
    ],
    conditions: [],
    actions: [
      {
        type: "EndScenario",
        result: "victory",
        message: "Your carrier strike group has successfully transited the Strait of Hormuz. Well done, Admiral.",
      },
    ],
  },
  {
    name: "Carrier Lost",
    repeatable: false,
    triggers: [{ type: "UnitDestroyed", unitId: "us-cvn-1" }],
    conditions: [],
    actions: [
      {
        type: "EndScenario",
        result: "defeat",
        message: "USS Nimitz has been lost. This is a catastrophic failure.",
      },
    ],
  },
];

// --- Combined config ---

export const demoScenarioConfig: ScenarioConfig = {
  scenario: demoScenario,
  missions: iranMissions,
  sideDoctrine,
  events: {
    events: scenarioEvents,
    firedEvents: new Set(),
    messages: [],
  },
  infowar: {
    enabled: true,
    model: "mistral",
  },
};
