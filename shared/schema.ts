import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, decimal, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles enum - must be declared before use
export const UserRole = {
  USER: 'user' as const,
  MANAGER: 'manager' as const,
  ADMIN: 'admin' as const,
  SUPER_ADMIN: 'super_admin' as const,
  CLIENT: 'client' as const,
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // "user", "manager", "admin", "super_admin", "client"
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "restrict" }), // For client users
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    roleCheck: sql`CHECK (${table.role} IN ('user', 'manager', 'admin', 'super_admin', 'client'))`
  }
});

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Ad Accounts Management
export const adAccounts = pgTable("ad_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platform: text("platform").notNull(), // "facebook", "google", "tiktok", etc.
  accountName: text("account_name").notNull(),
  accountId: text("account_id").notNull(), // External account ID
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "restrict" }),
  spendLimit: decimal("spend_limit", { precision: 12, scale: 2 }).notNull(),
  totalSpend: decimal("total_spend", { precision: 12, scale: 2 }).default("0"),
  status: text("status").notNull().default("active"), // "active", "suspended"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaign Management
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  comments: text("comments"),
  adAccountId: varchar("ad_account_id").references(() => adAccounts.id, { onDelete: "restrict" }).notNull(),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"), // "active", "paused", "completed"
  objective: text("objective").notNull(),
  budget: decimal("budget", { precision: 12, scale: 2 }).notNull(),
  spend: decimal("spend", { precision: 12, scale: 2 }).default("0"),
  
  // Facebook Sync Fields
  fbCampaignId: text("fb_campaign_id"), // Facebook campaign ID
  isSynced: boolean("is_synced").default(false), // Whether synced from Facebook
  dailyBudget: decimal("daily_budget", { precision: 12, scale: 2 }), // Daily budget in dollars
  lifetimeBudget: decimal("lifetime_budget", { precision: 12, scale: 2 }), // Lifetime budget in dollars
  budgetRemaining: decimal("budget_remaining", { precision: 12, scale: 2 }), // Remaining budget
  effectiveStatus: text("effective_status"), // Facebook effective status
  lastSyncedAt: timestamp("last_synced_at"), // Last time synced from Facebook
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Client Management
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  businessName: text("business_name").notNull(),
  contactPerson: text("contact_person").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  notes: text("notes"),
  status: text("status").notNull().default("active"), // "active", "paused"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Simplified Salary Management
export const salaries = pgTable("salaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => users.id, { onDelete: "restrict" }).notNull(), // Changed to reference users table
  employeeName: text("employee_name").notNull(), // Denormalized for display
  
  // Basic Salary Information
  basicSalary: decimal("basic_salary", { precision: 12, scale: 2 }).notNull(), // BDT
  contractualHours: integer("contractual_hours").notNull(), // Per month
  actualWorkingHours: decimal("actual_working_hours", { precision: 6, scale: 2 }).notNull(), // Billing hours
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(), // Auto-calculated: Basic Salary ÷ Contractual Hours
  
  // Payment Calculations
  basePayment: decimal("base_payment", { precision: 12, scale: 2 }).notNull(), // Actual Working Hours × Hourly Rate
  
  // Bonus
  festivalBonus: decimal("festival_bonus", { precision: 10, scale: 2 }).default("0"),
  performanceBonus: decimal("performance_bonus", { precision: 10, scale: 2 }).default("0"),
  otherBonus: decimal("other_bonus", { precision: 10, scale: 2 }).default("0"),
  totalBonus: decimal("total_bonus", { precision: 12, scale: 2 }).default("0"), // Sum of all bonuses
  
  // Final Calculations (simplified)
  grossPayment: decimal("gross_payment", { precision: 12, scale: 2 }).notNull(), // Base Payment + Total Bonus
  finalPayment: decimal("final_payment", { precision: 12, scale: 2 }).notNull(), // Gross Payment (no deductions)
  
  // Payment Information
  paymentMethod: text("payment_method").notNull().default("bank_transfer"), // "cash", "bank_transfer", "mobile_banking"
  paymentStatus: text("payment_status").notNull().default("unpaid"), // "paid", "unpaid"
  
  // Approval Information
  salaryApprovalStatus: text("salary_approval_status").notNull().default("pending"), // "pending", "approved", "rejected"
  
  // Additional Information
  remarks: text("remarks"),
  month: text("month").notNull(), // "YYYY-MM" format
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    paymentMethodCheck: sql`CHECK (${table.paymentMethod} IN ('cash', 'bank_transfer', 'mobile_banking'))`,
    paymentStatusCheck: sql`CHECK (${table.paymentStatus} IN ('paid', 'unpaid'))`,
    salaryApprovalStatusCheck: sql`CHECK (${table.salaryApprovalStatus} IN ('pending', 'approved', 'rejected'))`,
    uniqueEmployeeMonth: sql`UNIQUE(${table.employeeId}, ${table.month})`
  }
});

