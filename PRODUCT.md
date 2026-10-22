# PUSH Companion

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Julius, Daniel and Tobi attend PUSH UX in Munich on 22 and 23 October 2026. They primarily use their phones during the conference.

## Product Purpose
A remarkably clear two-day agenda that answers what is happening now, what is next, and which sessions each colleague wants to attend.

## Capabilities and Constraints
Official program data; separate favorites and a private invitation link (confirmed by user); live time-aware agenda in Europe/Berlin; search; session details with a short German TL;DR and deeper source information; venue information; light and dark themes. Deploy to the user's Vercel and commit to bthginfo/Push-Helper. Only free storage tiers. Favorites are planning intent, never official breakout reservations.

The personal live map prioritizes each active profile’s selected sessions and otherwise follows Group A. Optional roundtables require a selection. Ambiguous parallel breakouts and overlapping favorites require a decision. Preview time is explicitly labeled and never overwrites selections.

All three attendees plan to attend Group A. Group B agenda slots are collapsed by default on both days and can be expanded individually. Existing two-person plans keep their keys and selections when Tobi joins.

## Brand Commitments
User requests a modern Apple-like visual standard, exceptional usability, and mobile-first design. Remove unnecessary labels and marketing phrases without replacing them with new slogans. Interface in German; original session titles and descriptions remain English.

## Evidence on Hand
https://push-conference.com/program and https://push-conference.com/location. The user supplied a photographed venue map on 22 October 2026, retained as public/venue-map.jpg. The interactive schematic follows this map: Breakouts 1–4 in the left side wing, 5–6 in the right restaurant; roundtables and lounge in the upstairs foyer. No individual roundtable positions are given. General venue entries have no exact room assignment. Do not invent room positions, session times, or availability.

## Product Principles
The next decision must be obvious. Preserve factual uncertainty. Make personal and shared intent distinguishable. Keep the agenda usable offline after its first load.

## Stack
Implementation choice: React, TypeScript and Vite with Vercel functions for private shared planning. This is an implementation assumption based on the requested deployment and interaction scope.
