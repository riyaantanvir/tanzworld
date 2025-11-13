# Overview

This full-stack web application, "Advantix Admin," is a comprehensive platform for managing digital advertising campaigns. It offers tools for campaign creation, client tracking, financial management (including automated salary generation from work reports), and detailed work reporting. The system integrates an advanced admin dashboard, a modern authentication system, and a robust UI component library, aiming to streamline operations for marketing agencies and businesses managing ad campaigns. It facilitates client communication through a manual email composer with professional templates and offers advanced campaign creation with Facebook Ads integration, including ad account and page synchronization.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Framework**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables
- **Build Tool**: Vite

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe operations
- **Authentication**: Token-based authentication with session storage
- **API Design**: RESTful API with centralized error handling
- **Email/SMS Services**: Pluggable architecture supporting Resend, SendGrid, Mailgun for email, and specific Bangladesh providers for SMS, configurable via Admin panel.
- **Third-Party Integrations**: Facebook Graph API for ad account and page synchronization.

## Database Schema
- **Core Entities**: Users, Sessions, Clients, Campaigns, Work Reports, Salaries, Ad Accounts, Facebook Pages, Email Settings, SMS Settings, Client Email Preferences (disabled), Farming Accounts, Gher Entries, Gher Tags, Gher Partners, **Gher Capital Transactions** (Nov 12, 2025), **Gher Settlements** (Nov 12, 2025), **Gher Settlement Items** (Nov 12, 2025), **Gher Audit Logs** (Nov 12, 2025).
- **User Menu Permissions**: Granular permission controls for menu visibility including dashboard, campaigns, clients, ad accounts, work reports, Own Farming (parent), New Created (sub-menu), Farming Accounts (sub-menu), finance, and admin panel access.
- **Validation**: Zod schemas for runtime type validation.
- **Migrations**: Drizzle Kit for schema management.
- **Schema Fix Notes**: 
  - Nov 11, 2025: Manually added `type` column to `gher_tags` table via SQL (ALTER TABLE) to resolve missing column error. The column was defined in shared/schema.ts but missing from the database. Commands executed: added `type TEXT NOT NULL DEFAULT 'expense'`, added CHECK constraint for ('income', 'expense'), and added UNIQUE constraint on (name, type). This was necessary because `npm run db:push` was stuck on an interactive prompt.
  - Nov 11, 2025: Manually added `gher_management` column to `user_menu_permissions` table via SQL (ALTER TABLE user_menu_permissions ADD COLUMN IF NOT EXISTS gher_management BOOLEAN DEFAULT false) to resolve user creation errors. The column was defined in shared/schema.ts but missing from the database.
  - Nov 12, 2025: Added partner management schema with `share_percentage` field to gher_partners, created `gher_capital_transactions` table for tracking partner contributions/withdrawals/returns, and settlement tracking tables (`gher_settlements`, `gher_settlement_items`) with CHECK constraints ensuring capital balances remain non-negative.
  - Nov 12, 2025: Manually added `share_percentage` column to `gher_partners` table via SQL (ALTER TABLE gher_partners ADD COLUMN IF NOT EXISTS share_percentage DECIMAL(5,2) NOT NULL DEFAULT 33.33) to resolve partner creation errors. Column was defined in schema but missing from database, causing "column does not exist" errors during partner CRUD operations.
  - Nov 12, 2025: Created missing partner management tables (`gher_capital_transactions`, `gher_settlements`, `gher_settlement_items`) using CREATE TABLE statements. These tables were defined in schema but missing from database, causing errors in partner summary queries. Tables created with proper foreign key references and CHECK constraints.
  - Nov 13, 2025: Fixed invoice preview and generation functionality by:
    1. Creating missing `gher_invoices` table with all required columns (invoice_number, month, year_month, totals, tags, partner movements, etc.)
    2. Creating missing `gher_invoice_sequences` table for auto-incrementing invoice numbers (year_month, last_sequence, updated_at)
    3. Creating missing `gher_audit_logs` table with indexes for tracking all Gher operations (user_id, action_type, entity_type, change_summary, etc.)
    4. Reinstalling missing `luxon` package (was in package.json but not in node_modules) via npm install to fix "Cannot find package 'luxon'" error
    5. All issues prevented invoice preview/generation APIs from working (returned 500 errors)
  - Nov 13, 2025: Fixed PDF Bengali font rendering issue:
    1. Downloaded Google Noto Sans Bengali font (NotoSansBengali-Regular.ttf) to server/fonts/ from Google Fonts repository
    2. Fixed initial download issue where HTML page was downloaded instead of actual TTF file (re-downloaded from correct raw GitHub URL)
    3. Registered Bengali font in PDF generation code using pdfkit's registerFont() API
    4. Updated PDF rendering to use Bengali font for tag names and notes (supports Bengali characters)
    5. English text (headers, numbers, labels) continues to use Helvetica font
    6. Bengali text now displays correctly instead of showing garbled characters (™Ý½„™Ý¾)

