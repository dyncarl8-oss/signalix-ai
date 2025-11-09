# SignalixAI

## Overview

SignalixAI is a real-time cryptocurrency prediction chat application that provides users with AI-powered market movement predictions through a Discord-style chat interface. The application allows users to interact with an AI bot that analyzes crypto pairs (BTC/USDT, ETH/USDT, SOL/USDT, etc.) and provides directional predictions with confidence scores and time durations. Built as a single-page application with no authentication requirements, it emphasizes simplicity and immediate accessibility.

## User Preferences

Preferred communication style: Simple, everyday language.

## Environment Variables

The application requires the following environment variables for Whop integration:

### Required for Whop App Publishing

- `WHOP_API_KEY`: Your Whop API key for server-side authentication. Get this from the Whop developer dashboard at https://whop.com/dashboard/developer
- `WHOP_APP_ID`: Your Whop App ID (format: `app_xxxxxxxxxxxxx`). Used for server-side SDK initialization.
- `VITE_WHOP_APP_ID`: Same as WHOP_APP_ID but prefixed with `VITE_` for frontend access. Used for client-side iframe SDK initialization.

### Optional

- `GEMINI_API_KEY`: Google Gemini API key for AI-powered crypto predictions (already configured if using Gemini integration)

See `.env.example` for a template of required environment variables.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**UI Components**: The application uses shadcn/ui component library built on Radix UI primitives, providing a comprehensive set of accessible, customizable components. The design system follows a "new-york" style with Tailwind CSS for styling.

**Design System**: Discord-inspired dark theme with utility-focused patterns optimized for chat interfaces. Key design decisions include:
- Typography hierarchy using Inter/DM Sans for primary text and JetBrains Mono for timestamps and technical data
- Consistent spacing primitives (Tailwind units: 2, 3, 4, 6, 8)
- Full-viewport layout with fixed header (h-16), scrollable message area, and fixed input area
- Maximum chat width of 4xl for optimal readability
- Message alignment: bot messages left-aligned with avatars, user messages right-aligned

**State Management**: Uses @tanstack/react-query (v5) for server state management and caching. The QueryClient is configured with infinite stale time and disabled automatic refetching, suitable for the real-time nature of the chat application.

**Routing**: Implements wouter for lightweight client-side routing, currently serving a single main Chat route.

**Real-time Communication**: Custom WebSocket hook (`useWebSocket`) manages bidirectional communication with the server over a dedicated `/ws` path, separate from Vite's HMR WebSocket to avoid conflicts.

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js, configured as an ES module.

**WebSocket Server**: Uses the `ws` library to handle WebSocket connections on a dedicated `/ws` path. The server maintains session-based prediction history in memory for each connected client.

**Prediction Engine**: Modular prediction logic (`server/prediction.ts`) that generates realistic random predictions with:
- Direction: UP or DOWN (50/50 probability)
- Confidence scores: 60-90% range
- Duration options: 15s, 30s, 45s, 1m, 2m, 5m
- Design allows for future replacement with actual ML/AI models

**Message Protocol**: Structured message types for client-server communication:
- Client messages: `user_message`, `select_pair`, `history`, `new_session`
- Server messages: `bot_message`, `typing`, `prediction`

**Build Process**: 
- Frontend: Vite builds the React application to `dist/public`
- Backend: esbuild bundles the server code to `dist/index.js` with ESM format
- Production mode serves static files from the built frontend

### External Dependencies

**Database**: Drizzle ORM is configured with PostgreSQL dialect (using @neondatabase/serverless driver), though the current implementation uses in-memory storage. Database schema is defined in `shared/schema.ts` with migrations output to `./migrations`. The system is structured to easily transition from in-memory storage to PostgreSQL persistence.

**UI Component Libraries**:
- @radix-ui/* - Comprehensive set of accessible, unstyled UI primitives (accordion, dialog, dropdown, popover, etc.)
- @heroicons/react - Icon library for visual elements
- class-variance-authority & clsx - Utility libraries for conditional CSS class composition
- tailwindcss - Utility-first CSS framework with custom design tokens

**Form Management**:
- react-hook-form - Form state management
- @hookform/resolvers - Validation resolvers
- zod & drizzle-zod - Schema validation

**Date Utilities**: date-fns for timestamp formatting and manipulation

**Development Tools**:
- Replit-specific plugins for enhanced development experience (vite-plugin-runtime-error-modal, vite-plugin-cartographer, vite-plugin-dev-banner)
- TypeScript with strict mode enabled for type safety
- Path aliases configured (@/, @shared/, @assets/) for cleaner imports

**Session Management**: Infrastructure prepared with connect-pg-simple for PostgreSQL-backed sessions, though currently using in-memory storage.

### Key Architectural Decisions

**Separation of Concerns**: The codebase is organized into clear domains:
- `client/` - Frontend React application
- `server/` - Backend Express server and WebSocket logic
- `shared/` - Type definitions and schemas shared between client and server
- `attached_assets/` - Project specifications and design documents

**Type Safety**: Zod schemas in `shared/schema.ts` ensure runtime type validation for messages and crypto pairs, with TypeScript types derived from these schemas for compile-time safety.

**Modular Prediction Logic**: The prediction generator is isolated in its own module, making it simple to swap with a real ML model or API integration without affecting the rest of the application.

**Real-time First**: WebSocket communication chosen over HTTP polling for immediate, bidirectional updates suitable for a chat interface with low latency requirements.

**Whop Platform Integration**: The application is integrated with Whop to enable publishing as a Whop app. Key integration features:
- Authentication via Whop user tokens passed through iframe headers
- Experience-based routing (`/experiences/:experienceId`) for Whop embedding
- Iframe SDK for communication with the Whop platform
- Access control to verify user permissions for experiences
- API endpoints for authentication and authorization

**No Authentication (Standalone Mode)**: When not running in Whop, the app works as a frictionless experience - users can immediately start chatting without login, signup, or any barriers to entry. Each WebSocket connection represents an independent session.

**Scalability Considerations**: While currently using in-memory storage, the architecture with Drizzle ORM and session store infrastructure allows for straightforward migration to persistent database storage when needed for features like prediction history or multi-session support.