// Daily Campaign Spend Tracking
export const campaignDailySpends = pgTable("campaign_daily_spends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
  date: timestamp("date").notNull(), // Store as date normalized to start of day
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    // Unique constraint: one entry per campaign per day (date must be normalized to start of day)
    uniqueCampaignDate: unique("unique_campaign_date").on(table.campaignId, table.date)
  }
});

// Ad Copy Sets for Campaign Management
export const adCopySets = pgTable("ad_copy_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
  setName: text("set_name").notNull(),
  isActive: boolean("is_active").default(false),
  // Facebook Asset Level Details
  age: text("age"),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  adType: text("ad_type"),
  creativeLink: text("creative_link"),
  headline: text("headline"),
  description: text("description"),
  callToAction: text("call_to_action"),
  targetAudience: text("target_audience"),
  placement: text("placement"),
  schedule: text("schedule"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Work Reports
export const workReports = pgTable("work_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  hoursWorked: decimal("hours_worked", { precision: 4, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  status: text("status").notNull().default("submitted"), // "draft", "submitted", "approved"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Page definitions for access control
export const pages = pgTable("pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageKey: text("page_key").notNull().unique(), // e.g., "dashboard", "campaigns", "clients"
  displayName: text("display_name").notNull(), // e.g., "Dashboard", "Campaign Management"
  path: text("path").notNull(), // e.g., "/", "/campaigns", "/clients"
  description: text("description"), // Optional description of the page
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Role-based page permissions
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: text("role").notNull(), // "user", "manager", "admin", "super_admin"
  pageId: varchar("page_id").references(() => pages.id, { onDelete: "cascade" }).notNull(),
  canView: boolean("can_view").default(false),
  canEdit: boolean("can_edit").default(false),
  canDelete: boolean("can_delete").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    roleCheck: sql`CHECK (${table.role} IN ('user', 'manager', 'admin', 'super_admin'))`,
    uniqueRolePage: sql`UNIQUE(${table.role}, ${table.pageId})`
  }
});

// Validation schemas with role constraints
const UserRoleEnum = z.enum([UserRole.USER, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CLIENT]);

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  username: true,
  password: true,
}).extend({
  name: z.string().min(1, "Name is required"),
  password: z.string().min(3, "Password must be at least 3 characters"),
});

// Admin-only user creation schema (for super admins)
export const insertUserWithRoleSchema = insertUserSchema.extend({
  role: UserRoleEnum.default(UserRole.USER),
  clientId: z.string().optional(),
});