## Authentication & Authorization
- **Strategy**: Bearer token authentication stored in localStorage.
- **Session Management**: Server-side session validation.
- **Route Protection**: Client-side guards and API endpoint permission checks (e.g., `requirePagePermission`).
- **Default Credentials**: Admin user ("Admin"/"2604").
- **Permission Cache Management**: 
  - Nov 11, 2025: Fixed permission toggle system to invalidate React Query cache immediately after permission changes
  - Added predicate-based cache invalidation for all `/api/permissions/check/*` queries in updatePermissionMutation, createUserMutation, and deleteUserMutation
  - Ensures menu visibility and route access updates instantly without manual reload when admin toggles user permissions
  - Permission checks now re-fetch automatically after any permission-related mutation (update/create/delete)

## Component Architecture
- **Design System**: Comprehensive UI component library with consistent theming.
- **Form Handling**: React Hook Form with Zod validation.
- **Responsive Design**: Mobile-first approach.
- **Accessibility**: ARIA-compliant components.
- **Technical Debt**: admin.tsx file is ~5200 lines and should be refactored into smaller, modular components for better maintainability (recommended for future cleanup).

## Feature Specifications
- **Campaign Management**: 
  - 3-step wizard for Facebook ad campaigns (Setup, Audience, Creative Assets)
  - Draft management and media upload
  - **Facebook Campaign Sync**: One-click sync to import campaigns from Facebook Marketing API with full budget details (daily/lifetime budgets, spend, remaining budget, status)
  - Visual indicators for synced campaigns with "FB" badge
  - Automatic campaign updates on re-sync
  - **Campaign Analytics Dashboard**: Real-time reporting dashboard displaying ad account-wise metrics including total spend, total budget, and available balance. Features interactive filters for ad account, campaign, and date range (with proper daily spend aggregation for date-filtered queries). Shows grand totals and ad account breakdown cards.
- **Financial Management**: Automated salary generation from work reports, intelligent calculation based on hours, basic salary, and configurable bonuses. Salary approval workflow with Pending, Approved, Rejected statuses.
- **Client Communication**: Manual email composer with 9 professional templates (e.g., Welcome, Monthly Report, Payment Reminder, Campaign Launch, Budget Alert, Account Activation/Suspension), live HTML preview, and role-based access.
- **External Service Configuration**: Admin panel for setting up email (Resend, SendGrid, Mailgun) and SMS (Bangladesh-specific providers) services, including API key storage in the database and test connection functionalities.
- **Own Farming Management**: Full CRUD operations for Facebook and TikTok farming accounts with plain-text storage of sensitive data (passwords, recovery emails, 2FA secrets). Features admin-only access controls, CSV import/export, and granular permission system with separate controls for:
  - **Own Farming** (parent menu visibility)
  - **New Created** (sub-menu for new account creation)
  - **Farming Accounts** (sub-menu for account management)
