# Mirag City — Authoritative Master Plan

This document is the source of truth for city placement. Roads, bridges and buildings should not be randomly scattered outside this plan.

## Coordinate system

- World center: Central Downtown roundabout at approximately `(0, 165)`.
- South: Beach / Marina.
- North: Hills / VIP.
- West: Old Market + Canal Town.
- East: Tech / Port + Industrial Docks.
- Playable city envelope: roughly `-650..650 X` and `-650..650 Z`.

## Road hierarchy

### Primary arterials

- **A1 Grand Boulevard** — north/south spine from Beach to Hills.
- **A2 Central Cross** — west/east city spine from Old Market to Tech / Port.
- **A5 Neon Strip** — entertainment district main road.
- **A6 Waterfront Road** — coastal road serving Beach, Riverside and Marina.
- **A7 Port Boulevard** — diagonal freight/industrial access.

### Secondary collectors

- **A3 Market Avenue** — diagonal entry into Old Market.
- **A4 Tech Avenue** — diagonal entry into Tech district.
- **A8 Canal Link** — route between Canal Town and center.
- **A9/A10 Riverside North/South** — two promenades framing the river.
- **A24 Hills Spine** — ridge road through VIP district.

### Local streets

Old Market, Tech Campus, Canal Town, Industrial Docks and Beach each have named local road corridors in `MirageCityMasterPlan.ts`. Building rows are aligned to these streets.

## Ring roads and curved routes

- **R1 North Ring** — express route around Hills / Downtown north edge.
- **R2 South Ring** — coastal/industrial bypass.
- **R3 Central Roundabout** — Downtown civic roundabout.
- **R4 Hills Loop** — low-speed VIP residential loop.
- **R5 Marina Crescent** — curved marina access road.

## Bridges

- **B1 Canal North/South Bridge** — crosses main horizontal canal.
- **B2 Canal West Crossing** — crosses vertical canal branch.
- **B3 Canal West North Bridge** — second branch crossing for local circulation.
- **B4 River West Bridge** — Riverside west crossing.
- **B5 River Central Bridge** — principal Downtown ↔ Beach crossing.
- **B6 River East Bridge** — Riverside east crossing.
- **B7 Port Causeway** — industrial dock access.
- **E1 North Freeway** — elevated expressway across the north skyline with fixed piers.

Every bridge has fixed endpoints, width and deck height. Bridges are not decorative random meshes.

## District building rules

- **Central Downtown:** tallest massing. Buildings line Grand Boulevard and Central Cross; roundabout stays clear.
- **Old Market:** compact low-rise perimeter blocks with internal service lanes.
- **Tech / Port:** campus-style blocks, wider setbacks, medium/high-rise tech tower landmark.
- **Canal Town:** buildings follow canal banks; no buildings may occupy water corridors.
- **Neon Quarter:** two parallel building walls framing the Neon Strip; casino is a fixed landmark.
- **Riverside:** buildings sit behind promenades and preserve river visibility.
- **Industrial Docks:** large warehouse-style blocks align to truck roads and port boulevard.
- **Beach / Marina:** hotels and services face the waterfront road/marina crescent.
- **Hills / VIP:** low-density villas follow the ridge and hills loop, with VIP mansion at the center.

## Fixed landmarks

- Central Bank
- Police HQ
- Tech Tower
- Market Hall
- Neon Casino
- Grand Hotel
- Port Warehouse
- VIP Mansion

## Implementation rule

`src/game/MirageCityMasterPlan.ts` is the data source. `MirageCityRebuild.ts` renders that plan. New road, bridge or building placement should first be added to the master plan rather than placed ad hoc inside rendering code.