export const insertAdAccountSchema = createInsertSchema(adAccounts).omit({
  id: true,
  totalSpend: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDate: z.coerce.date(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalarySchema = createInsertSchema(salaries).omit({
  id: true,
  hourlyRate: true, // Auto-calculated
  basePayment: true, // Auto-calculated
  totalBonus: true, // Auto-calculated
  grossPayment: true, // Auto-calculated
  finalPayment: true, // Auto-calculated
  createdAt: true,
  updatedAt: true,
}).extend({
  basicSalary: z.coerce.number().min(0.01, "Basic salary must be greater than 0"),
  contractualHours: z.coerce.number().int().min(1, "Contractual hours must be at least 1"),
  actualWorkingHours: z.coerce.number().min(0, "Actual working hours must be positive"),
  festivalBonus: z.coerce.number().min(0, "Festival bonus must be positive").optional(),
  performanceBonus: z.coerce.number().min(0, "Performance bonus must be positive").optional(),
  otherBonus: z.coerce.number().min(0, "Other bonus must be positive").optional(),
});

export const insertWorkReportSchema = createInsertSchema(workReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  date: z.coerce.date(),
  hoursWorked: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0.1;
  }, "Hours worked must be a valid number of at least 0.1"),
});

export const insertAdCopySetSchema = createInsertSchema(adCopySets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignDailySpendSchema = createInsertSchema(campaignDailySpends).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  date: z.coerce.date(),
  amount: z.coerce.number().min(0, "Amount must be a positive number"),
});

