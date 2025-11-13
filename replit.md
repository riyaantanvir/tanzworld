# Overview

Advantix Admin is a full-stack web application designed to streamline digital advertising campaign management. It provides tools for campaign creation (including Facebook Ads integration), client tracking, financial management (with automated salary generation and a robust Gher Management module for fish farming financial tracking), and detailed work reporting. The platform features an advanced admin dashboard, a modern authentication system, and a comprehensive UI component library, aiming to enhance operational efficiency for marketing agencies. It also includes a manual email composer with professional templates for client communication.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Framework**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

## Backend
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM
- **Authentication**: Token-based with session storage
- **API Design**: RESTful with centralized error handling
- **Email/SMS**: Pluggable architecture supporting multiple providers, configurable via Admin panel.
- **Third-Party Integrations**: Facebook Graph API for ad account and page synchronization.

## Database Schema
- **Core Entities**: Users, Sessions, Clients, Campaigns, Work Reports, Salaries, Ad Accounts, Facebook Pages, Email/SMS Settings, Farming Accounts, Gher Entries, Gher Tags, Gher Partners, Gher Capital Transactions, Gher Settlements, Gher Settlement Items, Gher Audit Logs, Gher Invoices, Gher Invoice Sequences.
- **Validation**: Zod schemas.
- **Migrations**: Drizzle Kit.
- **Permissions**: Granular user menu permissions (e.g., dashboard, campaigns, clients, Gher Management).

## Authentication & Authorization
- **Strategy**: Bearer token authentication (localStorage).
- **Session Management**: Server-side validation.
- **Route Protection**: Client-side guards and API endpoint checks.
- **Permission Cache**: Instant invalidation of React Query cache after permission changes.

## Component Architecture
- **Design System**: Comprehensive UI component library.
- **Form Handling**: React Hook Form with Zod validation.
- **Responsive Design**: Mobile-first.
- **Accessibility**: ARIA-compliant components.

## Feature Specifications
- **Campaign Management**: 3-step wizard for Facebook ad campaigns, draft management, media upload, one-click sync with Facebook Marketing API including budget details, and a real-time analytics dashboard with interactive filters.
- **Financial Management**: Automated salary generation from work reports based on hours and configurable bonuses, with an approval workflow.
- **Client Communication**: Manual email composer with 9 professional templates, live HTML preview, and role-based access.
- **External Service Configuration**: Admin panel for setting up email (Resend, SendGrid, Mailgun) and SMS (Bangladesh-specific) providers, including API key storage and test functionalities.
- **Own Farming Management**: CRUD operations for Facebook and TikTok farming accounts, CSV import/export, and granular access controls.
- **Gher Management**: Complete financial tracking module for income/expense with comprehensive audit logging and professional PDF invoice generation.
    - **Dashboard**: Real-time analytics with advanced filtering (date, tags, partners) and visualization.
    - **Expense/Income Entry**: Inline form for quick entry creation with server-side pagination and CSV import/export.
    - **Audit Log System**: Comprehensive logging for all Gher operations (create/update/delete) with before/after diffs, multi-criteria filtering, and pagination.
    - **Invoice System**: Professional PDF invoice generation with detailed transaction-level breakdown grouped by tags, multi-page support, and Bengali font integration.

# External Dependencies

## Core Technologies
- **@neondatabase/serverless**: PostgreSQL driver
- **drizzle-orm**: ORM
- **@tanstack/react-query**: Server state management
- **wouter**: React router
- **zod**: Runtime type validation

## UI & Styling
- **@radix-ui/***: Headless UI components
- **tailwindcss**: CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

## Development Tools
- **vite**: Build tool
- **tsx**: TypeScript execution
- **esbuild**: JavaScript bundler

## Integrations
- **Facebook Graph API**: Ad accounts and pages synchronization.
- **Resend, SendGrid, Mailgun**: Email service providers.
- **SMS in BD, BD Bulk SMS**: Bangladesh-specific SMS providers.