import { 
  type User, 
  type InsertUser, 
  type Session, 
  type LoginRequest,
  type Campaign,
  type InsertCampaign,
  type Client,
  type InsertClient,
  type AdAccount,
  type InsertAdAccount,
  type AdCopySet,
  type InsertAdCopySet,
  type CampaignDailySpend,
  type InsertCampaignDailySpend,
  type WorkReport,
  type InsertWorkReport,
  type Page,
  type InsertPage,
  type RolePermission,
  type InsertRolePermission,
  type FinanceProject,
  type InsertFinanceProject,
  type FinancePayment,
  type InsertFinancePayment,
  type FinanceExpense,
  type InsertFinanceExpense,
  type FinanceSetting,
  type InsertFinanceSetting,
  type Tag,
  type InsertTag,
  type Employee,
  type InsertEmployee,
  type UserMenuPermission,
  type InsertUserMenuPermission,
  type Salary,
  type InsertSalary,
  type TelegramConfig,
  type InsertTelegramConfig,
  type TelegramChatId,
  type InsertTelegramChatId,
  type FarmingAccount,
  type InsertFarmingAccount,
  type FarmingAccountWithSecrets,
  type GherAuditLog,
  type InsertGherAuditLog,
  type PaginatedResponse,
  UserRole
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getClientUsers(): Promise<User[]>; // Get all users with role='client'
  validateCredentials(username: string, password: string): Promise<User | null>;
  
  // Session methods
  createSession(userId: string): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<void>;
  
  // Campaign methods
  getCampaigns(clientId?: string): Promise<Campaign[]>; // Optional clientId for filtering
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, campaign: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;
  
  // Campaign Daily Spend methods
  getCampaignDailySpends(campaignId: string): Promise<CampaignDailySpend[]>;
  getCampaignDailySpend(campaignId: string, date: string): Promise<CampaignDailySpend | undefined>;
  upsertCampaignDailySpend(spend: InsertCampaignDailySpend): Promise<CampaignDailySpend>;
  getCampaignTotalSpend(campaignId: string): Promise<number>;
  
  // Client methods
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  
  // Ad Account methods
  getAdAccounts(clientId?: string): Promise<AdAccount[]>; // Optional clientId for filtering
  getAdAccount(id: string): Promise<AdAccount | undefined>;
  createAdAccount(adAccount: InsertAdAccount): Promise<AdAccount>;
  updateAdAccount(id: string, adAccount: Partial<InsertAdAccount>): Promise<AdAccount | undefined>;
  deleteAdAccount(id: string): Promise<boolean>;
  
  // Ad Copy Set methods
  getAdCopySets(campaignId: string): Promise<AdCopySet[]>;
  getAllAdCopySets(): Promise<AdCopySet[]>; // Get all ad copy sets without campaign filter
  getAdCopySet(id: string): Promise<AdCopySet | undefined>;
  createAdCopySet(adCopySet: InsertAdCopySet): Promise<AdCopySet>;
  updateAdCopySet(id: string, adCopySet: Partial<InsertAdCopySet>): Promise<AdCopySet | undefined>;
  deleteAdCopySet(id: string): Promise<boolean>;
  setActiveAdCopySet(campaignId: string, setId: string): Promise<boolean>;
  
  // Work Report methods
  getWorkReports(userId?: string): Promise<WorkReport[]>; // If userId provided, filter by user; otherwise get all (admin only)
  getWorkReport(id: string): Promise<WorkReport | undefined>;
  createWorkReport(workReport: InsertWorkReport): Promise<WorkReport>;
  updateWorkReport(id: string, workReport: Partial<InsertWorkReport>): Promise<WorkReport | undefined>;
  deleteWorkReport(id: string): Promise<boolean>;
  deleteAllWorkReports(): Promise<number>; // Returns count of deleted reports
  
  // Page methods
  getPages(): Promise<Page[]>;
  getPage(id: string): Promise<Page | undefined>;
  getPageByKey(pageKey: string): Promise<Page | undefined>;
  createPage(page: InsertPage): Promise<Page>;
  updatePage(id: string, page: Partial<InsertPage>): Promise<Page | undefined>;
  deletePage(id: string): Promise<boolean>;
  
  // Role Permission methods
  getRolePermissions(role?: string): Promise<RolePermission[]>; // If role provided, filter by role; otherwise get all
  getRolePermission(id: string): Promise<RolePermission | undefined>;
  getRolePermissionByRoleAndPage(role: string, pageId: string): Promise<RolePermission | undefined>;
  createRolePermission(permission: InsertRolePermission): Promise<RolePermission>;
  updateRolePermission(id: string, permission: Partial<InsertRolePermission>): Promise<RolePermission | undefined>;
  deleteRolePermission(id: string): Promise<boolean>;
  checkUserPagePermission(userId: string, pageKey: string, action: 'view' | 'edit' | 'delete'): Promise<boolean>;
  getUserAccessibleMenus(userId: string): Promise<{ pageKey: string; route: string; name: string }[]>;

  // Finance Project methods
  getFinanceProjects(): Promise<FinanceProject[]>;
  getFinanceProject(id: string): Promise<FinanceProject | undefined>;
  createFinanceProject(project: InsertFinanceProject): Promise<FinanceProject>;
  updateFinanceProject(id: string, project: Partial<InsertFinanceProject>): Promise<FinanceProject | undefined>;
  deleteFinanceProject(id: string): Promise<boolean>;

  // Finance Payment methods
  getFinancePayments(projectId?: string): Promise<FinancePayment[]>;
  getFinancePayment(id: string): Promise<FinancePayment | undefined>;
  createFinancePayment(payment: InsertFinancePayment): Promise<FinancePayment>;
  updateFinancePayment(id: string, payment: Partial<InsertFinancePayment>): Promise<FinancePayment | undefined>;
  deleteFinancePayment(id: string): Promise<boolean>;

  // Finance Expense methods
  getFinanceExpenses(projectId?: string): Promise<FinanceExpense[]>;
  getFinanceExpense(id: string): Promise<FinanceExpense | undefined>;
  createFinanceExpense(expense: InsertFinanceExpense): Promise<FinanceExpense>;
  updateFinanceExpense(id: string, expense: Partial<InsertFinanceExpense>): Promise<FinanceExpense | undefined>;
  deleteFinanceExpense(id: string): Promise<boolean>;
  deleteAllFinanceExpenses(): Promise<number>;

  // Finance Settings methods
  getFinanceSetting(key: string): Promise<FinanceSetting | undefined>;
  getAllFinanceSettings(): Promise<FinanceSetting[]>; // Get all finance settings
  setFinanceSetting(setting: InsertFinanceSetting): Promise<FinanceSetting>;
  getExchangeRate(): Promise<number>; // Helper to get USD to BDT rate

  // Tag methods
  getTags(): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, tag: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<boolean>;

  // Salary methods
  getSalaries(): Promise<Salary[]>;
  getSalary(id: string): Promise<Salary | undefined>;
  createSalary(salary: InsertSalary): Promise<Salary>;
  updateSalary(id: string, salary: Partial<InsertSalary>): Promise<Salary | undefined>;
  deleteSalary(id: string): Promise<boolean>;

  // Employee methods
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;

  // User Menu Permission methods
  getUserMenuPermissions(userId?: string): Promise<UserMenuPermission[]>; // If userId provided, filter by user; otherwise get all
  getUserMenuPermission(userId: string): Promise<UserMenuPermission | undefined>;
  createUserMenuPermission(permission: InsertUserMenuPermission): Promise<UserMenuPermission>;
  updateUserMenuPermission(userId: string, permission: Partial<InsertUserMenuPermission>): Promise<UserMenuPermission | undefined>;
  deleteUserMenuPermission(userId: string): Promise<boolean>;

  // Telegram Configuration methods
  getTelegramConfig(): Promise<TelegramConfig | undefined>;
  createTelegramConfig(config: InsertTelegramConfig): Promise<TelegramConfig>;
  updateTelegramConfig(config: Partial<InsertTelegramConfig>): Promise<TelegramConfig | undefined>;
  deleteTelegramConfig(): Promise<boolean>;

  // Telegram Chat ID methods
  getTelegramChatIds(): Promise<TelegramChatId[]>;
  getTelegramChatId(id: string): Promise<TelegramChatId | undefined>;
  createTelegramChatId(chatId: InsertTelegramChatId): Promise<TelegramChatId>;
  updateTelegramChatId(id: string, chatId: Partial<InsertTelegramChatId>): Promise<TelegramChatId | undefined>;
  deleteTelegramChatId(id: string): Promise<boolean>;

  // Facebook Settings methods
  getFacebookSettings(): Promise<any>;
  saveFacebookSettings(data: any): Promise<any>;
  updateFacebookConnectionStatus(isConnected: boolean, error?: string): Promise<void>;

  // Email Settings methods
  getEmailSettings(): Promise<any>;
  saveEmailSettings(data: any): Promise<any>;
  updateEmailConnectionStatus(isConfigured: boolean, error?: string): Promise<void>;

  // SMS Settings methods
  getSmsSettings(): Promise<any>;
  saveSmsSettings(data: any): Promise<any>;
  updateSmsConnectionStatus(isConfigured: boolean, error?: string): Promise<void>;

  // Client Email Preferences methods
  getClientEmailPreferences(clientId: string): Promise<any>;
  getAllClientEmailPreferences(): Promise<any[]>;
  saveClientEmailPreferences(clientId: string, preferences: any): Promise<any>;

  // Facebook Account Insights methods
  getFacebookAccountInsights(adAccountId: string, startDate: Date, endDate: Date): Promise<any[]>;
  upsertFacebookAccountInsight(data: any): Promise<any>;

  // Facebook Campaign Insights methods
  getFacebookCampaignInsights(adAccountId: string, startDate: Date, endDate: Date): Promise<any[]>;
  upsertFacebookCampaignInsight(data: any): Promise<any>;

  // Campaign Draft methods
  getCampaignDrafts(): Promise<any[]>;
  getCampaignDraftById(id: string): Promise<any>;
  createCampaignDraft(draft: any): Promise<any>;
  updateCampaignDraft(id: string, draft: any): Promise<any>;
  deleteCampaignDraft(id: string): Promise<void>;

  // Campaign Template methods
  getCampaignTemplates(): Promise<any[]>;

  // Saved Audience methods
  getSavedAudiences(): Promise<any[]>;

  // Ad Account by ID
  getAdAccountById(id: string): Promise<any>;

  // Farming Accounts methods
  getFarmingAccounts(filters?: { status?: string; socialMedia?: string; vaId?: string; search?: string }): Promise<FarmingAccount[]>;
  getFarmingAccount(id: string): Promise<FarmingAccount | undefined>;
  getFarmingAccountWithSecrets(id: string): Promise<FarmingAccountWithSecrets | undefined>; // Admin only
  createFarmingAccount(account: InsertFarmingAccount): Promise<FarmingAccount>;
  updateFarmingAccount(id: string, account: Partial<InsertFarmingAccount>): Promise<FarmingAccount | undefined>;
  deleteFarmingAccount(id: string): Promise<boolean>;
  importFarmingAccountsFromCsv(accounts: InsertFarmingAccount[]): Promise<{ success: number; errors: string[] }>;
  exportFarmingAccountsToCsv(includeSecrets: boolean): Promise<any[]>; // Admin only for secrets

  // Gher Management - Tags
  getGherTags(): Promise<any[]>;
  getGherTag(id: string): Promise<any | undefined>;
  createGherTag(tag: any): Promise<any>;
  updateGherTag(id: string, tag: any): Promise<any | undefined>;
  deleteGherTag(id: string): Promise<boolean>;

  // Gher Management - Partners
  getGherPartners(): Promise<any[]>;
  getGherPartner(id: string): Promise<any | undefined>;
  createGherPartner(partner: any): Promise<any>;
  updateGherPartner(id: string, partner: any): Promise<any | undefined>;
  deleteGherPartner(id: string): Promise<boolean>;

  // Gher Management - Capital Transactions
  getGherCapitalTransactions(partnerId?: string): Promise<any[]>;
  getGherCapitalTransaction(id: string): Promise<any | undefined>;
  createGherCapitalTransaction(transaction: any): Promise<any>;
  updateGherCapitalTransaction(id: string, transaction: any): Promise<any | undefined>;
  deleteGherCapitalTransaction(id: string): Promise<boolean>;
  getPartnerCapitalSummary(partnerId: string): Promise<{ invested: number; returned: number; withdrawn: number; outstanding: number }>;
  getPartnerAllocatedProfitLoss(partnerId: string): Promise<number>;

  // Gher Management - Entries
  getGherEntries(filters?: { startDate?: Date; endDate?: Date; partnerId?: string }): Promise<any[]>;
  getPaginatedGherEntries(params: { page: number; pageSize: number; filters?: { startDate?: Date; endDate?: Date; partnerId?: string; tagId?: string } }): Promise<any>;
  getGherEntry(id: string): Promise<any | undefined>;
  createGherEntry(entry: any): Promise<any>;
  updateGherEntry(id: string, entry: any): Promise<any | undefined>;
  deleteGherEntry(id: string): Promise<boolean>;
  deleteAllGherEntries(): Promise<number>;
  getGherDashboardStats(filters?: { startDate?: Date; endDate?: Date; partnerId?: string }): Promise<{ totalIncome: number; totalExpense: number; netBalance: number }>;
  
  // Gher Invoice Management
  getInvoicePreviewData(month: string): Promise<{
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    topIncomeTags: Array<{ tagId: string | null; tagName: string; amount: number; percentage: number }>;
    topExpenseTags: Array<{ tagId: string | null; tagName: string; amount: number; percentage: number }>;
    partnerMovements: Array<{
      partnerId: string | null;
      partnerName: string;
      contribution: number;
      return: number;
      withdrawn: number;
      net: number;
    }>;
    incomeEntries: any[];
    expenseEntries: any[];
  }>;
  getNextInvoiceSequence(yearMonth: string): Promise<number>;
  createInvoice(data: any): Promise<any>;
  getInvoice(id: string): Promise<any>;
  deleteInvoice(id: string): Promise<void>;
  listInvoices(month?: string): Promise<any[]>;
  
  // Audit Log methods
  logGherAuditEntry(event: InsertGherAuditLog): Promise<void>;
  listGherAuditLogs(filters?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    entityType?: string;
    actionType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<GherAuditLog>>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private sessions: Map<string, Session>;
  private campaigns: Map<string, Campaign>;
  private clients: Map<string, Client>;
  private adAccounts: Map<string, AdAccount>;
  private adCopySets: Map<string, AdCopySet>;
  private workReports: Map<string, WorkReport>;
  private pages: Map<string, Page>;
  private rolePermissions: Map<string, RolePermission>;
  private financeProjects: Map<string, FinanceProject>;
  private financePayments: Map<string, FinancePayment>;
  private financeExpenses: Map<string, FinanceExpense>;
  private financeSettings: Map<string, FinanceSetting>;
  private tags: Map<string, Tag>;
  private employees: Map<string, Employee>;
  private userMenuPermissions: Map<string, UserMenuPermission>;
  private salaries: Map<string, Salary>;
  private telegramConfig: TelegramConfig | undefined;
  private telegramChatIds: Map<string, TelegramChatId>;

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.campaigns = new Map();
    this.clients = new Map();
    this.adAccounts = new Map();
    this.adCopySets = new Map();
    this.workReports = new Map();
    this.pages = new Map();
    this.rolePermissions = new Map();
    this.financeProjects = new Map();
    this.financePayments = new Map();
    this.financeExpenses = new Map();
    this.financeSettings = new Map();
    this.tags = new Map();
    this.employees = new Map();
    this.userMenuPermissions = new Map();
    this.salaries = new Map();
    this.telegramConfig = undefined;
    this.telegramChatIds = new Map();
    
    // Initialize default finance settings
    this.initializeFinanceSettings();
    
    // Create default admin user
    const adminId = randomUUID();
    const adminUser: User = {
      id: adminId,
      name: "Administrator",
      username: "Admin",
      password: "2604", // In production, this should be hashed
      role: UserRole.SUPER_ADMIN,
      clientId: null,
      isActive: true,
      createdAt: new Date(),
    };
    this.users.set(adminId, adminUser);

    // Create sample clients for testing
    const client1Id = randomUUID();
    const client1: Client = {
      id: client1Id,
      clientName: "TechCorp Solutions",
      businessName: "TechCorp Inc.",
      contactPerson: "John Smith",
      email: "contact@techcorp.com",
      phone: "+1-555-0123",
      address: "123 Tech Street, Silicon Valley, CA",
      notes: "Enterprise client with multiple campaigns",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.clients.set(client1Id, client1);

    const client2Id = randomUUID();
    const client2: Client = {
      id: client2Id,
      clientName: "Marketing Pro",
      businessName: "Marketing Pro LLC",
      contactPerson: "Sarah Johnson",
      email: "hello@marketingpro.com",
      phone: "+1-555-0456",
      address: "456 Marketing Ave, New York, NY",
      notes: "High-volume advertising client",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.clients.set(client2Id, client2);

    const client3Id = randomUUID();
    const client3: Client = {
      id: client3Id,
      clientName: "Digital Dynamics",
      businessName: "Digital Dynamics Corp",
      contactPerson: "Mike Chen",
      email: "info@digitaldynamics.net",
      phone: "+1-555-0789",
      address: "789 Digital Blvd, Austin, TX",
      notes: "Tech startup focusing on social media",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.clients.set(client3Id, client3);

    // Initialize default pages and sample finance data
    this.initializeDefaultPages();
    this.initializeDefaultPermissions();
    this.initializeSampleFinanceData();
  }

  private initializeDefaultPages() {
    const defaultPages = [
      { pageKey: "dashboard", displayName: "Dashboard", path: "/", description: "Main dashboard with metrics and overview" },
      { pageKey: "campaigns", displayName: "Campaign Management", path: "/campaigns", description: "Manage advertising campaigns" },
      { pageKey: "campaign_details", displayName: "Campaign Details", path: "/campaigns/:id", description: "View and edit individual campaign details" },
      { pageKey: "clients", displayName: "Client Management", path: "/clients", description: "Manage client accounts and information" },
      { pageKey: "ad_accounts", displayName: "Ad Accounts", path: "/ad-accounts", description: "Manage advertising account connections" },
      { pageKey: "work_reports", displayName: "Work Reports", path: "/work-reports", description: "Track and submit work hours and tasks" },
      { pageKey: "client_mailbox", displayName: "Client Mailbox", path: "/client-mailbox", description: "Send manual emails to clients with custom reports" },
      { pageKey: "fb_ad_management", displayName: "FB Ad Management", path: "/fb-ad-management", description: "Manage Facebook advertising campaigns and accounts" },
      { pageKey: "advantix_ads_manager", displayName: "Advantix Ads Manager", path: "/advantix-ads", description: "Advanced advertising management tools" },
      { pageKey: "ownFarming", displayName: "Own Farming", path: "/own-farming", description: "Manage own farming accounts and activities" },
      { pageKey: "newCreated", displayName: "New Created", path: "/own-farming/new-created", description: "Newly created farming accounts" },
      { pageKey: "farmingAccounts", displayName: "Farming Accounts", path: "/own-farming/farming-accounts", description: "All farming account management" },
      { pageKey: "gher_management", displayName: "Gher Management", path: "/gher", description: "Gher business management system" },
      { pageKey: "gher_invoices", displayName: "Gher Invoices", path: "/gher/invoice", description: "Gher invoice management" },
      { pageKey: "finance", displayName: "Advantix Finance", path: "/finance", description: "Financial management and tracking" },
      { pageKey: "advantix_dashboard", displayName: "Advantix Dashboard", path: "/finance/dashboard", description: "Finance dashboard overview" },
      { pageKey: "projects", displayName: "Projects", path: "/finance/projects", description: "Project management and tracking" },
      { pageKey: "payments", displayName: "Payments", path: "/finance/payments", description: "Payment tracking and management" },
      { pageKey: "expenses_salaries", displayName: "Expenses & Salaries", path: "/finance/expenses-salaries", description: "Expense and salary management" },
      { pageKey: "salary_management", displayName: "Salary Management", path: "/salaries", description: "Employee salary management" },
      { pageKey: "reports", displayName: "Reports", path: "/finance/reports", description: "Financial reports and analytics" },
      { pageKey: "fishfire", displayName: "Fishfire", path: "/fishfire", description: "Fishfire integration and management" },
      { pageKey: "admin", displayName: "Admin Panel", path: "/admin", description: "Administrative settings and user management" },
    ];

    defaultPages.forEach(pageData => {
      const pageId = randomUUID();
      const page: Page = {
        id: pageId,
        pageKey: pageData.pageKey,
        displayName: pageData.displayName,
        path: pageData.path,
        description: pageData.description,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.pages.set(pageId, page);
    });
  }

  private initializeDefaultPermissions() {
    const pages = Array.from(this.pages.values());
    const roles = [UserRole.USER, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN];

    // Define default permission matrix
    const defaultPermissions = {
      [UserRole.USER]: {
        dashboard: { view: true, edit: false, delete: false },
        campaigns: { view: false, edit: false, delete: false },
        campaign_details: { view: false, edit: false, delete: false },
        clients: { view: false, edit: false, delete: false },
        ad_accounts: { view: false, edit: false, delete: false },
        work_reports: { view: true, edit: true, delete: false },
        client_mailbox: { view: false, edit: false, delete: false },
        fb_ad_management: { view: false, edit: false, delete: false },
        advantix_ads_manager: { view: false, edit: false, delete: false },
        ownFarming: { view: false, edit: false, delete: false },
        newCreated: { view: false, edit: false, delete: false },
        farmingAccounts: { view: false, edit: false, delete: false },
        gher_management: { view: false, edit: false, delete: false },
        gher_invoices: { view: false, edit: false, delete: false },
        finance: { view: false, edit: false, delete: false },
        advantix_dashboard: { view: false, edit: false, delete: false },
        projects: { view: false, edit: false, delete: false },
        payments: { view: false, edit: false, delete: false },
        expenses_salaries: { view: false, edit: false, delete: false },
        salary_management: { view: false, edit: false, delete: false },
        reports: { view: false, edit: false, delete: false },
        fishfire: { view: false, edit: false, delete: false },
        admin: { view: false, edit: false, delete: false },
      },
      [UserRole.MANAGER]: {
        dashboard: { view: true, edit: false, delete: false },
        campaigns: { view: true, edit: false, delete: false },
        campaign_details: { view: true, edit: false, delete: false },
        clients: { view: true, edit: false, delete: false },
        ad_accounts: { view: true, edit: false, delete: false },
        work_reports: { view: true, edit: true, delete: false },
        client_mailbox: { view: true, edit: true, delete: false },
        fb_ad_management: { view: true, edit: false, delete: false },
        advantix_ads_manager: { view: true, edit: false, delete: false },
        ownFarming: { view: true, edit: false, delete: false },
        newCreated: { view: true, edit: false, delete: false },
        farmingAccounts: { view: true, edit: false, delete: false },
        gher_management: { view: true, edit: false, delete: false },
        gher_invoices: { view: true, edit: false, delete: false },
        finance: { view: true, edit: false, delete: false },
        advantix_dashboard: { view: true, edit: false, delete: false },
        projects: { view: true, edit: false, delete: false },
        payments: { view: true, edit: false, delete: false },
        expenses_salaries: { view: true, edit: false, delete: false },
        salary_management: { view: false, edit: false, delete: false },
        reports: { view: true, edit: false, delete: false },
        fishfire: { view: false, edit: false, delete: false },
        admin: { view: false, edit: false, delete: false },
      },
      [UserRole.ADMIN]: {
        dashboard: { view: true, edit: true, delete: false },
        campaigns: { view: true, edit: true, delete: true },
        campaign_details: { view: true, edit: true, delete: false },
        clients: { view: true, edit: true, delete: true },
        ad_accounts: { view: true, edit: true, delete: true },
        work_reports: { view: true, edit: true, delete: true },
        client_mailbox: { view: true, edit: true, delete: false },
        fb_ad_management: { view: true, edit: true, delete: true },
        advantix_ads_manager: { view: true, edit: true, delete: true },
        ownFarming: { view: true, edit: true, delete: true },
        newCreated: { view: true, edit: true, delete: true },
        farmingAccounts: { view: true, edit: true, delete: true },
        gher_management: { view: true, edit: true, delete: true },
        gher_invoices: { view: true, edit: true, delete: true },
        finance: { view: true, edit: true, delete: true },
        advantix_dashboard: { view: true, edit: true, delete: true },
        projects: { view: true, edit: true, delete: true },
        payments: { view: true, edit: true, delete: true },
        expenses_salaries: { view: true, edit: true, delete: true },
        salary_management: { view: true, edit: true, delete: false },
        reports: { view: true, edit: true, delete: true },
        fishfire: { view: true, edit: true, delete: true },
        admin: { view: false, edit: false, delete: false },
      },
      [UserRole.SUPER_ADMIN]: {
        dashboard: { view: true, edit: true, delete: true },
        campaigns: { view: true, edit: true, delete: true },
        campaign_details: { view: true, edit: true, delete: true },
        clients: { view: true, edit: true, delete: true },
        ad_accounts: { view: true, edit: true, delete: true },
        work_reports: { view: true, edit: true, delete: true },
        client_mailbox: { view: true, edit: true, delete: true },
        fb_ad_management: { view: true, edit: true, delete: true },
        advantix_ads_manager: { view: true, edit: true, delete: true },
        ownFarming: { view: true, edit: true, delete: true },
        newCreated: { view: true, edit: true, delete: true },
        farmingAccounts: { view: true, edit: true, delete: true },
        gher_management: { view: true, edit: true, delete: true },
        gher_invoices: { view: true, edit: true, delete: true },
        finance: { view: true, edit: true, delete: true },
        advantix_dashboard: { view: true, edit: true, delete: true },
        projects: { view: true, edit: true, delete: true },
        payments: { view: true, edit: true, delete: true },
        expenses_salaries: { view: true, edit: true, delete: true },
        salary_management: { view: true, edit: true, delete: true },
        reports: { view: true, edit: true, delete: true },
        fishfire: { view: true, edit: true, delete: true },
        admin: { view: true, edit: true, delete: true },
      },
    };

    roles.forEach(role => {
      pages.forEach(page => {
        const rolePermissions = defaultPermissions[role as keyof typeof defaultPermissions];
        const permissions = rolePermissions[page.pageKey as keyof typeof rolePermissions];
        if (permissions) {
          const permissionId = randomUUID();
          const rolePermission: RolePermission = {
            id: permissionId,
            role,
            pageId: page.id,
            canView: permissions.view,
            canEdit: permissions.edit,
            canDelete: permissions.delete,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.rolePermissions.set(permissionId, rolePermission);
        }
      });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: UserRole.USER, // Default role for new users
      isActive: true,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...updateData,
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  async getClientUsers(): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(user => user.role === UserRole.CLIENT)
      .sort((a, b) => {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }

  async validateCredentials(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (user && user.password === password && user.isActive) {
      return user;
    }
    return null;
  }

  async createSession(userId: string): Promise<Session> {
    const sessionId = randomUUID();
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

    const session: Session = {
      id: sessionId,
      userId,
      token,
      expiresAt,
      createdAt: new Date(),
    };

    this.sessions.set(token, session);
    return session;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const session = this.sessions.get(token);
    if (session && session.expiresAt > new Date()) {
      return session;
    }
    if (session) {
      this.sessions.delete(token);
    }
    return undefined;
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  // Campaign methods
  async getCampaigns(clientId?: string): Promise<Campaign[]> {
    let campaigns = Array.from(this.campaigns.values());
    if (clientId) {
      campaigns = campaigns.filter(campaign => campaign.clientId === clientId);
    }
    return campaigns.sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const id = randomUUID();
    const campaign: Campaign = {
      ...insertCampaign,
      id,
      status: insertCampaign.status || "active",
      comments: insertCampaign.comments || null,
      clientId: insertCampaign.clientId || null,
      spend: insertCampaign.spend || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.campaigns.set(id, campaign);
    return campaign;
  }

  async updateCampaign(id: string, updateData: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return undefined;
    
    const updatedCampaign: Campaign = {
      ...campaign,
      ...updateData,
      updatedAt: new Date(),
    };
    this.campaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    return this.campaigns.delete(id);
  }

  // Client methods
  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values()).sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = {
      ...insertClient,
      id,
      status: insertClient.status || "active",
      address: insertClient.address || null,
      notes: insertClient.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client) return undefined;
    
    const updatedClient: Client = {
      ...client,
      ...updateData,
      updatedAt: new Date(),
    };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  // Ad Account methods
  async getAdAccounts(clientId?: string): Promise<AdAccount[]> {
    let adAccounts = Array.from(this.adAccounts.values());
    if (clientId) {
      adAccounts = adAccounts.filter(account => account.clientId === clientId);
    }
    return adAccounts.sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  async getAdAccount(id: string): Promise<AdAccount | undefined> {
    return this.adAccounts.get(id);
  }

  async createAdAccount(insertAdAccount: InsertAdAccount): Promise<AdAccount> {
    const id = randomUUID();
    const adAccount: AdAccount = {
      ...insertAdAccount,
      id,
      totalSpend: "0",
      status: insertAdAccount.status || "active",
      notes: insertAdAccount.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.adAccounts.set(id, adAccount);
    return adAccount;
  }

  async updateAdAccount(id: string, updateData: Partial<InsertAdAccount>): Promise<AdAccount | undefined> {
    const adAccount = this.adAccounts.get(id);
    if (!adAccount) return undefined;
    
    const updatedAdAccount: AdAccount = {
      ...adAccount,
      ...updateData,
      updatedAt: new Date(),
    };
    this.adAccounts.set(id, updatedAdAccount);
    return updatedAdAccount;
  }

  async deleteAdAccount(id: string): Promise<boolean> {
    return this.adAccounts.delete(id);
  }
  // Ad Copy Set methods
  async getAdCopySets(campaignId: string): Promise<AdCopySet[]> {
    return Array.from(this.adCopySets.values())
      .filter(set => set.campaignId === campaignId)
      .sort((a, b) => {
        // Active sets first
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        // Then by creation date
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }

  async getAllAdCopySets(): Promise<AdCopySet[]> {
    return Array.from(this.adCopySets.values()).sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  async getAdCopySet(id: string): Promise<AdCopySet | undefined> {
    return this.adCopySets.get(id);
  }

  async createAdCopySet(insertAdCopySet: InsertAdCopySet): Promise<AdCopySet> {
    const id = randomUUID();
    const adCopySet: AdCopySet = {
      ...insertAdCopySet,
      id,
      isActive: insertAdCopySet.isActive || false,
      notes: insertAdCopySet.notes || null,
      age: insertAdCopySet.age || null,
      budget: insertAdCopySet.budget || null,
      adType: insertAdCopySet.adType || null,
      creativeLink: insertAdCopySet.creativeLink || null,
      headline: insertAdCopySet.headline || null,
      description: insertAdCopySet.description || null,
      callToAction: insertAdCopySet.callToAction || null,
      targetAudience: insertAdCopySet.targetAudience || null,
      placement: insertAdCopySet.placement || null,
      schedule: insertAdCopySet.schedule || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.adCopySets.set(id, adCopySet);
    return adCopySet;
  }

  async updateAdCopySet(id: string, updateData: Partial<InsertAdCopySet>): Promise<AdCopySet | undefined> {
    const adCopySet = this.adCopySets.get(id);
    if (!adCopySet) return undefined;
    
    const updatedAdCopySet: AdCopySet = {
      ...adCopySet,
      ...updateData,
      updatedAt: new Date(),
    };
    this.adCopySets.set(id, updatedAdCopySet);
    return updatedAdCopySet;
  }

  async deleteAdCopySet(id: string): Promise<boolean> {
    return this.adCopySets.delete(id);
  }

  async setActiveAdCopySet(campaignId: string, setId: string): Promise<boolean> {
    // First, deactivate all sets for this campaign
    const campaignSets = Array.from(this.adCopySets.values())
      .filter(set => set.campaignId === campaignId);
    
    for (const set of campaignSets) {
      if (set.isActive) {
        const updatedSet = { ...set, isActive: false, updatedAt: new Date() };
        this.adCopySets.set(set.id, updatedSet);
      }
    }

    // Then activate the specified set
    const targetSet = this.adCopySets.get(setId);
    if (!targetSet || targetSet.campaignId !== campaignId) {
      return false;
    }

    const updatedTargetSet = { ...targetSet, isActive: true, updatedAt: new Date() };
    this.adCopySets.set(setId, updatedTargetSet);
    return true;
  }

  // Work Report methods
  async getWorkReports(userId?: string): Promise<WorkReport[]> {
    const reports = Array.from(this.workReports.values());
    const filteredReports = userId 
      ? reports.filter(report => report.userId === userId)
      : reports;
    
    return filteredReports.sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  async getWorkReport(id: string): Promise<WorkReport | undefined> {
    return this.workReports.get(id);
  }

  async createWorkReport(insertWorkReport: InsertWorkReport): Promise<WorkReport> {
    const id = randomUUID();
    const workReport: WorkReport = {
      ...insertWorkReport,
      id,
      status: insertWorkReport.status || "submitted",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workReports.set(id, workReport);
    return workReport;
  }

  async updateWorkReport(id: string, updateData: Partial<InsertWorkReport>): Promise<WorkReport | undefined> {
    const workReport = this.workReports.get(id);
    if (!workReport) return undefined;
    
    const updatedWorkReport: WorkReport = {
      ...workReport,
      ...updateData,
      updatedAt: new Date(),
    };
    this.workReports.set(id, updatedWorkReport);
    return updatedWorkReport;
  }

  async deleteWorkReport(id: string): Promise<boolean> {
    return this.workReports.delete(id);
  }

  async deleteAllWorkReports(): Promise<number> {
    const count = this.workReports.size;
    this.workReports.clear();
    return count;
  }

  // Page methods
  async getPages(): Promise<Page[]> {
    return Array.from(this.pages.values()).sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  async getPage(id: string): Promise<Page | undefined> {
    return this.pages.get(id);
  }

  async getPageByKey(pageKey: string): Promise<Page | undefined> {
    return Array.from(this.pages.values()).find(page => page.pageKey === pageKey);
  }

  async createPage(insertPage: InsertPage): Promise<Page> {
    const id = randomUUID();
    const page: Page = {
      ...insertPage,
      id,
      isActive: insertPage.isActive ?? true,
      description: insertPage.description || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.pages.set(id, page);
    return page;
  }

  async updatePage(id: string, updateData: Partial<InsertPage>): Promise<Page | undefined> {
    const page = this.pages.get(id);
    if (!page) return undefined;
    
    const updatedPage: Page = {
      ...page,
      ...updateData,
      updatedAt: new Date(),
    };
    this.pages.set(id, updatedPage);
    return updatedPage;
  }

  async deletePage(id: string): Promise<boolean> {
    return this.pages.delete(id);
  }

  // Role Permission methods
  async getRolePermissions(role?: string): Promise<RolePermission[]> {
    const permissions = Array.from(this.rolePermissions.values());
    const filteredPermissions = role 
      ? permissions.filter(permission => permission.role === role)
      : permissions;
    
    return filteredPermissions.sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  async getRolePermission(id: string): Promise<RolePermission | undefined> {
    return this.rolePermissions.get(id);
  }

  async getRolePermissionByRoleAndPage(role: string, pageId: string): Promise<RolePermission | undefined> {
    return Array.from(this.rolePermissions.values()).find(
      permission => permission.role === role && permission.pageId === pageId
    );
  }

  async createRolePermission(insertPermission: InsertRolePermission): Promise<RolePermission> {
    const id = randomUUID();
    const permission: RolePermission = {
      ...insertPermission,
      id,
      canView: insertPermission.canView || false,
      canEdit: insertPermission.canEdit || false,
      canDelete: insertPermission.canDelete || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rolePermissions.set(id, permission);
    return permission;
  }

  async updateRolePermission(id: string, updateData: Partial<InsertRolePermission>): Promise<RolePermission | undefined> {
    const permission = this.rolePermissions.get(id);
    if (!permission) return undefined;
    
    const updatedPermission: RolePermission = {
      ...permission,
      ...updateData,
      updatedAt: new Date(),
    };
    this.rolePermissions.set(id, updatedPermission);
    return updatedPermission;
  }

  async deleteRolePermission(id: string): Promise<boolean> {
    return this.rolePermissions.delete(id);
  }

  async checkUserPagePermission(userId: string, pageKey: string, action: 'view' | 'edit' | 'delete'): Promise<boolean> {
    // Get user
    const user = await this.getUser(userId);
    if (!user) return false;

    // Super Admin has access to everything
    if (user.role === UserRole.SUPER_ADMIN) return true;

    // Get page
    const page = await this.getPageByKey(pageKey);
    if (!page || !page.isActive) return false;

    // Get permission for this role and page
    const permission = await this.getRolePermissionByRoleAndPage(user.role, page.id);
    if (!permission) return false;

    // Check specific action
    switch (action) {
      case 'view':
        return permission.canView ?? false;
      case 'edit':
        return permission.canEdit ?? false;
      case 'delete':
        return permission.canDelete ?? false;
      default:
        return false;
    }
  }

  private initializeFinanceSettings() {
    // Default USD to BDT exchange rate
    const exchangeRateId = randomUUID();
    const exchangeRate: FinanceSetting = {
      id: exchangeRateId,
      key: "usd_to_bdt_rate",
      value: "110.00", // Default rate
      description: "USD to BDT conversion rate",
      updatedAt: new Date(),
    };
    this.financeSettings.set(exchangeRateId, exchangeRate);
  }

  private initializeSampleFinanceData() {
    const clientIds = Array.from(this.clients.keys());
    if (clientIds.length === 0) return;
    
    // Create sample projects
    const project1Id = randomUUID();
    const project1: FinanceProject = {
      id: project1Id,
      name: "Digital Marketing Campaign Q1",
      clientId: clientIds[0],
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      budget: "5000.00",
      expense: "120000.00",
      status: "active",
      notes: "Major campaign for Q1 2024",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.financeProjects.set(project1Id, project1);

    const project2Id = randomUUID();
    const project2: FinanceProject = {
      id: project2Id,
      name: "Social Media Management",
      clientId: clientIds[1],
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      budget: "3000.00",
      expense: "75000.00",
      status: "active",
      notes: "Ongoing social media management project",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.financeProjects.set(project2Id, project2);

    // Create sample payments
    const payment1Id = randomUUID();
    const payment1: FinancePayment = {
      id: payment1Id,
      clientId: clientIds[0],
      projectId: project1Id,
      amount: "2500.00",
      conversionRate: "110.00",
      convertedAmount: "275000.00",
      currency: "USD",
      date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      notes: "First installment payment",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.financePayments.set(payment1Id, payment1);

    // Create sample expenses
    const expense1Id = randomUUID();
    const expense1: FinanceExpense = {
      id: expense1Id,
      type: "expense",
      projectId: project1Id,
      amount: "25000.00",
      currency: "BDT",
      date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      notes: "Ad spend for Facebook campaigns",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.financeExpenses.set(expense1Id, expense1);

    const salary1Id = randomUUID();
    const salary1: FinanceExpense = {
      id: salary1Id,
      type: "salary",
      projectId: project1Id,
      amount: "50000.00",
      currency: "BDT",
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      notes: "Monthly salary for project manager",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.financeExpenses.set(salary1Id, salary1);
  }

  // Finance Project methods
  async getFinanceProjects(): Promise<FinanceProject[]> {
    return Array.from(this.financeProjects.values()).sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  async getFinanceProject(id: string): Promise<FinanceProject | undefined> {
    return this.financeProjects.get(id);
  }

  async createFinanceProject(insertProject: InsertFinanceProject): Promise<FinanceProject> {
    const id = randomUUID();
    const project: FinanceProject = {
      ...insertProject,
      id,
      budget: insertProject.budget.toString(), // Convert number to string
      expense: insertProject.expense ? insertProject.expense.toString() : "0", // Convert number to string
      status: insertProject.status || "active",
      notes: insertProject.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.financeProjects.set(id, project);
    return project;
  }

  async updateFinanceProject(id: string, updateData: Partial<InsertFinanceProject>): Promise<FinanceProject | undefined> {
    const project = this.financeProjects.get(id);
    if (!project) return undefined;
    
    const updatedProject: FinanceProject = {
      ...project,
      ...updateData,
      budget: updateData.budget ? updateData.budget.toString() : project.budget,
      expense: updateData.expense ? updateData.expense.toString() : project.expense,
      updatedAt: new Date(),
    };
    this.financeProjects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteFinanceProject(id: string): Promise<boolean> {
    return this.financeProjects.delete(id);
  }

  // Finance Payment methods
  async getFinancePayments(projectId?: string): Promise<FinancePayment[]> {
    const payments = Array.from(this.financePayments.values());
    const filteredPayments = projectId 
      ? payments.filter(payment => payment.projectId === projectId)
      : payments;
    
    return filteredPayments.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }

  async getFinancePayment(id: string): Promise<FinancePayment | undefined> {
    return this.financePayments.get(id);
  }

  async createFinancePayment(insertPayment: InsertFinancePayment): Promise<FinancePayment> {
    const id = randomUUID();
    const payment: FinancePayment = {
      ...insertPayment,
      id,
      currency: insertPayment.currency || "USD",
      notes: insertPayment.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.financePayments.set(id, payment);
    return payment;
  }

  async updateFinancePayment(id: string, updateData: Partial<InsertFinancePayment>): Promise<FinancePayment | undefined> {
    const payment = this.financePayments.get(id);
    if (!payment) return undefined;
    
    const updatedPayment: FinancePayment = {
      ...payment,
      ...updateData,
      updatedAt: new Date(),
    };
    this.financePayments.set(id, updatedPayment);
    return updatedPayment;
  }

  async deleteFinancePayment(id: string): Promise<boolean> {
    return this.financePayments.delete(id);
  }

  // Finance Expense methods
  async getFinanceExpenses(projectId?: string): Promise<FinanceExpense[]> {
    const expenses = Array.from(this.financeExpenses.values());
    const filteredExpenses = projectId 
      ? expenses.filter(expense => expense.projectId === projectId)
      : expenses;
    
    return filteredExpenses.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }

  async getFinanceExpense(id: string): Promise<FinanceExpense | undefined> {
    return this.financeExpenses.get(id);
  }

  async createFinanceExpense(insertExpense: InsertFinanceExpense): Promise<FinanceExpense> {
    const id = randomUUID();
    const expense: FinanceExpense = {
      ...insertExpense,
      id,
      currency: insertExpense.currency || "BDT",
      projectId: insertExpense.projectId || null,
      notes: insertExpense.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.financeExpenses.set(id, expense);
    return expense;
  }

  async updateFinanceExpense(id: string, updateData: Partial<InsertFinanceExpense>): Promise<FinanceExpense | undefined> {
    const expense = this.financeExpenses.get(id);
    if (!expense) return undefined;
    
    const updatedExpense: FinanceExpense = {
      ...expense,
      ...updateData,
      updatedAt: new Date(),
    };
    this.financeExpenses.set(id, updatedExpense);
    return updatedExpense;
  }

  async deleteFinanceExpense(id: string): Promise<boolean> {
    return this.financeExpenses.delete(id);
  }

  async deleteAllFinanceExpenses(): Promise<number> {
    const count = this.financeExpenses.size;
    this.financeExpenses.clear();
    return count;
  }

  // Finance Settings methods
  async getFinanceSetting(key: string): Promise<FinanceSetting | undefined> {
    return Array.from(this.financeSettings.values()).find(setting => setting.key === key);
  }

  async getAllFinanceSettings(): Promise<FinanceSetting[]> {
    return Array.from(this.financeSettings.values()).sort((a, b) => {
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
  }

  async setFinanceSetting(insertSetting: InsertFinanceSetting): Promise<FinanceSetting> {
    // Check if setting already exists
    const existing = await this.getFinanceSetting(insertSetting.key);
    if (existing) {
      // Update existing setting
      const updated: FinanceSetting = {
        ...existing,
        value: insertSetting.value,
        description: insertSetting.description || existing.description,
        updatedAt: new Date(),
      };
      this.financeSettings.set(existing.id, updated);
      return updated;
    } else {
      // Create new setting
      const id = randomUUID();
      const setting: FinanceSetting = {
        ...insertSetting,
        id,
        description: insertSetting.description || null,
        updatedAt: new Date(),
      };
      this.financeSettings.set(id, setting);
      return setting;
    }
  }

  async getExchangeRate(): Promise<number> {
    const setting = await this.getFinanceSetting("usd_to_bdt_rate");
    return setting ? parseFloat(setting.value) : 110.0; // Default rate
  }

  // Tag methods implementation
  async getTags(): Promise<Tag[]> {
    return Array.from(this.tags.values()).sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getTag(id: string): Promise<Tag | undefined> {
    return this.tags.get(id);
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    const id = randomUUID();
    const tag: Tag = {
      ...insertTag,
      id,
      description: insertTag.description ?? null,
      color: insertTag.color ?? "#3B82F6",
      isActive: insertTag.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tags.set(id, tag);
    return tag;
  }

  async updateTag(id: string, updateData: Partial<InsertTag>): Promise<Tag | undefined> {
    const tag = this.tags.get(id);
    if (!tag) return undefined;

    const updatedTag: Tag = {
      ...tag,
      ...updateData,
      updatedAt: new Date(),
    };
    this.tags.set(id, updatedTag);
    return updatedTag;
  }

  async deleteTag(id: string): Promise<boolean> {
    return this.tags.delete(id);
  }

  // Employee methods implementation
  async getEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values()).sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = randomUUID();
    const now = new Date();
    const employee: Employee = {
      id,
      ...insertEmployee,
      isActive: insertEmployee.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.employees.set(id, employee);
    return employee;
  }

  async updateEmployee(id: string, updates: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const existing = this.employees.get(id);
    if (!existing) return undefined;

    const updated: Employee = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.employees.set(id, updated);
    return updated;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    return this.employees.delete(id);
  }

  // User Menu Permission methods implementation
  async getUserMenuPermissions(userId?: string): Promise<UserMenuPermission[]> {
    const allPermissions = Array.from(this.userMenuPermissions.values());
    if (userId) {
      return allPermissions.filter(permission => permission.userId === userId);
    }
    return allPermissions.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getUserMenuPermission(userId: string): Promise<UserMenuPermission | undefined> {
    return Array.from(this.userMenuPermissions.values()).find(permission => permission.userId === userId);
  }

  async createUserMenuPermission(insertPermission: InsertUserMenuPermission): Promise<UserMenuPermission> {
    const id = randomUUID();
    const now = new Date();
    const permission: UserMenuPermission = {
      id,
      ...insertPermission,
      createdAt: now,
      updatedAt: now,
    };
    this.userMenuPermissions.set(id, permission);
    return permission;
  }

  async updateUserMenuPermission(userId: string, updates: Partial<InsertUserMenuPermission>): Promise<UserMenuPermission | undefined> {
    const existing = Array.from(this.userMenuPermissions.values()).find(permission => permission.userId === userId);
    if (!existing) return undefined;

    const updated: UserMenuPermission = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.userMenuPermissions.set(existing.id, updated);
    return updated;
  }

  async deleteUserMenuPermission(userId: string): Promise<boolean> {
    const existing = Array.from(this.userMenuPermissions.entries()).find(([_, permission]) => permission.userId === userId);
    if (!existing) return false;
    
    return this.userMenuPermissions.delete(existing[0]);
  }

  // Salary methods
  async getSalaries(): Promise<Salary[]> {
    return Array.from(this.salaries.values());
  }

  async getSalary(id: string): Promise<Salary | undefined> {
    return this.salaries.get(id);
  }

  async createSalary(salary: InsertSalary): Promise<Salary> {
    const newSalary: Salary = {
      ...salary,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.salaries.set(newSalary.id, newSalary);
    return newSalary;
  }

  async updateSalary(id: string, salary: Partial<InsertSalary>): Promise<Salary | undefined> {
    const existing = this.salaries.get(id);
    if (!existing) return undefined;
    
    const updated: Salary = {
      ...existing,
      ...salary,
      updatedAt: new Date(),
    };
    this.salaries.set(id, updated);
    return updated;
  }

  async deleteSalary(id: string): Promise<boolean> {
    return this.salaries.delete(id);
  }

  // Telegram Configuration methods implementation
  async getTelegramConfig(): Promise<TelegramConfig | undefined> {
    return this.telegramConfig;
  }

  async createTelegramConfig(config: InsertTelegramConfig): Promise<TelegramConfig> {
    const id = randomUUID();
    const now = new Date();
    const telegramConfig: TelegramConfig = {
      id,
      ...config,
      createdAt: now,
      updatedAt: now,
    };
    this.telegramConfig = telegramConfig;
    return telegramConfig;
  }

  async updateTelegramConfig(updates: Partial<InsertTelegramConfig>): Promise<TelegramConfig | undefined> {
    if (!this.telegramConfig) return undefined;

    const updated: TelegramConfig = {
      ...this.telegramConfig,
      ...updates,
      updatedAt: new Date(),
    };
    this.telegramConfig = updated;
    return updated;
  }

  async deleteTelegramConfig(): Promise<boolean> {
    if (!this.telegramConfig) return false;
    this.telegramConfig = undefined;
    return true;
  }

  // Telegram Chat ID methods implementation
  async getTelegramChatIds(): Promise<TelegramChatId[]> {
    return Array.from(this.telegramChatIds.values()).sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  async getTelegramChatId(id: string): Promise<TelegramChatId | undefined> {
    return this.telegramChatIds.get(id);
  }

  async createTelegramChatId(chatId: InsertTelegramChatId): Promise<TelegramChatId> {
    const id = randomUUID();
    const now = new Date();
    const telegramChatId: TelegramChatId = {
      id,
      ...chatId,
      createdAt: now,
      updatedAt: now,
    };
    this.telegramChatIds.set(id, telegramChatId);
    return telegramChatId;
  }

  async updateTelegramChatId(id: string, updates: Partial<InsertTelegramChatId>): Promise<TelegramChatId | undefined> {
    const existing = this.telegramChatIds.get(id);
    if (!existing) return undefined;

    const updated: TelegramChatId = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.telegramChatIds.set(id, updated);
    return updated;
  }

  async deleteTelegramChatId(id: string): Promise<boolean> {
    return this.telegramChatIds.delete(id);
  }

  // Facebook Settings methods (stub implementations - use DatabaseStorage in production)
  async getFacebookSettings(): Promise<any> {
    return undefined;
  }

  async saveFacebookSettings(data: any): Promise<any> {
    return data;
  }

  async updateFacebookConnectionStatus(isConnected: boolean, error?: string): Promise<void> {
    // Stub implementation
  }

  // Email Settings methods (stub implementations - use DatabaseStorage in production)
  async getEmailSettings(): Promise<any> {
    return undefined;
  }

  async saveEmailSettings(data: any): Promise<any> {
    return data;
  }

  async updateEmailConnectionStatus(isConfigured: boolean, error?: string): Promise<void> {
    // Stub implementation
  }

  // SMS Settings methods (stub implementations - use DatabaseStorage in production)
  async getSmsSettings(): Promise<any> {
    return undefined;
  }

  async saveSmsSettings(data: any): Promise<any> {
    return data;
  }

  async updateSmsConnectionStatus(isConfigured: boolean, error?: string): Promise<void> {
    // Stub implementation
  }

  // Facebook Account Insights methods (stub implementations)
  async getFacebookAccountInsights(adAccountId: string, startDate: Date, endDate: Date): Promise<any[]> {
    return [];
  }

  async upsertFacebookAccountInsight(data: any): Promise<any> {
    return data;
  }

  // Facebook Campaign Insights methods (stub implementations)
  async getFacebookCampaignInsights(adAccountId: string, startDate: Date, endDate: Date): Promise<any[]> {
    return [];
  }

  async upsertFacebookCampaignInsight(data: any): Promise<any> {
    return data;
  }

  // Campaign Draft methods (stub implementations)
  async getCampaignDrafts(): Promise<any[]> {
    return [];
  }

  async getCampaignDraftById(id: string): Promise<any> {
    return null;
  }

  async createCampaignDraft(draft: any): Promise<any> {
    return draft;
  }

  async updateCampaignDraft(id: string, draft: any): Promise<any> {
    return draft;
  }

  async deleteCampaignDraft(id: string): Promise<void> {
    // Stub
  }

  async getCampaignTemplates(): Promise<any[]> {
    return [];
  }

  async getSavedAudiences(): Promise<any[]> {
    return [];
  }

  async getAdAccountById(id: string): Promise<any> {
    return Array.from(this.adAccounts.values()).find(acc => acc.id === id);
  }

}

import { DatabaseStorage } from './database-storage';

// Use DatabaseStorage for permanent data storage - now includes all finance methods
export const storage: IStorage = new DatabaseStorage();