export const insertPageSchema = createInsertSchema(pages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  role: UserRoleEnum,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Finance Management Tables

// Tags for categorization
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3B82F6"), // Default blue color
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Employees for finance tracking (separate from users)
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  department: text("department"),
  position: text("position"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Projects for finance tracking
export const financeProjects = pgTable("finance_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "restrict" }).notNull(),
  startDate: timestamp("start_date").notNull(),
  budget: decimal("budget", { precision: 12, scale: 2 }).notNull(), // USD
  expense: decimal("expense", { precision: 12, scale: 2 }).default("0"), // BDT
  status: text("status").notNull().default("active"), // "active", "closed"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payments from clients
export const financePayments = pgTable("finance_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "restrict" }).notNull(),
  projectId: varchar("project_id").references(() => financeProjects.id, { onDelete: "restrict" }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // USD
  conversionRate: decimal("conversion_rate", { precision: 8, scale: 4 }).notNull(), // USD to BDT rate
  convertedAmount: decimal("converted_amount", { precision: 12, scale: 2 }).notNull(), // BDT
  currency: text("currency").notNull().default("USD"),
  date: timestamp("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Expenses and Salaries
export const financeExpenses = pgTable("finance_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // "expense", "salary"
  projectId: varchar("project_id").references(() => financeProjects.id, { onDelete: "restrict" }),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "restrict" }), // Employee reference for salaries
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // BDT
  currency: text("currency").notNull().default("BDT"),
  date: timestamp("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Settings for exchange rates and configurations
export const financeSettings = pgTable("finance_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // "usd_to_bdt_rate", etc.
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for finance tables
export const insertFinanceProjectSchema = createInsertSchema(financeProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDate: z.coerce.date(),
  budget: z.coerce.number().min(0, "Budget must be a positive number"),
  expense: z.coerce.number().min(0, "Expense must be a positive number").optional(),
});

export const insertFinancePaymentSchema = createInsertSchema(financePayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  date: z.coerce.date(),
});

export const insertFinanceExpenseSchema = createInsertSchema(financeExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  date: z.coerce.date(),
});

export const insertFinanceSettingSchema = createInsertSchema(financeSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Telegram Configuration
export const telegramConfig = pgTable("telegram_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  botToken: text("bot_token"), // Encrypted storage for bot token
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Telegram Chat IDs for notifications
export const telegramChatIds = pgTable("telegram_chat_ids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: text("chat_id").notNull().unique(),
  name: text("name").notNull(), // Friendly name for the chat
  description: text("description"), // Optional description
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTelegramConfigSchema = createInsertSchema(telegramConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTelegramChatIdSchema = createInsertSchema(telegramChatIds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User Menu Permissions - Controls access to specific menu items per user
export const userMenuPermissions = pgTable("user_menu_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  dashboard: boolean("dashboard").default(false),
  campaignManagement: boolean("campaign_management").default(false),
  clientManagement: boolean("client_management").default(false),
  adAccounts: boolean("ad_accounts").default(false),
  workReports: boolean("work_reports").default(false),
  advantixDashboard: boolean("advantix_dashboard").default(false),
  projects: boolean("projects").default(false),
  payments: boolean("payments").default(false),
  expensesSalaries: boolean("expenses_salaries").default(false),
  salaryManagement: boolean("salary_management").default(false),
  reports: boolean("reports").default(false),
  fbAdManagement: boolean("fb_ad_management").default(false),
  advantixAdsManager: boolean("advantix_ads_manager").default(false),
  ownFarming: boolean("own_farming").default(false),
  newCreated: boolean("new_created").default(false),
  farmingAccounts: boolean("farming_accounts").default(false),
  adminPanel: boolean("admin_panel").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    uniqueUser: sql`UNIQUE(${table.userId})`
  }
});

export const insertUserMenuPermissionSchema = createInsertSchema(userMenuPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertUserWithRole = z.infer<typeof insertUserWithRoleSchema>;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type LoginRequest = z.infer<typeof loginSchema>;

export type InsertUserMenuPermission = z.infer<typeof insertUserMenuPermissionSchema>;
export type UserMenuPermission = typeof userMenuPermissions.$inferSelect;

export type InsertAdAccount = z.infer<typeof insertAdAccountSchema>;
export type AdAccount = typeof adAccounts.$inferSelect;

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertSalary = z.infer<typeof insertSalarySchema>;
export type Salary = typeof salaries.$inferSelect;

export type InsertWorkReport = z.infer<typeof insertWorkReportSchema>;
export type WorkReport = typeof workReports.$inferSelect;

export type InsertAdCopySet = z.infer<typeof insertAdCopySetSchema>;
export type AdCopySet = typeof adCopySets.$inferSelect;

export type InsertCampaignDailySpend = z.infer<typeof insertCampaignDailySpendSchema>;
export type CampaignDailySpend = typeof campaignDailySpends.$inferSelect;

export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pages.$inferSelect;

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// Finance types
export type InsertFinanceProject = z.infer<typeof insertFinanceProjectSchema>;
export type FinanceProject = typeof financeProjects.$inferSelect;

export type InsertFinancePayment = z.infer<typeof insertFinancePaymentSchema>;
export type FinancePayment = typeof financePayments.$inferSelect;

export type InsertFinanceExpense = z.infer<typeof insertFinanceExpenseSchema>;
export type FinanceExpense = typeof financeExpenses.$inferSelect;

export type InsertFinanceSetting = z.infer<typeof insertFinanceSettingSchema>;
export type FinanceSetting = typeof financeSettings.$inferSelect;

export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export type InsertTelegramConfig = z.infer<typeof insertTelegramConfigSchema>;
export type TelegramConfig = typeof telegramConfig.$inferSelect;

export type InsertTelegramChatId = z.infer<typeof insertTelegramChatIdSchema>;
export type TelegramChatId = typeof telegramChatIds.$inferSelect;

// Facebook App Settings
export const facebookSettings = pgTable("facebook_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appId: text("app_id").notNull(),
  appSecret: text("app_secret").notNull(),
  accessToken: text("access_token").notNull(),
  isConnected: boolean("is_connected").default(false),
  lastTestedAt: timestamp("last_tested_at"),
  connectionError: text("connection_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFacebookSettingSchema = createInsertSchema(facebookSettings).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFacebookSetting = z.infer<typeof insertFacebookSettingSchema>;
export type FacebookSetting = typeof facebookSettings.$inferSelect;

// Client Mailbox Schemas
export const clientMailboxEmailSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  emailType: z.enum([
    "custom",
    "activation", 
    "suspension",
    "welcome",
    "monthly_report",
    "payment_reminder",
    "campaign_launch",
    "budget_alert",
    "thank_you"
  ], {
    required_error: "Email type is required",
  }),
  subject: z.string().optional(),
  customMessage: z.string().optional(),
  adAccountId: z.string().optional(),
}).refine((data) => {
  // Custom messages require the customMessage field
  if (data.emailType === "custom") {
    return !!data.customMessage && data.customMessage.trim().length > 0;
  }
  return true;
}, {
  message: "Custom messages require a message body",
  path: ["customMessage"],
}).refine((data) => {
  // Activation and suspension require adAccountId
  if (data.emailType === "activation" || data.emailType === "suspension") {
    return !!data.adAccountId && data.adAccountId.trim().length > 0;
  }
  return true;
}, {
  message: "Activation and suspension emails require an ad account selection",
  path: ["adAccountId"],
});

export type ClientMailboxEmail = z.infer<typeof clientMailboxEmailSchema>;

// Email Settings
export const emailSettings = pgTable("email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().default("resend"), // "resend", "sendgrid", "mailgun"
  apiKey: text("api_key").notNull(),
  senderEmail: text("sender_email").notNull(),
  senderName: text("sender_name").notNull(),
  enableNotifications: boolean("enable_notifications").default(false),
  enableNewAdAlerts: boolean("enable_new_ad_alerts").default(true),
  enableDailySummary: boolean("enable_daily_summary").default(true),
  dailySummaryTime: text("daily_summary_time").default("07:00"), // Time in HH:mm format
  isConfigured: boolean("is_configured").default(false),
  lastTestedAt: timestamp("last_tested_at"),
  connectionError: text("connection_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailSettingSchema = createInsertSchema(emailSettings).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmailSetting = z.infer<typeof insertEmailSettingSchema>;
export type EmailSetting = typeof emailSettings.$inferSelect;

// SMS Settings
export const smsSettings = pgTable("sms_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().default("bdbulksms"), // "bdbulksms", "smsinbd", "smsnetbd", "twilio"
  apiKey: text("api_key").notNull(),
  senderId: text("sender_id").notNull(), // Sender ID or masking name
  enableNotifications: boolean("enable_notifications").default(false),
  enableAdActiveAlerts: boolean("enable_ad_active_alerts").default(true),
  enableDailySummary: boolean("enable_daily_summary").default(true),
  dailySummaryTime: text("daily_summary_time").default("07:00"), // Time in HH:mm format
  isConfigured: boolean("is_configured").default(false),
  lastTestedAt: timestamp("last_tested_at"),
  connectionError: text("connection_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSmsSettingSchema = createInsertSchema(smsSettings).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSmsSetting = z.infer<typeof insertSmsSettingSchema>;
export type SmsSetting = typeof smsSettings.$inferSelect;

// Client Email Preferences
export const clientEmailPreferences = pgTable("client_email_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull().unique(),
  enableNotifications: boolean("enable_notifications").default(false),
  enableAdAccountActivationAlerts: boolean("enable_ad_account_activation_alerts").default(false),
  enableAdAccountSuspensionAlerts: boolean("enable_ad_account_suspension_alerts").default(false),
  enableSpendWarnings: boolean("enable_spend_warnings").default(false),
  spendWarningThreshold: integer("spend_warning_threshold").default(80),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientEmailPreferenceSchema = createInsertSchema(clientEmailPreferences).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClientEmailPreference = z.infer<typeof insertClientEmailPreferenceSchema>;
export type ClientEmailPreference = typeof clientEmailPreferences.$inferSelect;

// Facebook Ad Account Insights
export const facebookAccountInsights = pgTable("facebook_account_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adAccountId: varchar("ad_account_id").references(() => adAccounts.id, { onDelete: "cascade" }).notNull(),
  date: timestamp("date").notNull(),
  spend: decimal("spend", { precision: 12, scale: 2 }).default("0"),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  ctr: decimal("ctr", { precision: 10, scale: 4 }).default("0"), // Click-through rate
  cpc: decimal("cpc", { precision: 10, scale: 4 }).default("0"), // Cost per click
  cpm: decimal("cpm", { precision: 10, scale: 4 }).default("0"), // Cost per mille
  reach: integer("reach").default(0),
  frequency: decimal("frequency", { precision: 10, scale: 2 }).default("0"),
  conversions: integer("conversions").default(0),
  costPerConversion: decimal("cost_per_conversion", { precision: 10, scale: 4 }).default("0"),
  conversionRate: decimal("conversion_rate", { precision: 10, scale: 4 }).default("0"),
  roas: decimal("roas", { precision: 10, scale: 4 }).default("0"), // Return on ad spend
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    uniqueAccountDate: unique().on(table.adAccountId, table.date)
  }
});

export const insertFacebookAccountInsightSchema = createInsertSchema(facebookAccountInsights).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFacebookAccountInsight = z.infer<typeof insertFacebookAccountInsightSchema>;
export type FacebookAccountInsight = typeof facebookAccountInsights.$inferSelect;

// Facebook Campaign Insights
export const facebookCampaignInsights = pgTable("facebook_campaign_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adAccountId: varchar("ad_account_id").references(() => adAccounts.id, { onDelete: "cascade" }).notNull(),
  fbCampaignId: text("fb_campaign_id").notNull(), // Facebook's campaign ID
  campaignName: text("campaign_name").notNull(),
  status: text("status").default("ACTIVE"), // Campaign status: ACTIVE, PAUSED, ARCHIVED, DELETED
  objective: text("objective"), // Campaign objective: OUTCOME_ENGAGEMENT, OUTCOME_SALES, etc.
  dailyBudget: decimal("daily_budget", { precision: 12, scale: 2 }), // Daily budget
  date: timestamp("date").notNull(),
  spend: decimal("spend", { precision: 12, scale: 2 }).default("0"),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  ctr: decimal("ctr", { precision: 10, scale: 4 }).default("0"),
  cpc: decimal("cpc", { precision: 10, scale: 4 }).default("0"),
  cpm: decimal("cpm", { precision: 10, scale: 4 }).default("0"),
  reach: integer("reach").default(0),
  frequency: decimal("frequency", { precision: 10, scale: 2 }).default("0"),
  conversions: integer("conversions").default(0),
  costPerConversion: decimal("cost_per_conversion", { precision: 10, scale: 4 }).default("0"),
  conversionRate: decimal("conversion_rate", { precision: 10, scale: 4 }).default("0"),
  roas: decimal("roas", { precision: 10, scale: 4 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    uniqueCampaignDate: unique().on(table.fbCampaignId, table.date)
  }
});

export const insertFacebookCampaignInsightSchema = createInsertSchema(facebookCampaignInsights).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFacebookCampaignInsight = z.infer<typeof insertFacebookCampaignInsightSchema>;
export type FacebookCampaignInsight = typeof facebookCampaignInsights.$inferSelect;

// Facebook Ad Set Insights
export const facebookAdSetInsights = pgTable("facebook_adset_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fbCampaignId: text("fb_campaign_id").notNull(),
  fbAdSetId: text("fb_adset_id").notNull(), // Facebook's ad set ID
  adSetName: text("adset_name").notNull(),
  date: timestamp("date").notNull(),
  spend: decimal("spend", { precision: 12, scale: 2 }).default("0"),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  ctr: decimal("ctr", { precision: 10, scale: 4 }).default("0"),
  cpc: decimal("cpc", { precision: 10, scale: 4 }).default("0"),
  cpm: decimal("cpm", { precision: 10, scale: 4 }).default("0"),
  conversions: integer("conversions").default(0),
  roas: decimal("roas", { precision: 10, scale: 4 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    uniqueAdSetDate: unique().on(table.fbAdSetId, table.date)
  }
});

export const insertFacebookAdSetInsightSchema = createInsertSchema(facebookAdSetInsights).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFacebookAdSetInsight = z.infer<typeof insertFacebookAdSetInsightSchema>;
export type FacebookAdSetInsight = typeof facebookAdSetInsights.$inferSelect;

// Facebook Ad Insights
export const facebookAdInsights = pgTable("facebook_ad_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fbAdSetId: text("fb_adset_id").notNull(),
  fbAdId: text("fb_ad_id").notNull(), // Facebook's ad ID
  adName: text("ad_name").notNull(),
  date: timestamp("date").notNull(),
  spend: decimal("spend", { precision: 12, scale: 2 }).default("0"),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  ctr: decimal("ctr", { precision: 10, scale: 4 }).default("0"),
  cpc: decimal("cpc", { precision: 10, scale: 4 }).default("0"),
  cpm: decimal("cpm", { precision: 10, scale: 4 }).default("0"),
  conversions: integer("conversions").default(0),
  roas: decimal("roas", { precision: 10, scale: 4 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    uniqueAdDate: unique().on(table.fbAdId, table.date)
  }
});

export const insertFacebookAdInsightSchema = createInsertSchema(facebookAdInsights).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFacebookAdInsight = z.infer<typeof insertFacebookAdInsightSchema>;
export type FacebookAdInsight = typeof facebookAdInsights.$inferSelect;

export const facebookPages = pgTable("facebook_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  facebookPageId: text("facebook_page_id").notNull().unique(),
  pageName: text("page_name").notNull(),
  category: text("category"),
  profilePictureUrl: text("profile_picture_url"),
  accessToken: text("access_token"),
  adAccountId: varchar("ad_account_id").references(() => adAccounts.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFacebookPageSchema = createInsertSchema(facebookPages).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFacebookPage = z.infer<typeof insertFacebookPageSchema>;
export type FacebookPage = typeof facebookPages.$inferSelect;

// Campaign Drafts - Store in-progress campaigns before publishing to Facebook
export const campaignDrafts = pgTable("campaign_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  draftName: text("draft_name").notNull(),
  adAccountId: varchar("ad_account_id").references(() => adAccounts.id, { onDelete: "cascade" }).notNull(),
  pageId: varchar("page_id").references(() => facebookPages.id, { onDelete: "set null" }),
  
  // Campaign Configuration
  objective: text("objective"), // OUTCOME_ENGAGEMENT, OUTCOME_SALES, OUTCOME_LEADS, etc.
  campaignName: text("campaign_name"),
  
  // Budget & Schedule
  budgetType: text("budget_type"), // "daily" or "lifetime"
  dailyBudget: decimal("daily_budget", { precision: 12, scale: 2 }),
  lifetimeBudget: decimal("lifetime_budget", { precision: 12, scale: 2 }),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  
  // Targeting (stored as JSON)
  targeting: text("targeting"), // JSON string with audience targeting
  
  // Creative Assets
  adSetName: text("adset_name"),
  adName: text("ad_name"),
  adCopy: text("ad_copy"),
  headline: text("headline"),
  description: text("description"),
  callToAction: text("call_to_action"),
  websiteUrl: text("website_url"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  
  // Metadata
  status: text("status").default("draft"), // "draft", "ready", "publishing", "published", "failed"
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  publishedCampaignId: text("published_campaign_id"), // Facebook campaign ID after publishing
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCampaignDraftSchema = createInsertSchema(campaignDrafts).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCampaignDraft = z.infer<typeof insertCampaignDraftSchema>;
export type CampaignDraft = typeof campaignDrafts.$inferSelect;

// Campaign Templates - Reusable campaign configurations
export const campaignTemplates = pgTable("campaign_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateName: text("template_name").notNull(),
  description: text("description"),
  
  // Template Configuration (same structure as drafts)
  objective: text("objective"),
  budgetType: text("budget_type"),
  defaultDailyBudget: decimal("default_daily_budget", { precision: 12, scale: 2 }),
  defaultLifetimeBudget: decimal("default_lifetime_budget", { precision: 12, scale: 2 }),
  targeting: text("targeting"), // JSON string
  adCopy: text("ad_copy"),
  headline: text("headline"),
  adDescription: text("ad_description"),
  callToAction: text("call_to_action"),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  usageCount: integer("usage_count").default(0),
  isShared: boolean("is_shared").default(false), // Can other team members use it?
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCampaignTemplateSchema = createInsertSchema(campaignTemplates).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCampaignTemplate = z.infer<typeof insertCampaignTemplateSchema>;
export type CampaignTemplate = typeof campaignTemplates.$inferSelect;

// Saved Audiences - Reusable targeting configurations
export const savedAudiences = pgTable("saved_audiences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  audienceName: text("audience_name").notNull(),
  description: text("description"),
  
  // Targeting Configuration (stored as JSON for flexibility)
  targetingConfig: text("targeting_config").notNull(), // JSON with age, gender, locations, interests, behaviors
  
  // Metadata
  estimatedSize: integer("estimated_size"), // Estimated reach
  createdBy: varchar("created_by").references(() => users.id),
  usageCount: integer("usage_count").default(0),
  isShared: boolean("is_shared").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSavedAudienceSchema = createInsertSchema(savedAudiences).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSavedAudience = z.infer<typeof insertSavedAudienceSchema>;
export type SavedAudience = typeof savedAudiences.$inferSelect;

// Farming Accounts - For managing Facebook/TikTok farming accounts
export const farmingAccounts = pgTable("farming_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic Information
  comment: text("comment"),
  socialMedia: text("social_media").notNull(), // "facebook", "tiktok"
  vaId: varchar("va_id").references(() => users.id, { onDelete: "set null" }), // Virtual Assistant (user)
  status: text("status").notNull().default("new"), // "new", "farming", "active", "suspended", "banned"
  idName: text("id_name").notNull(), // Account ID/Name
  email: text("email").notNull(),
  
  // Sensitive Fields (admin-only access)
  recoveryEmail: text("recovery_email"),
  password: text("password").notNull(),
  twoFaSecret: text("two_fa_secret"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    socialMediaCheck: sql`CHECK (${table.socialMedia} IN ('facebook', 'tiktok'))`,
    statusCheck: sql`CHECK (${table.status} IN ('new', 'farming', 'active', 'suspended', 'banned'))`,
  };
});

export const insertFarmingAccountSchema = createInsertSchema(farmingAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  recoveryEmail: z.string().email().optional().or(z.literal('')),
  password: z.string().min(1, "Password is required"),
  twoFaSecret: z.string().optional().or(z.literal('')),
});

export type InsertFarmingAccount = z.infer<typeof insertFarmingAccountSchema>;
export type FarmingAccount = typeof farmingAccounts.$inferSelect;

// Type for decrypted account (only returned to admin users)
export interface FarmingAccountWithSecrets extends FarmingAccount {
  passwordDecrypted: string; // Copy of password field for consistency with frontend
}

// Gher Management - Expense/Income tracking with partners
export const gherTags = pgTable("gher_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gherPartners = pgTable("gher_partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gherEntries = pgTable("gher_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  type: text("type").notNull(), // "income" or "expense"
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  details: text("details"),
  tagId: varchar("tag_id").references(() => gherTags.id, { onDelete: "set null" }),
  partnerId: varchar("partner_id").references(() => gherPartners.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    typeCheck: sql`CHECK (${table.type} IN ('income', 'expense'))`
  }
});

export const insertGherTagSchema = createInsertSchema(gherTags).omit({ id: true, createdAt: true });
export type InsertGherTag = z.infer<typeof insertGherTagSchema>;
export type GherTag = typeof gherTags.$inferSelect;

export const insertGherPartnerSchema = createInsertSchema(gherPartners).omit({ id: true, createdAt: true });
export type InsertGherPartner = z.infer<typeof insertGherPartnerSchema>;
export type GherPartner = typeof gherPartners.$inferSelect;

export const insertGherEntrySchema = createInsertSchema(gherEntries).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
});
export type InsertGherEntry = z.infer<typeof insertGherEntrySchema>;
export type GherEntry = typeof gherEntries.$inferSelect;