- **Gher Management**: Complete financial tracking module for income/expense management with comprehensive audit logging:
  - **Dashboard**: Real-time analytics with advanced filtering and visualization features including:
    - Quick date filters (All Time, This month, Last month, This year, Custom) with "All Time" as default for historical data visibility
    - Side-by-side tag breakdown sections showing Expense Breakdown (left) and Income Breakdown (right) with amount, percentage, and progress bars
    - Tag filter dropdown to filter entries by specific tag
    - Filtered results table displaying tag-specific transactions within the selected date range
    - Partner filters, total income/expense/net balance display, and complete transaction history
    - Defaults to showing all historical data (1900-01-01 to today) to ensure no entries are hidden by date filtering
    - **API Integration Fix** (Nov 11, 2025): Fixed dashboard crash by extracting `.data` property from paginated `/api/gher/entries` response. Dashboard now fetches all entries with `pageSize=999999` for client-side filtering and pagination via `usePagination` hook.
  - **Expense**: Inline form design (always visible, no dialog) for quick entry creation with fields for date, type (income/expense), amount (BDT), details, and tag. Edit functionality populates the inline form and scrolls to top. **Pagination**: Server-side pagination with URL-based state management (page, pageSize), default 10 items per page with user-controllable options (10/25/50/100). Includes pagination controls (previous/next buttons, page info, page size selector). CSV import/export functionality with example CSV download (format: Date, Details, Type, Amount (BDT), Tag). CSV export fetches all entries regardless of pagination for complete ledger download. Import validates date parsing, amount format, and type field (income/expense only) with detailed error reporting
  - **Partner**: Partner management with name and phone number fields
  - **Settings**: Tag management for categorizing expenses
  - Uses shared Sidebar navigation component for consistent UX across all pages
  - **Utility Enhancements** (Nov 11, 2025): Enhanced `usePagination` hook with defense-in-depth safety guard (`Array.isArray(data) ? data : []`) to prevent runtime crashes from non-array inputs
  - **Audit Log System** (Nov 12, 2025): Comprehensive audit logging for all Gher Management operations:
    - Tracks all create/update/delete operations on entries, partners, tags, and invoices
    - Database schema with indexed columns (userId, entityType, actionType, createdAt) for efficient filtering
    - Automatic change tracking with before/after diffs for update operations using specialized helper function
    - JSONB storage for change summaries and metadata
    - Reusable `logGherAudit` helper in server/gher-audit-helper.ts with intelligent Date comparison to avoid false positives
    - API endpoint `/api/gher/audit-logs` with super-admin access control and pagination (default 50 items/page)
    - Admin panel "Audit Log" tab replacing "Data Import/Export" with:
      - Multi-criteria filtering: date range, user, entity type, action type
      - Expandable table rows showing detailed change diffs and metadata
      - Color-coded action badges (destructive for deletes, default for creates, outline for updates)
      - Real-time pagination with page navigation controls
    - Production-ready with error propagation (audit failures throw exceptions to prevent silent trail gaps)
    - Date filter bug fixes: endDate normalized to 23:59:59.999 to include full day's events

# External Dependencies

## Core Technologies
- **@neondatabase/serverless**: PostgreSQL driver
- **drizzle-orm**: ORM for database interactions
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight React router
- **zod**: Runtime type validation

## UI & Styling
- **@radix-ui/***: Headless UI components
- **tailwindcss**: CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

## Development Tools
- **vite**: Build tool and development server
- **tsx**: TypeScript execution for Node.js
- **esbuild**: JavaScript bundler

## Integrations
- **Facebook Graph API**: For syncing ad accounts and pages.
- **Resend, SendGrid, Mailgun**: Email service providers.
- **SMS in BD, BD Bulk SMS**: Bangladesh-specific SMS providers.
- **connect-pg-simple**: PostgreSQL session store for Express.