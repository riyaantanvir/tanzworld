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
- **Core Entities**: Users, Sessions, Clients, Campaigns, Work Reports, Salaries, Ad Accounts, Facebook Pages, Email Settings, SMS Settings, Client Email Preferences (disabled), Farming Accounts.
- **User Menu Permissions**: Granular permission controls for menu visibility including dashboard, campaigns, clients, ad accounts, work reports, Own Farming (parent), New Created (sub-menu), Farming Accounts (sub-menu), finance, and admin panel access.
- **Validation**: Zod schemas for runtime type validation.
- **Migrations**: Drizzle Kit for schema management.

## Authentication & Authorization
- **Strategy**: Bearer token authentication stored in localStorage.
- **Session Management**: Server-side session validation.
- **Route Protection**: Client-side guards and API endpoint permission checks (e.g., `requirePagePermission`).
- **Default Credentials**: Admin user ("Admin"/"2604").

## Component Architecture
- **Design System**: Comprehensive UI component library with consistent theming.
- **Form Handling**: React Hook Form with Zod validation.
- **Responsive Design**: Mobile-first approach.
- **Accessibility**: ARIA-compliant components.

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
- **Gher Management**: Complete financial tracking module for income/expense management with four dedicated pages:
  - **Dashboard**: Real-time analytics with advanced filtering and visualization features including:
    - Quick date filters (All Time, This month, Last month, This year, Custom) with "All Time" as default for historical data visibility
    - Side-by-side tag breakdown sections showing Expense Breakdown (left) and Income Breakdown (right) with amount, percentage, and progress bars
    - Tag filter dropdown to filter entries by specific tag
    - Filtered results table displaying tag-specific transactions within the selected date range
    - Partner filters, total income/expense/net balance display, and complete transaction history
    - Defaults to showing all historical data (1900-01-01 to today) to ensure no entries are hidden by date filtering
  - **Expense**: Inline form design (always visible, no dialog) for quick entry creation with fields for date, type (income/expense), amount (BDT), details, and tag. Edit functionality populates the inline form and scrolls to top. Includes CSV import/export functionality with example CSV download (format: Date, Details, Type, Amount (BDT), Tag). Import validates date parsing, amount format, and type field (income/expense only) with detailed error reporting
  - **Partner**: Partner management with name and phone number fields
  - **Settings**: Tag management for categorizing expenses
  - Uses shared Sidebar navigation component for consistent UX across all pages

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