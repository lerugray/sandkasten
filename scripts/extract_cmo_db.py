"""
CMO Database Extraction Script for Sandkasten
Extracts platform data from Command: Modern Operations DB3K SQLite database.
See DB_EXTRACTION_SPEC.md for full field mappings and schema notes.
"""

import sqlite3
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# --- Configuration ---

DB_PATH = r"C:\Program Files (x86)\Steam\steamapps\common\Command - Modern Operations\DB\DB3K_512.db3"
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "extraction"
RAW_DIR = Path(__file__).parent.parent / "data" / "raw"

# --- Helpers ---

def connect(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def metadata(db_path, table_name, count):
    return {
        "source": os.path.basename(db_path),
        "extractedAt": datetime.utcnow().isoformat() + "Z",
        "table": table_name,
        "count": count,
    }

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  -> {path} ({len(data.get('records', data.get('entries', [])))} records)")


# --- Enum Extraction ---

ENUM_TABLES = [
    "EnumOperatorCountry", "EnumOperatorService",
    "EnumShipCategory", "EnumShipType", "EnumShipPhysicalSize",
    "EnumShipCSGen", "EnumShipCode",
    "EnumAircraftCategory", "EnumAircraftType", "EnumAircraftPhysicalSize",
    "EnumAircraftCockpitGen", "EnumAircraftCockpitVisibility",
    "EnumWeaponType", "EnumWeaponTarget", "EnumWeaponGeneration",
    "EnumWeaponWRA", "EnumWeaponWRAWeaponQty", "EnumWeaponWRAShooterQty",
    "EnumWeaponWRAAutoFireRange", "EnumWeaponWRASelfDefenceRange",
    "EnumSensorType", "EnumSensorRole", "EnumSensorGeneration",
    "EnumSensorCapability", "EnumSensorCode",
    "EnumLoadoutRole", "EnumLoadoutMissionProfile",
    "EnumPropulsionType", "EnumPropulsionCombinedType",
    "EnumFuelType", "EnumWarheadType", "EnumWarheadExplosivesType",
    "EnumArmorType", "EnumErgonomics",
    "EnumSubmarineCategory", "EnumSubmarineType",
    "EnumFacilityCategory", "EnumFacilityType",
    "EnumGroundUnitCategory",
    "EnumAircraftFacilityType", "EnumDockingFacilityType",
    "EnumCommType", "EnumRunwayLength",
]

def extract_enums(conn):
    print("\n=== Extracting Enums ===")
    enum_dir = OUTPUT_DIR / "enums"
    for table in ENUM_TABLES:
        try:
            cursor = conn.execute(f"SELECT * FROM {table}")
            cols = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            entries = {}
            for row in rows:
                row_dict = dict(zip(cols, row))
                key = str(row_dict[cols[0]])
                if len(cols) == 2:
                    entries[key] = row_dict[cols[1]]
                else:
                    entries[key] = {c: row_dict[c] for c in cols[1:]}
            filename = table.replace("Enum", "").lower() + ".json"
            # Convert to camelCase-ish filename
            parts = []
            for i, ch in enumerate(filename):
                if ch.isupper() and i > 0:
                    parts.append("-")
                parts.append(ch.lower())
            filename = "".join(parts)
            write_json(enum_dir / filename, {
                "_meta": metadata(DB_PATH, table, len(entries)),
                "entries": entries,
            })
        except Exception as e:
            print(f"  WARN: Could not extract {table}: {e}")


# --- Enum Lookup Cache ---

class EnumLookup:
    """Cache enum lookups so we resolve IDs to strings once."""
    def __init__(self, conn):
        self._conn = conn
        self._cache = {}

    def get(self, table, id_val, col_index=1):
        if table not in self._cache:
            try:
                cursor = self._conn.execute(f"SELECT * FROM {table}")
                cols = [desc[0] for desc in cursor.description]
                self._cache[table] = {}
                for row in cursor.fetchall():
                    self._cache[table][row[0]] = row[col_index] if col_index < len(row) else row[1]
            except Exception:
                self._cache[table] = {}
        return self._cache.get(table, {}).get(id_val, id_val)


# --- Component Extractors ---

def get_propulsion(conn, platform_table_prefix, platform_id):
    """Get propulsion + speed profiles for a platform."""
    junction_table = f"Data{platform_table_prefix}Propulsion"
    try:
        rows = conn.execute(
            f"SELECT ComponentID FROM {junction_table} WHERE ID = ?",
            (platform_id,)
        ).fetchall()
    except Exception:
        return []

    results = []
    for row in rows:
        prop_id = row[0]
        prop = conn.execute("SELECT * FROM DataPropulsion WHERE ID = ?", (prop_id,)).fetchone()
        if not prop:
            continue
        prop = dict(prop)

        # Speed profile
        perf_rows = conn.execute(
            "SELECT * FROM DataPropulsionPerformance WHERE ID = ? ORDER BY AltitudeBand, Throttle",
            (prop_id,)
        ).fetchall()
        speed_profile = []
        for p in perf_rows:
            speed_profile.append({
                "altitudeBand": p["AltitudeBand"],
                "throttle": p["Throttle"],
                "speed": p["Speed"],
                "altitudeMin": p["AltitudeMin"],
                "altitudeMax": p["AltitudeMax"],
                "consumption": p["Consumption"],
            })

        results.append({
            "id": prop["ID"],
            "name": prop["Name"],
            "typeId": prop["Type"],
            "numberOfEngines": prop["NumberOfEngines"],
            "numberOfShafts": prop["NumberOfShafts"],
            "combinedTypeId": prop["CombinedType"],
            "thrustMilitary": prop["ThrustPerEngineMilitary"],
            "thrustAfterburner": prop["ThrustPerEngineAfterburner"],
            "sfcMilitary": prop["SFCMilitary"],
            "sfcAfterburner": prop["SFCAfterburner"],
            "speedProfile": speed_profile,
        })
    return results


def get_fuel(conn, platform_table_prefix, platform_id):
    junction_table = f"Data{platform_table_prefix}Fuel"
    try:
        rows = conn.execute(
            f"""SELECT f.ID, f.Type, f.Capacity
                FROM {junction_table} jt JOIN DataFuel f ON jt.ComponentID = f.ID
                WHERE jt.ID = ?""",
            (platform_id,)
        ).fetchall()
    except Exception:
        return []
    return [{"typeId": r["Type"], "capacity": r["Capacity"]} for r in rows]


def get_sensor_ids(conn, platform_table_prefix, platform_id):
    junction_table = f"Data{platform_table_prefix}Sensors"
    try:
        rows = conn.execute(
            f"SELECT ComponentID FROM {junction_table} WHERE ID = ?",
            (platform_id,)
        ).fetchall()
    except Exception:
        return []
    return [r[0] for r in rows]


def get_mount_ids(conn, platform_table_prefix, platform_id):
    junction_table = f"Data{platform_table_prefix}Mounts"
    try:
        rows = conn.execute(
            f"SELECT ComponentID FROM {junction_table} WHERE ID = ?",
            (platform_id,)
        ).fetchall()
    except Exception:
        return []
    return [r[0] for r in rows]


def get_signatures(conn, platform_table_prefix, platform_id):
    sig_table = f"Data{platform_table_prefix}Signatures"
    try:
        cursor = conn.execute(f"PRAGMA table_info({sig_table})")
        cols = [c[1] for c in cursor.fetchall()]
        has_top = "Top" in cols

        rows = conn.execute(f"SELECT * FROM {sig_table} WHERE ID = ?", (platform_id,)).fetchall()
    except Exception:
        return []

    results = []
    for r in rows:
        sig = {
            "typeId": r["Type"],
            "front": r["Front"],
            "side": r["Side"],
            "rear": r["Rear"],
        }
        if has_top:
            sig["top"] = r["Top"]
        results.append(sig)
    return results


def get_loadout_ids(conn, aircraft_id):
    try:
        rows = conn.execute(
            "SELECT ComponentID FROM DataAircraftLoadouts WHERE ID = ?",
            (aircraft_id,)
        ).fetchall()
    except Exception:
        return []
    return [r[0] for r in rows]


# --- Platform Extractors ---

def extract_ships(conn):
    print("\n=== Extracting Ships ===")
    rows = conn.execute(
        "SELECT * FROM DataShip WHERE Deprecated = 0 AND Hypothetical = 0"
    ).fetchall()

    ships = []
    for i, row in enumerate(rows):
        row = dict(row)
        ship = {
            "id": row["ID"],
            "name": row["Name"],
            "categoryId": row["Category"],
            "typeId": row["Type"],
            "countryId": row["OperatorCountry"],
            "serviceId": row["OperatorService"],
            "yearCommissioned": row["YearCommissioned"],
            "yearDecommissioned": row["YearDecommissioned"],
            "comments": row["Comments"],
            "length": row["Length"],
            "beam": row["Beam"],
            "draft": row["Draft"],
            "height": row["Height"],
            "displacementEmpty": row["DisplacementEmpty"],
            "displacementStandard": row["DisplacementStandard"],
            "displacementFull": row["DisplacementFull"],
            "crew": row["Crew"],
            "damagePoints": row["DamagePoints"],
            "missileDefense": row["MissileDefense"],
            "maxSeaState": row["MaxSeaState"],
            "armor": {
                "belt": row["ArmorBelt"],
                "bulkheads": row["ArmorBulkheads"],
                "deck": row["ArmorDeck"],
                "bridge": row["ArmorBridge"],
                "cic": row["ArmorCIC"],
                "engineering": row["ArmorEngineering"],
                "rudder": row["ArmorRudder"],
            },
            "ooda": {
                "detection": row["OODADetectionCycle"],
                "targeting": row["OODATargetingCycle"],
                "evasion": row["OODAEvasiveCycle"],
            },
            "ergonomicsId": row["Ergonomics"],
            "physicalSizeId": row["PhysicalSizeCode"],
            "csGenId": row["CSGen"],
            "propulsion": get_propulsion(conn, "Ship", row["ID"]),
            "fuel": get_fuel(conn, "Ship", row["ID"]),
            "sensorIds": get_sensor_ids(conn, "Ship", row["ID"]),
            "mountIds": get_mount_ids(conn, "Ship", row["ID"]),
            "signatures": get_signatures(conn, "Ship", row["ID"]),
        }
        ships.append(ship)
        if (i + 1) % 500 == 0:
            print(f"    Ships: {i + 1}/{len(rows)}")

    write_json(OUTPUT_DIR / "ships.json", {
        "_meta": metadata(DB_PATH, "DataShip", len(ships)),
        "records": ships,
    })


def extract_aircraft(conn):
    print("\n=== Extracting Aircraft ===")
    rows = conn.execute(
        "SELECT * FROM DataAircraft WHERE Deprecated = 0 AND Hypothetical = 0"
    ).fetchall()

    aircraft = []
    for i, row in enumerate(rows):
        row = dict(row)
        ac = {
            "id": row["ID"],
            "name": row["Name"],
            "categoryId": row["Category"],
            "typeId": row["Type"],
            "countryId": row["OperatorCountry"],
            "serviceId": row["OperatorService"],
            "yearCommissioned": row["YearCommissioned"],
            "yearDecommissioned": row["YearDecommissioned"],
            "comments": row["Comments"],
            "length": row["Length"],
            "span": row["Span"],
            "height": row["Height"],
            "weightEmpty": row["WeightEmpty"],
            "weightMax": row["WeightMax"],
            "weightPayload": row["WeightPayload"],
            "crew": row["Crew"],
            "agility": row["Agility"],
            "climbRate": row["ClimbRate"],
            "endurance": row["TotalEndurance"],
            "damagePoints": row["DamagePoints"],
            "cockpitGenId": row["CockpitGen"],
            "physicalSizeId": row["PhysicalSizeCode"],
            "runwayLengthId": row["RunwayLengthCode"],
            "autonomousControlLevel": row["AutonomousControlLevel"],
            "armor": {
                "engine": row["AircraftEngineArmor"],
                "fuselage": row["AircraftFuselageArmor"],
                "cockpit": row["AircraftCockpitArmor"],
            },
            "ooda": {
                "detection": row["OODADetectionCycle"],
                "targeting": row["OODATargetingCycle"],
                "evasion": row["OODAEvasiveCycle"],
            },
            "ergonomicsId": row["Ergonomics"],
            "propulsion": get_propulsion(conn, "Aircraft", row["ID"]),
            "fuel": get_fuel(conn, "Aircraft", row["ID"]),
            "sensorIds": get_sensor_ids(conn, "Aircraft", row["ID"]),
            "mountIds": get_mount_ids(conn, "Aircraft", row["ID"]),
            "loadoutIds": get_loadout_ids(conn, row["ID"]),
            "signatures": get_signatures(conn, "Aircraft", row["ID"]),
        }
        aircraft.append(ac)
        if (i + 1) % 500 == 0:
            print(f"    Aircraft: {i + 1}/{len(rows)}")

    write_json(OUTPUT_DIR / "aircraft.json", {
        "_meta": metadata(DB_PATH, "DataAircraft", len(aircraft)),
        "records": aircraft,
    })


def extract_weapons(conn):
    print("\n=== Extracting Weapons ===")
    rows = conn.execute(
        "SELECT * FROM DataWeapon WHERE Deprecated = 0 AND Hypothetical = 0"
    ).fetchall()

    weapons = []
    for i, row in enumerate(rows):
        row = dict(row)
        wid = row["ID"]

        # Warhead
        warhead = None
        wh_rows = conn.execute(
            """SELECT w.* FROM DataWeaponWarheads ww
               JOIN DataWarhead w ON ww.ComponentID = w.ID
               WHERE ww.ID = ?""",
            (wid,)
        ).fetchall()
        if wh_rows:
            wh = dict(wh_rows[0])
            warhead = {
                "id": wh["ID"],
                "name": wh["Name"],
                "typeId": wh["Type"],
                "damagePoints": wh["DamagePoints"],
                "explosivesTypeId": wh["ExplosivesType"],
                "explosivesWeight": wh["ExplosivesWeight"],
                "numberOfWarheads": wh["NumberOfWarheads"],
            }

        # Valid targets
        target_rows = conn.execute(
            "SELECT CodeID FROM DataWeaponTargets WHERE ID = ?", (wid,)
        ).fetchall()
        valid_target_ids = [r[0] for r in target_rows]

        # Seeker sensors
        seeker_rows = conn.execute(
            "SELECT ComponentID FROM DataWeaponSensors WHERE ID = ?", (wid,)
        ).fetchall()
        seeker_sensor_ids = [r[0] for r in seeker_rows]

        # WRA
        wra_rows = conn.execute(
            "SELECT CodeID, WeaponQty, ShooterQty, AutoFireRange, SelfDefenceRange FROM DataWeaponWRA WHERE ID = ?",
            (wid,)
        ).fetchall()
        wra = []
        for wr in wra_rows:
            wra.append({
                "targetTypeId": wr[0],
                "weaponQty": wr[1],
                "shooterQty": wr[2],
                "autoFireRange": wr[3],
                "selfDefenseRange": wr[4],
            })

        weapon = {
            "id": wid,
            "name": row["Name"],
            "typeId": row["Type"],
            "generationId": row["Generation"],
            "comments": row["Comments"],
            "length": row["Length"],
            "span": row["Span"],
            "diameter": row["Diameter"],
            "weight": row["Weight"],
            "cruiseAltitude": row["CruiseAltitude"],
            "maxFlightTime": row["MaxFlightTime"],
            "climbRate": row["ClimbRate"],
            "waypointNumber": row["WaypointNumber"],
            "cep": row["CEP"],
            "cepSurface": row["CEPSurface"],
            "pk": {
                "air": row["AirPoK"],
                "surface": row["SurfacePoK"],
                "land": row["LandPoK"],
                "subsurface": row["SubsurfacePoK"],
            },
            "range": {
                "air": {"min": row["AirRangeMin"], "max": row["AirRangeMax"]},
                "surface": {"min": row["SurfaceRangeMin"], "max": row["SurfaceRangeMax"]},
                "land": {"min": row["LandRangeMin"], "max": row["LandRangeMax"]},
                "subsurface": {"min": row["SubsurfaceRangeMin"], "max": row["SubsurfaceRangeMax"]},
            },
            "launch": {
                "speedMin": row["LaunchSpeedMin"],
                "speedMax": row["LaunchSpeedMax"],
                "altitudeMin": row["LaunchAltitudeMin"],
                "altitudeMax": row["LaunchAltitudeMax"],
            },
            "target": {
                "speedMin": row["TargetSpeedMin"],
                "speedMax": row["TargetSpeedMax"],
                "altitudeMin": row["TargetAltitudeMin"],
                "altitudeMax": row["TargetAltitudeMax"],
            },
            "torpedo": {
                "speedCruise": row["TorpedoSpeedCruise"],
                "rangeCruise": row["TorpedoRangeCruise"],
                "speedFull": row["TorpedoSpeedFull"],
                "rangeFull": row["TorpedoRangeFull"],
            },
            "warhead": warhead,
            "validTargetIds": valid_target_ids,
            "seekerSensorIds": seeker_sensor_ids,
            "wra": wra,
            "propulsion": get_propulsion(conn, "Weapon", wid),
            "signatures": get_signatures(conn, "Weapon", wid),
        }
        weapons.append(weapon)
        if (i + 1) % 500 == 0:
            print(f"    Weapons: {i + 1}/{len(rows)}")

    write_json(OUTPUT_DIR / "weapons.json", {
        "_meta": metadata(DB_PATH, "DataWeapon", len(weapons)),
        "records": weapons,
    })


def extract_sensors(conn):
    print("\n=== Extracting Sensors ===")
    rows = conn.execute(
        "SELECT * FROM DataSensor WHERE Deprecated = 0 AND Hypothetical = 0"
    ).fetchall()

    sensors = []
    for i, row in enumerate(rows):
        row = dict(row)
        sid = row["ID"]

        # Capabilities
        cap_rows = conn.execute(
            "SELECT CodeID FROM DataSensorCapabilities WHERE ID = ?", (sid,)
        ).fetchall()
        capability_ids = [r[0] for r in cap_rows]

        # Frequencies
        freq_st = conn.execute(
            "SELECT Frequency FROM DataSensorFrequencySearchAndTrack WHERE ID = ?", (sid,)
        ).fetchall()
        freq_ill = conn.execute(
            "SELECT Frequency FROM DataSensorFrequencyIlluminate WHERE ID = ?", (sid,)
        ).fetchall()

        sensor = {
            "id": sid,
            "name": row["Name"],
            "typeId": row["Type"],
            "roleId": row["Role"],
            "generationId": row["Generation"],
            "comments": row["Comments"],
            "rangeMin": row["RangeMin"],
            "rangeMax": row["RangeMax"],
            "altitudeMin": row["AltitudeMin"],
            "altitudeMax": row["AltitudeMax"],
            "scanInterval": row["ScanInterval"],
            "maxContacts": {
                "air": row["MaxContactsAir"],
                "surface": row["MaxContactsSurface"],
                "submarine": row["MaxContactsSubmarine"],
                "illuminate": row["MaxContactsIlluminate"],
            },
            "resolution": {
                "range": row["ResolutionRange"],
                "height": row["ResolutionHeight"],
                "angle": row["ResolutionAngle"],
            },
            "availability": row["Availability"],
            "capabilityIds": capability_ids,
            "radar": {
                "horizontalBeamwidth": row["RadarHorizontalBeamwidth"],
                "verticalBeamwidth": row["RadarVerticalBeamwidth"],
                "systemNoiseLevel": row["RadarSystemNoiseLevel"],
                "processingGainLoss": row["RadarProcessingGainLoss"],
                "peakPower": row["RadarPeakPower"],
                "pulseWidth": row["RadarPulseWidth"],
                "blindTime": row["RadarBlindTime"],
                "prf": row["RadarPRF"],
            },
            "radarIlluminate": {
                "horizontalBeamwidth": row["RadarHorizontalBeamwidthIlluminate"],
                "verticalBeamwidth": row["RadarVerticalBeamwidthIlluminate"],
                "systemNoiseLevel": row["RadarSystemNoiseLevelIlluminate"],
                "processingGainLoss": row["RadarProcessingGainLossIlluminate"],
                "peakPower": row["RadarPeakPowerIlluminate"],
                "pulseWidth": row["RadarPulseWidthIlluminate"],
                "blindTime": row["RadarBlindTimeIlluminate"],
                "prf": row["RadarPRFIlluminate"],
            },
            "esm": {
                "sensitivity": row["ESMSensitivity"],
                "systemLoss": row["ESMSystemLoss"],
                "numberOfChannels": row["ESMNumberOfChannels"],
                "preciseEmitterID": bool(row["ESMPreciseEmitterID"]),
            },
            "ecm": {
                "gain": row["ECMGain"],
                "peakPower": row["ECMPeakPower"],
                "bandwidth": row["ECMBandwidth"],
                "numberOfTargets": row["ECMNumberOfTargets"],
                "pokReduction": row["ECMPoKReduction"],
            },
            "sonar": {
                "sourceLevel": row["SonarSourceLevel"],
                "pulseLength": row["SonarPulseLength"],
                "directivityIndex": row["SonarDirectivityIndex"],
                "recognitionDifferentialActive": row["SonarRecognitionDifferentialActive"],
                "recognitionDifferentialPassive": row["SonarRecognitionDifferentialPassive"],
                "sensorToMachineryDistance": row["SonarSensorToMachineryDistance"],
                "towLength": row["SonarTowLength"],
                "minDeploymentDepth": row["SonarMinimumDeploymentDepth"],
                "maxDeploymentDepth": row["SonarMaximumDeploymentDepth"],
                "czNumber": row["SonarCZNumber"],
            },
            "visual": {
                "detectionZoomLevel": row["VisualDetectionZoomLevel"],
                "classificationZoomLevel": row["VisualClassificationZoomLevel"],
            },
            "ir": {
                "detectionZoomLevel": row["IRDetectionZoomLevel"],
                "classificationZoomLevel": row["IRClassificationZoomLevel"],
            },
            "minimumSignature": {
                "radar": row["MinimumSignature_Radar"],
                "visual": row["MinimumSignature_Visual"],
                "ir": row["MinimumSignature_IR"],
                "esm": row["MinimumSignature_ESM"],
                "activeSonar": row["MinimumSignature_ActiveSonar"],
                "passiveSonar": row["MinimumSignature_PassiveSonar"],
            },
            "frequencySearchTrack": [r[0] for r in freq_st],
            "frequencyIlluminate": [r[0] for r in freq_ill],
            "frequencyUpper": row["FrequencyUpper"],
            "frequencyLower": row["FrequencyLower"],
        }
        sensors.append(sensor)
        if (i + 1) % 1000 == 0:
            print(f"    Sensors: {i + 1}/{len(rows)}")

    write_json(OUTPUT_DIR / "sensors.json", {
        "_meta": metadata(DB_PATH, "DataSensor", len(sensors)),
        "records": sensors,
    })


def extract_mounts(conn):
    print("\n=== Extracting Mounts ===")
    rows = conn.execute(
        "SELECT * FROM DataMount WHERE Deprecated = 0 AND Hypothetical = 0"
    ).fetchall()

    mounts = []
    for row in rows:
        row = dict(row)
        mid = row["ID"]

        weapon_rows = conn.execute(
            "SELECT ComponentID FROM DataMountWeapons WHERE ID = ?", (mid,)
        ).fetchall()
        sensor_rows = conn.execute(
            "SELECT ComponentID FROM DataMountSensors WHERE ID = ?", (mid,)
        ).fetchall()

        mount = {
            "id": mid,
            "name": row["Name"],
            "comments": row["Comments"],
            "rof": row["ROF"],
            "capacity": row["Capacity"],
            "magazineROF": row["MagazineROF"],
            "magazineCapacity": row["MagazineCapacity"],
            "damagePoints": row["DamagePoints"],
            "armorGeneralId": row["ArmorGeneral"],
            "trainable": bool(row["Trainable"]),
            "autonomous": bool(row["Autonomous"]),
            "localControl": bool(row["LocalControl"]),
            "availability": row["Availability"],
            "weaponIds": [r[0] for r in weapon_rows],
            "sensorIds": [r[0] for r in sensor_rows],
        }
        mounts.append(mount)

    write_json(OUTPUT_DIR / "mounts.json", {
        "_meta": metadata(DB_PATH, "DataMount", len(mounts)),
        "records": mounts,
    })


def extract_loadouts(conn):
    print("\n=== Extracting Loadouts ===")
    rows = conn.execute(
        "SELECT * FROM DataLoadout WHERE Deprecated = 0 AND Hypothetical = 0"
    ).fetchall()

    loadouts = []
    for i, row in enumerate(rows):
        row = dict(row)
        lid = row["ID"]

        weapon_rows = conn.execute(
            "SELECT ComponentID FROM DataLoadoutWeapons WHERE ID = ?", (lid,)
        ).fetchall()

        loadout = {
            "id": lid,
            "name": row["Name"],
            "roleId": row["LoadoutRole"],
            "readyTime": row["ReadyTime"],
            "readyTimeSustained": row["ReadyTime_Sustained"],
            "combatRadius": row["DefaultCombatRadius"],
            "timeOnStation": row["DefaultTimeOnStation"],
            "missionProfileId": row["DefaultMissionProfile"],
            "timeOfDayId": row["TimeofDay"],
            "weatherId": row["Weather"],
            "quickTurnaround": bool(row["QuickTurnaround"]),
            "quickTurnaroundReadyTime": row["QuickTurnaround_ReadyTime"],
            "quickTurnaroundMaxSorties": row["QuickTurnaround_MaxSorties"],
            "weaponIds": [r[0] for r in weapon_rows],
        }
        loadouts.append(loadout)
        if (i + 1) % 5000 == 0:
            print(f"    Loadouts: {i + 1}/{len(rows)}")

    write_json(OUTPUT_DIR / "loadouts.json", {
        "_meta": metadata(DB_PATH, "DataLoadout", len(loadouts)),
        "records": loadouts,
    })


# --- Raw/Deferred Extraction ---

def extract_raw_table(conn, table_name, output_name, filter_clause=""):
    """Dump a table as-is for future use."""
    query = f"SELECT * FROM {table_name}"
    if filter_clause:
        query += f" WHERE {filter_clause}"
    try:
        rows = conn.execute(query).fetchall()
        if not rows:
            print(f"  (skipped {table_name} — 0 records)")
            return
        cols = [desc[0] for desc in conn.execute(f"PRAGMA table_info({table_name})").fetchall()]
        cols = [c[1] for c in conn.execute(f"PRAGMA table_info({table_name})").fetchall()]
        records = [dict(zip(cols, row)) for row in conn.execute(query).fetchall()]
        write_json(RAW_DIR / f"{output_name}.json", {
            "_meta": metadata(DB_PATH, table_name, len(records)),
            "records": records,
        })
    except Exception as e:
        print(f"  WARN: Could not extract {table_name}: {e}")


def extract_raw_platform_with_junctions(conn, platform_name, platform_table, junctions):
    """Extract a platform table and all its junction tables."""
    print(f"\n=== Raw: {platform_name} ===")
    extract_raw_table(conn, platform_table, platform_name.lower(),
                      "Deprecated = 0 AND Hypothetical = 0")
    for junction_suffix in junctions:
        jt = f"{platform_table}{junction_suffix}"
        try:
            extract_raw_table(conn, jt, f"{platform_name.lower()}_{junction_suffix.lower()}")
        except Exception as e:
            print(f"  WARN: {jt}: {e}")


def extract_deferred(conn):
    print("\n=== Extracting Deferred (Raw) ===")

    extract_raw_platform_with_junctions(conn, "Submarines", "DataSubmarine", [
        "Sensors", "Mounts", "Propulsion", "Fuel", "Signatures",
        "Comms", "Magazines", "DockingFacilities", "AircraftFacilities", "Codes",
    ])

    extract_raw_platform_with_junctions(conn, "Facilities", "DataFacility", [
        "Sensors", "Mounts", "Fuel", "Signatures",
        "Comms", "Magazines", "DockingFacilities", "AircraftFacilities",
    ])

    extract_raw_platform_with_junctions(conn, "GroundUnits", "DataGroundUnit", [
        "Sensors", "Mounts", "Propulsion", "Fuel", "Signatures",
        "Comms", "Magazines", "DockingFacilities", "AircraftFacilities", "Codes",
    ])

    # Standalone deferred tables
    extract_raw_table(conn, "DataComm", "comms")
    extract_raw_table(conn, "DataMagazine", "magazines")
    extract_raw_table(conn, "DataDockingFacility", "docking_facilities")
    extract_raw_table(conn, "DataAircraftFacility", "aircraft_facilities")
    extract_raw_table(conn, "DataContainer", "containers")

    # Satellites
    try:
        extract_raw_platform_with_junctions(conn, "Satellites", "DataSatellite", [
            "Sensors", "Mounts", "Comms", "Signatures", "Orbits", "Codes",
        ])
    except Exception as e:
        print(f"  WARN: Satellites: {e}")


# --- Main ---

def main():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        print("Update DB_PATH at the top of this script.")
        sys.exit(1)

    print(f"CMO Database Extraction")
    print(f"Source: {DB_PATH}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Raw:    {RAW_DIR}")

    conn = connect(DB_PATH)

    # MVP extraction
    extract_enums(conn)
    extract_sensors(conn)
    extract_mounts(conn)
    extract_weapons(conn)
    extract_loadouts(conn)
    extract_ships(conn)
    extract_aircraft(conn)

    # Deferred raw dumps
    extract_deferred(conn)

    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
