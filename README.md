This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

---

# Evote Frontend Application (Web UI)

This repository houses the frontend architecture for **Evote**, a zero-PII, multi-tenant digital school election platform designed to replace manual paper ballot voting with secure kiosks, real-time tallies, and live projector views.

---

## 🚀 What Has Been Done (Sprint 0 - Task EVT-004)
As part of **Sprint 0: Foundation & Infrastructure**, the frontend foundation has been successfully established and structured according to the technical blueprint:
* **Bootstrapped Next.js 14 App:** Initialized using the modern **App Router** (`src/app/`) paradigm with strict **TypeScript** configuration and **Tailwind CSS**.
* **Client State Management Integration:** Installed **Zustand** (~1 KB) to handle lightweight, predictable state management for upcoming multi-step kiosk voting flows.
* **Core Route Stubs Implemented:** Created foundational route directories and page components for the four primary user surfaces of the application:
  1. **Admin Dashboard (`/admin`)**: Serves as the base control center for election configuration, candidate vetting, and device management.
  2. **Teacher Dashboard (`/teacher`)**: Designed as a read-only analytics surface for monitoring turnout velocity and candidate standings.
  3. **Kiosk Voting Interface (`/kiosk`)**: Structured for the locked-down, multi-step student voting wizard.
  4. **Public Projector View (`/projector`)**: Prepared for assembly hall auto-scrolling live standings and projected winner banners.

---

## 🛠️ Technology Stack & Tools Used
* **[Next.js 14 (App Router)](https://nextjs.org/):** Full-stack React framework utilizing Server-Side Rendering (SSR) for public/projector visibility and Client-Side Rendering (CSR) for interactive admin and kiosk views.
* **[TypeScript](https://www.typescriptlang.org/):** Provides strict type safety across all components, routes, and data contracts to prevent runtime exceptions.
* **[Tailwind CSS](https://tailwindcss.com/):** Utility-first styling framework paired with CSS custom properties (variables) to support the platform's multi-tenant dynamic branding engine.
* **[Zustand](https://github.com/pmndrs/zustand):** Ultra-lightweight state container used for managing wizard progression and session flow.
* **[Turbopack](https://nextjs.org/docs/architecture/turbopack):** High-speed incremental bundler used during local development for rapid hot-reloading.

---

## 📂 File & Directory Structure Created
```text
my-next-app/
 ├── apps/
 │    └── web/
 │         ├── src/
 │         │    └── app/
 │         │         ├── admin/
 │         │         │    └── page.tsx        # Admin Dashboard Stub
 │         │         ├── teacher/
 │         │         │    └── page.tsx        # Teacher Dashboard Stub
 │         │         ├── kiosk/
 │         │         │    └── page.tsx        # Kiosk Voting Interface Stub
 │         │         ├── projector/
 │         │         │    └── page.tsx        # Public Projector View Stub
 │         │         ├── layout.tsx           # Root Layout with Tailwind/Font imports
 │         │         └── page.tsx             # Home Landing Page
 │         ├── public/                      # Static assets & logos
 │         ├── package.json                 # Project dependencies & scripts
 │         └── tsconfig.json                # TypeScript configuration
 └── README.md