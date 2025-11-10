import { 
  type User, 
  type InsertUser, 
  type Session, 
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
  type FacebookSetting,
  type InsertFacebookSetting,
  type EmailSetting,
  type InsertEmailSetting,
  type SmsSetting,
  type InsertSmsSetting,
  type ClientEmailPreference,
  type InsertClientEmailPreference,
  type FacebookAccountInsight,
  type InsertFacebookAccountInsight,
  type FacebookCampaignInsight,
  type InsertFacebookCampaignInsight,
  type FacebookAdSetInsight,
  type InsertFacebookAdSetInsight,
  type FacebookAdInsight,
  type InsertFacebookAdInsight,
  type FarmingAccount,
  type InsertFarmingAccount,
  type FarmingAccountWithSecrets,
  type GherTag,
  type InsertGherTag,
  type GherPartner,
  type InsertGherPartner,
  type GherEntry,
  type InsertGherEntry,
  UserRole,
  users,
  sessions,
  campaigns,
  clients,
  adAccounts,
  adCopySets,
  campaignDailySpends,
  workReports,
  pages,
  rolePermissions,
  financeProjects,
  financePayments,
  financeExpenses,
  financeSettings,
  tags,
  employees,
  userMenuPermissions,
  salaries,
  telegramConfig,
  telegramChatIds,
  facebookSettings,
  emailSettings,
  smsSettings,
  clientEmailPreferences,
  facebookAccountInsights,
  facebookCampaignInsights,
  facebookAdSetInsights,
  facebookAdInsights,
  facebookPages,
  campaignDrafts,
  campaignTemplates,
  savedAudiences,
  farmingAccounts,
  gherTags,
  gherPartners,
  gherEntries
} from "@shared/schema";
import { randomUUID } from "crypto";
import { eq, and, desc, gte, lte, or, like, sql } from "drizzle-orm";
import { db } from "./db";
import type { IStorage } from "./storage";
import { encrypt, decrypt, type EncryptedData } from "./encryption";

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize database with default admin user if it doesn't exist
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    try {
      // Check if admin user exists
      const existingAdmin = await db.select()
        .from(users)
        .where(eq(users.username, "Admin"))
        .limit(1);
      
      if (existingAdmin.length === 0) {
        // Create default admin user
        await db.insert(users).values({
          id: randomUUID(),
          name: "Administrator",
          username: "Admin",
          password: "2604", // In production, this should be hashed
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        });
      }

      // Initialize default exchange rate if not exists
      const existingExchangeRate = await this.getFinanceSetting("usd_to_bdt_rate");
      if (!existingExchangeRate) {
        await this.setFinanceSetting({
          key: "usd_to_bdt_rate",
          value: "110",
          description: "USD to BDT exchange rate",
        });
      }

      // Sample clients are no longer created automatically to preserve user data

      // Initialize default pages if not exist
      const existingPages = await db.select().from(pages).limit(1);
      if (existingPages.length === 0) {
        await this.initializeDefaultPages();
      }

      // Initialize default permissions if not exist
      const existingPermissions = await db.select().from(rolePermissions).limit(1);
      if (existingPermissions.length === 0) {
        await this.initializeDefaultPermissions();
      }
    } catch (error) {
      // Silently fail if tables don't exist yet - they'll be created by schema push
      console.log("Database initialization pending schema creation:", error);
    }
  }

  private async initializeDefaultPages() {
    try {
      const defaultPages = [
        { pageKey: "dashboard", displayName: "Dashboard", path: "/", description: "Main dashboard with metrics and overview" },
        { pageKey: "campaigns", displayName: "Campaign Management", path: "/campaigns", description: "Manage advertising campaigns" },
        { pageKey: "campaign_details", displayName: "Campaign Details", path: "/campaigns/:id", description: "View and edit individual campaign details" },
        { pageKey: "clients", displayName: "Client Management", path: "/clients", description: "Manage client accounts and information" },
        { pageKey: "ad_accounts", displayName: "Ad Accounts", path: "/ad-accounts", description: "Manage advertising account connections" },
        { pageKey: "salaries", displayName: "Salary Management", path: "/salaries", description: "Manage employee salaries and payments" },
        { pageKey: "work_reports", displayName: "Work Reports", path: "/work-reports", description: "Track and submit work hours and tasks" },
        { pageKey: "client_mailbox", displayName: "Client Mailbox", path: "/client-mailbox", description: "Send manual emails to clients with custom reports" },
        { pageKey: "admin", displayName: "Admin Panel", path: "/admin", description: "Administrative settings and user management" },
      ];

      for (const pageData of defaultPages) {
        await db.insert(pages).values({
          id: randomUUID(),
          pageKey: pageData.pageKey,
          displayName: pageData.displayName,
          path: pageData.path,
          description: pageData.description,
          isActive: true,
        });
      }
      console.log(`[DB] Initialized ${defaultPages.length} default pages`);
    } catch (error) {
      console.error(`[DB ERROR] Failed to initialize default pages:`, error);
      throw new Error(`Failed to initialize default pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async initializeDefaultPermissions() {
    try {
      const allPages = await db.select().from(pages);
      const roles = [UserRole.USER, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN];

      // Define default permission matrix
      const defaultPermissions = {
        [UserRole.USER]: {
          dashboard: { view: true, edit: false, delete: false },
          campaigns: { view: false, edit: false, delete: false },
          campaign_details: { view: false, edit: false, delete: false },
          clients: { view: false, edit: false, delete: false },
          ad_accounts: { view: false, edit: false, delete: false },
          salaries: { view: false, edit: false, delete: false },
          work_reports: { view: true, edit: true, delete: false },
          client_mailbox: { view: false, edit: false, delete: false },
          admin: { view: false, edit: false, delete: false },
        },
        [UserRole.MANAGER]: {
          dashboard: { view: true, edit: false, delete: false },
          campaigns: { view: true, edit: false, delete: false },
          campaign_details: { view: true, edit: false, delete: false },
          clients: { view: true, edit: false, delete: false },
          ad_accounts: { view: true, edit: false, delete: false },
          salaries: { view: false, edit: false, delete: false },
          work_reports: { view: true, edit: true, delete: false },
          client_mailbox: { view: true, edit: true, delete: false },
          admin: { view: false, edit: false, delete: false },
        },
        [UserRole.ADMIN]: {
          dashboard: { view: true, edit: true, delete: false },
          campaigns: { view: true, edit: true, delete: true },
          campaign_details: { view: true, edit: true, delete: false },
          clients: { view: true, edit: true, delete: true },
          ad_accounts: { view: true, edit: true, delete: true },
          salaries: { view: true, edit: true, delete: false },
          work_reports: { view: true, edit: true, delete: true },
          client_mailbox: { view: true, edit: true, delete: false },
          admin: { view: false, edit: false, delete: false },
        },
        [UserRole.SUPER_ADMIN]: {
          dashboard: { view: true, edit: true, delete: true },
          campaigns: { view: true, edit: true, delete: true },
          campaign_details: { view: true, edit: true, delete: true },
          clients: { view: true, edit: true, delete: true },
          ad_accounts: { view: true, edit: true, delete: true },
          salaries: { view: true, edit: true, delete: true },
          work_reports: { view: true, edit: true, delete: true },
          client_mailbox: { view: true, edit: true, delete: true },
          admin: { view: true, edit: true, delete: true },
        },
      };

      let permissionsCreated = 0;
      for (const role of roles) {
        for (const page of allPages) {
          const rolePerms = defaultPermissions[role as keyof typeof defaultPermissions];
          const permissions = rolePerms[page.pageKey as keyof typeof rolePerms];
          if (permissions) {
            await db.insert(rolePermissions).values({
              id: randomUUID(),
              role,
              pageId: page.id,
              canView: permissions.view,
              canEdit: permissions.edit,
              canDelete: permissions.delete,
            });
            permissionsCreated++;
          }
        }
      }
      console.log(`[DB] Initialized ${permissionsCreated} default permissions`);
    } catch (error) {
      console.error(`[DB ERROR] Failed to initialize default permissions:`, error);
      throw new Error(`Failed to initialize default permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get user with ID ${id}:`, error);
      throw new Error(`Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get user by username ${username}:`, error);
      throw new Error(`Failed to get user by username: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const id = randomUUID();
      const newUser = {
        ...insertUser,
        id,
        role: UserRole.USER,
        isActive: true,
      };
      
      await db.insert(users).values(newUser);
      console.log(`[DB] Created user: ${newUser.username} (ID: ${newUser.id})`);
      return newUser as User;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create user:`, error);
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User | undefined> {
    try {
      await db.update(users).set(updateData).where(eq(users.id, id));
      console.log(`[DB] Updated user with ID: ${id}`);
      return this.getUser(id);
    } catch (error) {
      console.error(`[DB ERROR] Failed to update user with ID ${id}:`, error);
      throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted user with ID: ${id}`);
      } else {
        console.warn(`[DB] No user found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete user with ID ${id}:`, error);
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return db.select().from(users).orderBy(desc(users.createdAt));
    } catch (error) {
      console.error(`[DB ERROR] Failed to get all users:`, error);
      throw new Error(`Failed to get all users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getClientUsers(): Promise<User[]> {
    try {
      return db.select().from(users).where(eq(users.role, UserRole.CLIENT)).orderBy(desc(users.createdAt));
    } catch (error) {
      console.error(`[DB ERROR] Failed to get client users:`, error);
      throw new Error(`Failed to get client users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateCredentials(username: string, password: string): Promise<User | null> {
    try {
      const user = await this.getUserByUsername(username);
      if (user && user.password === password && user.isActive) {
        console.log(`[DB] Valid credentials for user: ${username}`);
        return user;
      }
      console.log(`[DB] Invalid credentials for user: ${username}`);
      return null;
    } catch (error) {
      console.error(`[DB ERROR] Failed to validate credentials for ${username}:`, error);
      throw new Error(`Failed to validate credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Session methods
  async createSession(userId: string): Promise<Session> {
    try {
      const sessionId = randomUUID();
      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

      const session = {
        id: sessionId,
        userId,
        token,
        expiresAt,
      };

      await db.insert(sessions).values(session);
      console.log(`[DB] Created session for user: ${userId}`);
      return session as Session;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create session for user ${userId}:`, error);
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    try {
      const result = await db.select()
        .from(sessions)
        .where(eq(sessions.token, token))
        .limit(1);
      
      const session = result[0];
      if (session && session.expiresAt > new Date()) {
        return session;
      }
      if (session) {
        await this.deleteSession(token);
      }
      return undefined;
    } catch (error) {
      console.error(`[DB ERROR] Failed to get session by token:`, error);
      throw new Error(`Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteSession(token: string): Promise<void> {
    try {
      await db.delete(sessions).where(eq(sessions.token, token));
      console.log(`[DB] Deleted session`);
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete session:`, error);
      throw new Error(`Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Campaign methods
  async getCampaigns(clientId?: string): Promise<Campaign[]> {
    try {
      if (clientId) {
        return db.select().from(campaigns).where(eq(campaigns.clientId, clientId)).orderBy(desc(campaigns.createdAt));
      }
      return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
    } catch (error) {
      console.error(`[DB ERROR] Failed to get campaigns:`, error);
      throw new Error(`Failed to get campaigns: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    try {
      const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get campaign with ID ${id}:`, error);
      throw new Error(`Failed to get campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    try {
      const id = randomUUID();
      const campaign = {
        ...insertCampaign,
        id,
        status: insertCampaign.status || "active",
        comments: insertCampaign.comments || null,
        clientId: insertCampaign.clientId || null,
        spend: insertCampaign.spend || "0",
      };
      
      await db.insert(campaigns).values(campaign);
      console.log(`[DB] Created campaign: ${campaign.name} (ID: ${campaign.id})`);
      return campaign as Campaign;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create campaign:`, error);
      throw new Error(`Failed to create campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateCampaign(id: string, updateData: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    try {
      await db.update(campaigns).set(updateData).where(eq(campaigns.id, id));
      console.log(`[DB] Updated campaign with ID: ${id}`);
      return this.getCampaign(id);
    } catch (error) {
      console.error(`[DB ERROR] Failed to update campaign with ID ${id}:`, error);
      throw new Error(`Failed to update campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteCampaign(id: string): Promise<boolean> {
    try {
      const result = await db.delete(campaigns).where(eq(campaigns.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted campaign with ID: ${id}`);
      } else {
        console.warn(`[DB] No campaign found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete campaign with ID ${id}:`, error);
      throw new Error(`Failed to delete campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Campaign Daily Spend methods
  async getCampaignDailySpends(campaignId: string): Promise<CampaignDailySpend[]> {
    try {
      return db.select()
        .from(campaignDailySpends)
        .where(eq(campaignDailySpends.campaignId, campaignId))
        .orderBy(desc(campaignDailySpends.date));
    } catch (error) {
      console.error(`[DB ERROR] Failed to get daily spends for campaign ${campaignId}:`, error);
      throw new Error(`Failed to get campaign daily spends: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCampaignDailySpend(campaignId: string, date: string): Promise<CampaignDailySpend | undefined> {
    try {
      // Normalize date to start of day in UTC to prevent timezone shifts
      const normalizedDate = new Date(date);
      normalizedDate.setUTCHours(0, 0, 0, 0);
      
      const result = await db.select()
        .from(campaignDailySpends)
        .where(and(
          eq(campaignDailySpends.campaignId, campaignId),
          eq(campaignDailySpends.date, normalizedDate)
        ))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get daily spend for campaign ${campaignId} on ${date}:`, error);
      throw new Error(`Failed to get campaign daily spend: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async upsertCampaignDailySpend(spend: InsertCampaignDailySpend): Promise<CampaignDailySpend> {
    try {
      const id = randomUUID();
      // Normalize date to start of day in UTC to ensure uniqueness works correctly across timezones
      const normalizedDate = new Date(spend.date);
      normalizedDate.setUTCHours(0, 0, 0, 0);
      
      const spendData = {
        ...spend,
        id,
        date: normalizedDate,
        amount: spend.amount.toString(),
      };
      
      // Use PostgreSQL's ON CONFLICT to update if exists
      const result = await db.insert(campaignDailySpends)
        .values(spendData)
        .onConflictDoUpdate({
          target: [campaignDailySpends.campaignId, campaignDailySpends.date],
          set: {
            amount: spend.amount.toString(),
            updatedAt: new Date(),
          },
        })
        .returning();
      
      console.log(`[DB] Upserted daily spend for campaign ${spend.campaignId} on ${normalizedDate.toISOString().split('T')[0]}: $${spend.amount}`);
      
      // Update the campaign's total spend field
      const totalSpend = await this.getCampaignTotalSpend(spend.campaignId);
      await this.updateCampaign(spend.campaignId, { spend: totalSpend.toString() });
      
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to upsert daily spend:`, error);
      throw new Error(`Failed to upsert campaign daily spend: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCampaignTotalSpend(campaignId: string): Promise<number> {
    try {
      const spends = await this.getCampaignDailySpends(campaignId);
      const total = spends.reduce((sum, spend) => {
        return sum + parseFloat(spend.amount || "0");
      }, 0);
      return total;
    } catch (error) {
      console.error(`[DB ERROR] Failed to get total spend for campaign ${campaignId}:`, error);
      throw new Error(`Failed to get campaign total spend: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Client methods
  async getClients(): Promise<Client[]> {
    try {
      return db.select().from(clients).orderBy(desc(clients.createdAt));
    } catch (error) {
      console.error(`[DB ERROR] Failed to get clients:`, error);
      throw new Error(`Failed to get clients: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getClient(id: string): Promise<Client | undefined> {
    try {
      const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get client with ID ${id}:`, error);
      throw new Error(`Failed to get client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    try {
      const id = randomUUID();
      const client = {
        ...insertClient,
        id,
        status: insertClient.status || "active",
        address: insertClient.address || null,
        notes: insertClient.notes || null,
      };
      
      await db.insert(clients).values(client);
      console.log(`[DB] Created client: ${client.clientName} (ID: ${client.id})`);
      return client as Client;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create client:`, error);
      throw new Error(`Failed to create client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    try {
      await db.update(clients).set(updateData).where(eq(clients.id, id));
      console.log(`[DB] Updated client with ID: ${id}`);
      return this.getClient(id);
    } catch (error) {
      console.error(`[DB ERROR] Failed to update client with ID ${id}:`, error);
      throw new Error(`Failed to update client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteClient(id: string): Promise<boolean> {
    try {
      const result = await db.delete(clients).where(eq(clients.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted client with ID: ${id}`);
      } else {
        console.warn(`[DB] No client found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete client with ID ${id}:`, error);
      throw new Error(`Failed to delete client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Ad Account methods
  async getAdAccounts(clientId?: string): Promise<AdAccount[]> {
    try {
      if (clientId) {
        return db.select().from(adAccounts).where(eq(adAccounts.clientId, clientId)).orderBy(desc(adAccounts.createdAt));
      }
      return db.select().from(adAccounts).orderBy(desc(adAccounts.createdAt));
    } catch (error) {
      console.error(`[DB ERROR] Failed to get ad accounts:`, error);
      throw new Error(`Failed to get ad accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAdAccount(id: string): Promise<AdAccount | undefined> {
    try {
      const result = await db.select().from(adAccounts).where(eq(adAccounts.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get ad account with ID ${id}:`, error);
      throw new Error(`Failed to get ad account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createAdAccount(insertAdAccount: InsertAdAccount): Promise<AdAccount> {
    try {
      const id = randomUUID();
      const adAccount = {
        ...insertAdAccount,
        id,
        totalSpend: "0",
        status: insertAdAccount.status || "active",
        notes: insertAdAccount.notes || null,
      };
      
      await db.insert(adAccounts).values(adAccount);
      console.log(`[DB] Created ad account: ${adAccount.accountName} (ID: ${adAccount.id})`);
      return adAccount as AdAccount;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create ad account:`, error);
      throw new Error(`Failed to create ad account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateAdAccount(id: string, updateData: Partial<InsertAdAccount>): Promise<AdAccount | undefined> {
    try {
      await db.update(adAccounts).set(updateData).where(eq(adAccounts.id, id));
      console.log(`[DB] Updated ad account with ID: ${id}`);
      return this.getAdAccount(id);
    } catch (error) {
      console.error(`[DB ERROR] Failed to update ad account with ID ${id}:`, error);
      throw new Error(`Failed to update ad account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteAdAccount(id: string): Promise<boolean> {
    try {
      const result = await db.delete(adAccounts).where(eq(adAccounts.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted ad account with ID: ${id}`);
      } else {
        console.warn(`[DB] No ad account found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete ad account with ID ${id}:`, error);
      throw new Error(`Failed to delete ad account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Ad Copy Set methods
  async getAdCopySets(campaignId: string): Promise<AdCopySet[]> {
    try {
      return db.select()
        .from(adCopySets)
        .where(eq(adCopySets.campaignId, campaignId))
        .orderBy(desc(adCopySets.isActive), desc(adCopySets.createdAt));
    } catch (error) {
      console.error(`[DB ERROR] Failed to get ad copy sets for campaign ${campaignId}:`, error);
      throw new Error(`Failed to get ad copy sets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllAdCopySets(): Promise<AdCopySet[]> {
    try {
      return db.select()
        .from(adCopySets)
        .orderBy(desc(adCopySets.createdAt));
    } catch (error) {
      console.error(`[DB ERROR] Failed to get all ad copy sets:`, error);
      throw new Error(`Failed to get all ad copy sets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAdCopySet(id: string): Promise<AdCopySet | undefined> {
    try {
      const result = await db.select().from(adCopySets).where(eq(adCopySets.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get ad copy set with ID ${id}:`, error);
      throw new Error(`Failed to get ad copy set: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createAdCopySet(insertAdCopySet: InsertAdCopySet): Promise<AdCopySet> {
    try {
      const id = randomUUID();
      const adCopySet = {
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
      };
      
      await db.insert(adCopySets).values(adCopySet);
      console.log(`[DB] Created ad copy set: ${adCopySet.setName} (ID: ${adCopySet.id})`);
      return adCopySet as AdCopySet;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create ad copy set:`, error);
      throw new Error(`Failed to create ad copy set: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateAdCopySet(id: string, updateData: Partial<InsertAdCopySet>): Promise<AdCopySet | undefined> {
    try {
      await db.update(adCopySets).set(updateData).where(eq(adCopySets.id, id));
      console.log(`[DB] Updated ad copy set with ID: ${id}`);
      return this.getAdCopySet(id);
    } catch (error) {
      console.error(`[DB ERROR] Failed to update ad copy set with ID ${id}:`, error);
      throw new Error(`Failed to update ad copy set: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteAdCopySet(id: string): Promise<boolean> {
    try {
      const result = await db.delete(adCopySets).where(eq(adCopySets.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted ad copy set with ID: ${id}`);
      } else {
        console.warn(`[DB] No ad copy set found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete ad copy set with ID ${id}:`, error);
      throw new Error(`Failed to delete ad copy set: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async setActiveAdCopySet(campaignId: string, setId: string): Promise<boolean> {
    try {
      // First, deactivate all sets for this campaign
      await db.update(adCopySets)
        .set({ isActive: false })
        .where(eq(adCopySets.campaignId, campaignId));

      // Then activate the specified set
      const result = await db.update(adCopySets)
        .set({ isActive: true })
        .where(and(eq(adCopySets.id, setId), eq(adCopySets.campaignId, campaignId)));

      const activated = (result.rowCount ?? 0) > 0;
      if (activated) {
        console.log(`[DB] Activated ad copy set ${setId} for campaign ${campaignId}`);
      } else {
        console.warn(`[DB] No ad copy set found to activate with ID ${setId} for campaign ${campaignId}`);
      }
      return activated;
    } catch (error) {
      console.error(`[DB ERROR] Failed to set active ad copy set ${setId} for campaign ${campaignId}:`, error);
      throw new Error(`Failed to set active ad copy set: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Work Report methods
  async getWorkReports(userId?: string): Promise<WorkReport[]> {
    try {
      const query = db.select().from(workReports);
      
      if (userId) {
        return query
          .where(eq(workReports.userId, userId))
          .orderBy(desc(workReports.createdAt));
      } else {
        return query.orderBy(desc(workReports.createdAt));
      }
    } catch (error) {
      console.error(`[DB ERROR] Failed to get work reports:`, error);
      throw new Error(`Failed to get work reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getWorkReport(id: string): Promise<WorkReport | undefined> {
    try {
      const result = await db.select().from(workReports).where(eq(workReports.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get work report with ID ${id}:`, error);
      throw new Error(`Failed to get work report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createWorkReport(insertWorkReport: InsertWorkReport): Promise<WorkReport> {
    try {
      const id = randomUUID();
      const workReport = {
        ...insertWorkReport,
        id,
        status: insertWorkReport.status || "submitted",
      };
      
      await db.insert(workReports).values(workReport);
      console.log(`[DB] Created work report (ID: ${workReport.id})`);
      return workReport as WorkReport;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create work report:`, error);
      throw new Error(`Failed to create work report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateWorkReport(id: string, updateData: Partial<InsertWorkReport>): Promise<WorkReport | undefined> {
    try {
      await db.update(workReports).set(updateData).where(eq(workReports.id, id));
      console.log(`[DB] Updated work report with ID: ${id}`);
      return this.getWorkReport(id);
    } catch (error) {
      console.error(`[DB ERROR] Failed to update work report with ID ${id}:`, error);
      throw new Error(`Failed to update work report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteWorkReport(id: string): Promise<boolean> {
    try {
      const result = await db.delete(workReports).where(eq(workReports.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted work report with ID: ${id}`);
      } else {
        console.warn(`[DB] No work report found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete work report with ID ${id}:`, error);
      throw new Error(`Failed to delete work report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Page methods
  async getPages(): Promise<Page[]> {
    try {
      const result = await db.select().from(pages).orderBy(desc(pages.createdAt));
      // Map database columns to expected frontend format
      return result.map(page => ({
        ...page,
        pageKey: page.pageKey || (page as any).page_key,
        displayName: page.displayName || (page as any).display_name,
      }));
    } catch (error) {
      console.error(`[DB ERROR] Failed to get pages:`, error);
      throw new Error(`Failed to get pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPage(id: string): Promise<Page | undefined> {
    const result = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
    const page = result[0];
    if (!page) return undefined;
    // Map database columns to expected frontend format
    return {
      ...page,
      pageKey: page.pageKey || (page as any).page_key,
      displayName: page.displayName || (page as any).display_name,
    };
  }

  async getPageByKey(pageKey: string): Promise<Page | undefined> {
    const result = await db.select().from(pages).where(eq(pages.pageKey, pageKey)).limit(1);
    const page = result[0];
    if (!page) return undefined;
    // Map database columns to expected frontend format
    return {
      ...page,
      pageKey: page.pageKey || (page as any).page_key,
      displayName: page.displayName || (page as any).display_name,
    };
  }

  async createPage(insertPage: InsertPage): Promise<Page> {
    const id = randomUUID();
    const page = {
      ...insertPage,
      id,
      isActive: insertPage.isActive ?? true,
    };
    
    await db.insert(pages).values(page);
    return page as Page;
  }

  async updatePage(id: string, updateData: Partial<InsertPage>): Promise<Page | undefined> {
    await db.update(pages).set(updateData).where(eq(pages.id, id));
    return this.getPage(id);
  }

  async deletePage(id: string): Promise<boolean> {
    const result = await db.delete(pages).where(eq(pages.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Role Permission methods
  async getRolePermissions(role?: string): Promise<RolePermission[]> {
    const query = db.select().from(rolePermissions);
    
    if (role) {
      return query
        .where(eq(rolePermissions.role, role))
        .orderBy(desc(rolePermissions.createdAt));
    } else {
      return query.orderBy(desc(rolePermissions.createdAt));
    }
  }

  async getRolePermission(id: string): Promise<RolePermission | undefined> {
    const result = await db.select().from(rolePermissions).where(eq(rolePermissions.id, id)).limit(1);
    return result[0];
  }

  async getRolePermissionByRoleAndPage(role: string, pageId: string): Promise<RolePermission | undefined> {
    const result = await db.select()
      .from(rolePermissions)
      .where(and(eq(rolePermissions.role, role), eq(rolePermissions.pageId, pageId)))
      .limit(1);
    return result[0];
  }

  async createRolePermission(insertPermission: InsertRolePermission): Promise<RolePermission> {
    const id = randomUUID();
    const permission = {
      ...insertPermission,
      id,
      canView: insertPermission.canView || false,
      canEdit: insertPermission.canEdit || false,
      canDelete: insertPermission.canDelete || false,
    };
    
    await db.insert(rolePermissions).values(permission);
    return permission as RolePermission;
  }

  async updateRolePermission(id: string, updateData: Partial<InsertRolePermission>): Promise<RolePermission | undefined> {
    await db.update(rolePermissions).set(updateData).where(eq(rolePermissions.id, id));
    return this.getRolePermission(id);
  }

  async deleteRolePermission(id: string): Promise<boolean> {
    const result = await db.delete(rolePermissions).where(eq(rolePermissions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async checkUserPagePermission(userId: string, pageKey: string, action: 'view' | 'edit' | 'delete'): Promise<boolean> {
    // Get user
    const user = await this.getUser(userId);
    if (!user) return false;

    // Super Admin has access to everything
    if (user.role === UserRole.SUPER_ADMIN) return true;

    // First check user-specific menu permissions
    const userMenuPermission = await this.getUserMenuPermission(userId);
    
    // Map pageKey to menu permission field
    const pageKeyToMenuField: Record<string, string> = {
      'dashboard': 'dashboard',
      'campaigns': 'campaignManagement',
      'clients': 'clientManagement',
      'ad_accounts': 'adAccounts',
      'work_reports': 'workReports',
      'fb_ad_management': 'fbAdManagement',
      'finance': 'advantixDashboard', // Finance uses multiple fields, checking main one
      'admin': 'adminPanel'
    };

    // If user has specific menu permissions set, use those for view action
    if (userMenuPermission && action === 'view') {
      const menuField = pageKeyToMenuField[pageKey];
      if (menuField && menuField in userMenuPermission) {
        const permissionValue = (userMenuPermission as any)[menuField];
        // Return the user's specific menu permission if it's boolean
        if (typeof permissionValue === 'boolean') {
          return permissionValue;
        }
      }
    }

    // Fall back to role-based permissions for edit/delete actions or if no user menu permissions
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

  // Finance Project methods
  async getFinanceProjects(): Promise<FinanceProject[]> {
    return await db.select().from(financeProjects).orderBy(desc(financeProjects.createdAt));
  }

  async getFinanceProject(id: string): Promise<FinanceProject | undefined> {
    const results = await db.select().from(financeProjects).where(eq(financeProjects.id, id));
    return results[0];
  }

  async createFinanceProject(project: InsertFinanceProject): Promise<FinanceProject> {
    try {
      const newProject = {
        ...project,
        id: randomUUID(),
        budget: project.budget.toString(), // Convert number to string for decimal
        expense: project.expense ? project.expense.toString() : "0", // Convert number to string for decimal
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.insert(financeProjects).values(newProject);
      console.log(`[DB] Created finance project: ${newProject.name} (ID: ${newProject.id})`);
      return newProject as FinanceProject;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create finance project:`, error);
      throw new Error(`Failed to create finance project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateFinanceProject(id: string, project: Partial<InsertFinanceProject>): Promise<FinanceProject | undefined> {
    const updatedProject = { 
      ...project, 
      budget: project.budget ? project.budget.toString() : undefined,
      expense: project.expense ? project.expense.toString() : undefined,
      updatedAt: new Date() 
    };
    await db.update(financeProjects).set(updatedProject).where(eq(financeProjects.id, id));
    return this.getFinanceProject(id);
  }

  async deleteFinanceProject(id: string): Promise<boolean> {
    try {
      const result = await db.delete(financeProjects).where(eq(financeProjects.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted finance project with ID: ${id}`);
      } else {
        console.warn(`[DB] No finance project found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete finance project with ID ${id}:`, error);
      throw new Error(`Failed to delete finance project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Finance Payment methods
  async getFinancePayments(projectId?: string): Promise<FinancePayment[]> {
    if (projectId) {
      return await db.select().from(financePayments)
        .where(eq(financePayments.projectId, projectId))
        .orderBy(desc(financePayments.createdAt));
    }
    return await db.select().from(financePayments).orderBy(desc(financePayments.createdAt));
  }

  async getFinancePayment(id: string): Promise<FinancePayment | undefined> {
    const results = await db.select().from(financePayments).where(eq(financePayments.id, id));
    return results[0];
  }

  async createFinancePayment(payment: InsertFinancePayment): Promise<FinancePayment> {
    try {
      const newPayment = {
        ...payment,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.insert(financePayments).values(newPayment);
      console.log(`[DB] Created finance payment: ${newPayment.amount} ${newPayment.currency} (ID: ${newPayment.id})`);
      return newPayment as FinancePayment;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create finance payment:`, error);
      throw new Error(`Failed to create finance payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateFinancePayment(id: string, payment: Partial<InsertFinancePayment>): Promise<FinancePayment | undefined> {
    const updatedPayment = { ...payment, updatedAt: new Date() };
    await db.update(financePayments).set(updatedPayment).where(eq(financePayments.id, id));
    return this.getFinancePayment(id);
  }

  async deleteFinancePayment(id: string): Promise<boolean> {
    try {
      const result = await db.delete(financePayments).where(eq(financePayments.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted finance payment with ID: ${id}`);
      } else {
        console.warn(`[DB] No finance payment found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete finance payment with ID ${id}:`, error);
      throw new Error(`Failed to delete finance payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Finance Expense methods
  async getFinanceExpenses(projectId?: string): Promise<FinanceExpense[]> {
    if (projectId) {
      return await db.select().from(financeExpenses)
        .where(eq(financeExpenses.projectId, projectId))
        .orderBy(desc(financeExpenses.createdAt));
    }
    return await db.select().from(financeExpenses).orderBy(desc(financeExpenses.createdAt));
  }

  async getFinanceExpense(id: string): Promise<FinanceExpense | undefined> {
    const results = await db.select().from(financeExpenses).where(eq(financeExpenses.id, id));
    return results[0];
  }

  async createFinanceExpense(expense: InsertFinanceExpense): Promise<FinanceExpense> {
    try {
      const newExpense = {
        ...expense,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.insert(financeExpenses).values(newExpense);
      console.log(`[DB] Created finance expense: ${newExpense.amount} ${newExpense.currency} (ID: ${newExpense.id})`);
      return newExpense as FinanceExpense;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create finance expense:`, error);
      throw new Error(`Failed to create finance expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateFinanceExpense(id: string, expense: Partial<InsertFinanceExpense>): Promise<FinanceExpense | undefined> {
    const updatedExpense = { ...expense, updatedAt: new Date() };
    await db.update(financeExpenses).set(updatedExpense).where(eq(financeExpenses.id, id));
    return this.getFinanceExpense(id);
  }

  async deleteFinanceExpense(id: string): Promise<boolean> {
    try {
      const result = await db.delete(financeExpenses).where(eq(financeExpenses.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted finance expense with ID: ${id}`);
      } else {
        console.warn(`[DB] No finance expense found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete finance expense with ID ${id}:`, error);
      throw new Error(`Failed to delete finance expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteAllFinanceExpenses(): Promise<number> {
    try {
      const result = await db.delete(financeExpenses);
      const count = result.rowCount ?? 0;
      console.log(`[DB] Deleted all ${count} finance expenses`);
      return count;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete all finance expenses:`, error);
      throw new Error(`Failed to delete all finance expenses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Finance Setting methods
  async getFinanceSetting(key: string): Promise<FinanceSetting | undefined> {
    try {
      const results = await db.select().from(financeSettings).where(eq(financeSettings.key, key));
      return results[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get finance setting ${key}:`, error);
      throw new Error(`Failed to get finance setting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllFinanceSettings(): Promise<FinanceSetting[]> {
    return db.select()
      .from(financeSettings)
      .orderBy(desc(financeSettings.updatedAt));
  }

  async setFinanceSetting(setting: InsertFinanceSetting): Promise<FinanceSetting> {
    try {
      const existingSetting = await this.getFinanceSetting(setting.key);
      
      if (existingSetting) {
        // Update existing setting
        const updatedSetting = { ...setting, updatedAt: new Date() };
        await db.update(financeSettings).set(updatedSetting).where(eq(financeSettings.key, setting.key));
        console.log(`[DB] Updated finance setting: ${setting.key}`);
        return { ...existingSetting, ...updatedSetting };
      } else {
        // Create new setting
        const newSetting = {
          ...setting,
          id: randomUUID(),
          updatedAt: new Date(),
        };
        await db.insert(financeSettings).values(newSetting);
        console.log(`[DB] Created finance setting: ${setting.key}`);
        return newSetting as FinanceSetting;
      }
    } catch (error) {
      console.error(`[DB ERROR] Failed to set finance setting ${setting.key}:`, error);
      throw new Error(`Failed to set finance setting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getExchangeRate(): Promise<number> {
    const setting = await this.getFinanceSetting("usd_to_bdt_rate");
    if (setting) {
      return parseFloat(setting.value);
    }
    // Default exchange rate if not set
    const defaultRate = {
      key: "usd_to_bdt_rate",
      value: "110",
      description: "USD to BDT exchange rate",
    };
    await this.setFinanceSetting(defaultRate);
    return 110;
  }

  // Tag methods implementation
  async getTags(): Promise<Tag[]> {
    try {
      return db.select().from(tags).orderBy(desc(tags.createdAt));
    } catch (error) {
      console.error(`[DB ERROR] Failed to get tags:`, error);
      throw new Error(`Failed to get tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTag(id: string): Promise<Tag | undefined> {
    try {
      const result = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get tag with ID ${id}:`, error);
      throw new Error(`Failed to get tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    try {
      const id = randomUUID();
      const newTag = {
        ...insertTag,
        id,
        isActive: insertTag.isActive ?? true,
      };
      
      await db.insert(tags).values(newTag);
      console.log(`[DB] Created tag: ${newTag.name} (ID: ${newTag.id})`);
      return newTag as Tag;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create tag:`, error);
      throw new Error(`Failed to create tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateTag(id: string, updateData: Partial<InsertTag>): Promise<Tag | undefined> {
    try {
      await db.update(tags).set(updateData).where(eq(tags.id, id));
      console.log(`[DB] Updated tag with ID: ${id}`);
      return this.getTag(id);
    } catch (error) {
      console.error(`[DB ERROR] Failed to update tag with ID ${id}:`, error);
      throw new Error(`Failed to update tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteTag(id: string): Promise<boolean> {
    try {
      const result = await db.delete(tags).where(eq(tags.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted tag with ID: ${id}`);
      } else {
        console.warn(`[DB] No tag found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete tag with ID ${id}:`, error);
      throw new Error(`Failed to delete tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Employee methods implementation
  async getEmployees(): Promise<Employee[]> {
    try {
      return db.select().from(employees).orderBy(desc(employees.createdAt));
    } catch (error) {
      console.error(`[DB ERROR] Failed to get employees:`, error);
      throw new Error(`Failed to get employees: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    try {
      const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get employee with ID ${id}:`, error);
      throw new Error(`Failed to get employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    try {
      const id = randomUUID();
      const newEmployee = {
        ...insertEmployee,
        id,
        isActive: insertEmployee.isActive ?? true,
      };
      
      await db.insert(employees).values(newEmployee);
      console.log(`[DB] Created employee: ${newEmployee.name} (ID: ${newEmployee.id})`);
      return newEmployee as Employee;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create employee:`, error);
      throw new Error(`Failed to create employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateEmployee(id: string, updateData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    try {
      await db.update(employees).set(updateData).where(eq(employees.id, id));
      console.log(`[DB] Updated employee with ID: ${id}`);
      return this.getEmployee(id);
    } catch (error) {
      console.error(`[DB ERROR] Failed to update employee with ID ${id}:`, error);
      throw new Error(`Failed to update employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteEmployee(id: string): Promise<boolean> {
    try {
      const result = await db.delete(employees).where(eq(employees.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted employee with ID: ${id}`);
      } else {
        console.warn(`[DB] No employee found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete employee with ID ${id}:`, error);
      throw new Error(`Failed to delete employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // User Menu Permission methods implementation
  async getUserMenuPermissions(userId?: string): Promise<UserMenuPermission[]> {
    try {
      const query = db.select().from(userMenuPermissions);
      
      if (userId) {
        return query
          .where(eq(userMenuPermissions.userId, userId))
          .orderBy(desc(userMenuPermissions.createdAt));
      } else {
        return query.orderBy(desc(userMenuPermissions.createdAt));
      }
    } catch (error) {
      console.error(`[DB ERROR] Failed to get user menu permissions:`, error);
      throw new Error(`Failed to get user menu permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserMenuPermission(userId: string): Promise<UserMenuPermission | undefined> {
    try {
      const result = await db.select().from(userMenuPermissions).where(eq(userMenuPermissions.userId, userId)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get user menu permission for user ${userId}:`, error);
      throw new Error(`Failed to get user menu permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createUserMenuPermission(insertPermission: InsertUserMenuPermission): Promise<UserMenuPermission> {
    try {
      const id = randomUUID();
      const newPermission = {
        ...insertPermission,
        id,
      };
      
      await db.insert(userMenuPermissions).values(newPermission);
      console.log(`[DB] Created user menu permission for user: ${newPermission.userId} (ID: ${newPermission.id})`);
      return newPermission as UserMenuPermission;
    } catch (error) {
      console.error(`[DB ERROR] Failed to create user menu permission:`, error);
      throw new Error(`Failed to create user menu permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateUserMenuPermission(userId: string, updateData: Partial<InsertUserMenuPermission>): Promise<UserMenuPermission | undefined> {
    try {
      await db.update(userMenuPermissions).set(updateData).where(eq(userMenuPermissions.userId, userId));
      console.log(`[DB] Updated user menu permission for user: ${userId}`);
      return this.getUserMenuPermission(userId);
    } catch (error) {
      console.error(`[DB ERROR] Failed to update user menu permission for user ${userId}:`, error);
      throw new Error(`Failed to update user menu permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteUserMenuPermission(userId: string): Promise<boolean> {
    try {
      const result = await db.delete(userMenuPermissions).where(eq(userMenuPermissions.userId, userId));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted user menu permission for user: ${userId}`);
      } else {
        console.warn(`[DB] No user menu permission found to delete for user: ${userId}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete user menu permission for user ${userId}:`, error);
      throw new Error(`Failed to delete user menu permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Salary methods implementation
  async getSalaries(): Promise<Salary[]> {
    try {
      const result = await db.select().from(salaries).orderBy(desc(salaries.createdAt));
      return result;
    } catch (error) {
      console.error('[DB ERROR] Failed to get salaries:', error);
      throw new Error(`Failed to get salaries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSalary(id: string): Promise<Salary | undefined> {
    try {
      const result = await db.select().from(salaries).where(eq(salaries.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[DB ERROR] Failed to get salary with ID ${id}:`, error);
      throw new Error(`Failed to get salary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createSalary(salary: any): Promise<Salary> {
    try {
      // Calculate missing fields if not provided
      const basicSalary = Number(salary.basicSalary);
      const contractualHours = Number(salary.contractualHours);
      const actualWorkingHours = Number(salary.actualWorkingHours);
      const festivalBonus = Number(salary.festivalBonus || 0);
      const performanceBonus = Number(salary.performanceBonus || 0);
      const otherBonus = Number(salary.otherBonus || 0);
      
      const hourlyRate = basicSalary / contractualHours;
      const basePayment = actualWorkingHours * hourlyRate;
      const totalBonus = festivalBonus + performanceBonus + otherBonus;
      const grossPayment = basePayment + totalBonus;
      const finalPayment = grossPayment;
      
      const newSalary = {
        id: randomUUID(),
        employeeId: salary.employeeId,
        employeeName: salary.employeeName,
        basicSalary: String(basicSalary),
        contractualHours: contractualHours,
        actualWorkingHours: String(actualWorkingHours),
        hourlyRate: String(hourlyRate),
        basePayment: String(basePayment),
        festivalBonus: String(festivalBonus),
        performanceBonus: String(performanceBonus),
        otherBonus: String(otherBonus),
        totalBonus: String(totalBonus),
        grossPayment: String(grossPayment),
        finalPayment: String(finalPayment),
        paymentMethod: salary.paymentMethod || 'bank_transfer',
        paymentStatus: salary.paymentStatus || 'unpaid',
        remarks: salary.remarks || null,
        month: salary.month,
      };
      
      await db.insert(salaries).values(newSalary);
      console.log(`[DB] Created salary record for employee: ${newSalary.employeeName} (ID: ${newSalary.id})`);
      
      // Re-query the inserted row to get all default values including createdAt/updatedAt
      const insertedSalary = await this.getSalary(newSalary.id);
      if (!insertedSalary) {
        throw new Error('Failed to retrieve created salary record');
      }
      return insertedSalary;
    } catch (error) {
      console.error('[DB ERROR] Failed to create salary:', error);
      throw new Error(`Failed to create salary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateSalary(id: string, salary: any): Promise<Salary | undefined> {
    try {
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      // Update basic fields and recalculate if needed
      if (salary.employeeId !== undefined) updateData.employeeId = salary.employeeId;
      if (salary.employeeName !== undefined) updateData.employeeName = salary.employeeName;
      if (salary.basicSalary !== undefined) updateData.basicSalary = String(salary.basicSalary);
      if (salary.contractualHours !== undefined) updateData.contractualHours = salary.contractualHours;
      if (salary.actualWorkingHours !== undefined) updateData.actualWorkingHours = String(salary.actualWorkingHours);
      if (salary.festivalBonus !== undefined) updateData.festivalBonus = String(salary.festivalBonus);
      if (salary.performanceBonus !== undefined) updateData.performanceBonus = String(salary.performanceBonus);
      if (salary.otherBonus !== undefined) updateData.otherBonus = String(salary.otherBonus);
      if (salary.paymentMethod !== undefined) updateData.paymentMethod = salary.paymentMethod;
      if (salary.paymentStatus !== undefined) updateData.paymentStatus = salary.paymentStatus;
      if (salary.remarks !== undefined) updateData.remarks = salary.remarks;
      if (salary.month !== undefined) updateData.month = salary.month;
      
      // Recalculate derived fields if basic fields were updated
      if (salary.basicSalary !== undefined || salary.contractualHours !== undefined || 
          salary.actualWorkingHours !== undefined || salary.festivalBonus !== undefined ||
          salary.performanceBonus !== undefined || salary.otherBonus !== undefined) {
        
        const existing = await this.getSalary(id);
        if (existing) {
          const basicSalary = Number(salary.basicSalary !== undefined ? salary.basicSalary : existing.basicSalary);
          const contractualHours = Number(salary.contractualHours !== undefined ? salary.contractualHours : existing.contractualHours);
          const actualWorkingHours = Number(salary.actualWorkingHours !== undefined ? salary.actualWorkingHours : existing.actualWorkingHours);
          const festivalBonus = Number(salary.festivalBonus !== undefined ? salary.festivalBonus : existing.festivalBonus);
          const performanceBonus = Number(salary.performanceBonus !== undefined ? salary.performanceBonus : existing.performanceBonus);
          const otherBonus = Number(salary.otherBonus !== undefined ? salary.otherBonus : existing.otherBonus);
          
          const hourlyRate = basicSalary / contractualHours;
          const basePayment = actualWorkingHours * hourlyRate;
          const totalBonus = festivalBonus + performanceBonus + otherBonus;
          const grossPayment = basePayment + totalBonus;
          const finalPayment = grossPayment;
          
          updateData.hourlyRate = String(hourlyRate);
          updateData.basePayment = String(basePayment);
          updateData.totalBonus = String(totalBonus);
          updateData.grossPayment = String(grossPayment);
          updateData.finalPayment = String(finalPayment);
        }
      }
      
      await db.update(salaries).set(updateData).where(eq(salaries.id, id));
      console.log(`[DB] Updated salary record with ID: ${id}`);
      return this.getSalary(id);
    } catch (error) {
      console.error(`[DB ERROR] Failed to update salary with ID ${id}:`, error);
      throw new Error(`Failed to update salary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteSalary(id: string): Promise<boolean> {
    try {
      const result = await db.delete(salaries).where(eq(salaries.id, id));
      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        console.log(`[DB] Deleted salary record with ID: ${id}`);
      } else {
        console.warn(`[DB] No salary record found to delete with ID: ${id}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete salary with ID ${id}:`, error);
      throw new Error(`Failed to delete salary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Telegram Configuration Methods
  async getTelegramConfig(): Promise<TelegramConfig | undefined> {
    try {
      const result = await db.select()
        .from(telegramConfig)
        .limit(1);
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error("[DB ERROR] Failed to get Telegram config:", error);
      throw new Error(`Failed to get Telegram config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createTelegramConfig(data: InsertTelegramConfig): Promise<TelegramConfig> {
    try {
      // First, delete any existing config (there should only be one)
      await db.delete(telegramConfig);
      
      // Insert the new config
      const result = await db.insert(telegramConfig).values({
        ...data,
        id: randomUUID(),
      }).returning();
      
      console.log("[DB] Created Telegram config");
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to create Telegram config:", error);
      throw new Error(`Failed to create Telegram config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateTelegramConfig(data: InsertTelegramConfig): Promise<TelegramConfig | undefined> {
    try {
      // Get existing config
      const existing = await this.getTelegramConfig();
      if (!existing) {
        return undefined;
      }
      
      const result = await db.update(telegramConfig)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(telegramConfig.id, existing.id))
        .returning();
      
      console.log("[DB] Updated Telegram config");
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error("[DB ERROR] Failed to update Telegram config:", error);
      throw new Error(`Failed to update Telegram config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteTelegramConfig(): Promise<boolean> {
    try {
      const deleted = await db.delete(telegramConfig).returning();
      console.log("[DB] Deleted Telegram config");
      return deleted.length > 0;
    } catch (error) {
      console.error("[DB ERROR] Failed to delete Telegram config:", error);
      throw new Error(`Failed to delete Telegram config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Telegram Chat ID Methods
  async getTelegramChatIds(): Promise<TelegramChatId[]> {
    try {
      const result = await db.select()
        .from(telegramChatIds)
        .orderBy(desc(telegramChatIds.createdAt));
      
      return result;
    } catch (error) {
      console.error("[DB ERROR] Failed to get Telegram chat IDs:", error);
      throw new Error(`Failed to get Telegram chat IDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTelegramChatId(id: string): Promise<TelegramChatId | undefined> {
    try {
      const result = await db.select()
        .from(telegramChatIds)
        .where(eq(telegramChatIds.id, id))
        .limit(1);
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error(`[DB ERROR] Failed to get Telegram chat ID with ID ${id}:`, error);
      throw new Error(`Failed to get Telegram chat ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createTelegramChatId(data: InsertTelegramChatId): Promise<TelegramChatId> {
    try {
      const result = await db.insert(telegramChatIds).values({
        ...data,
        id: randomUUID(),
      }).returning();
      
      console.log(`[DB] Created Telegram chat ID: ${data.name}`);
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to create Telegram chat ID:", error);
      throw new Error(`Failed to create Telegram chat ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateTelegramChatId(id: string, data: InsertTelegramChatId): Promise<TelegramChatId | undefined> {
    try {
      const result = await db.update(telegramChatIds)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(telegramChatIds.id, id))
        .returning();
      
      if (result.length > 0) {
        console.log(`[DB] Updated Telegram chat ID: ${id}`);
        return result[0];
      } else {
        console.warn(`[DB] No Telegram chat ID found to update with ID: ${id}`);
        return undefined;
      }
    } catch (error) {
      console.error(`[DB ERROR] Failed to update Telegram chat ID with ID ${id}:`, error);
      throw new Error(`Failed to update Telegram chat ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteTelegramChatId(id: string): Promise<boolean> {
    try {
      const deleted = await db.delete(telegramChatIds)
        .where(eq(telegramChatIds.id, id))
        .returning();
      
      if (deleted.length > 0) {
        console.log(`[DB] Deleted Telegram chat ID: ${id}`);
        return true;
      } else {
        console.warn(`[DB] No Telegram chat ID found to delete with ID: ${id}`);
        return false;
      }
    } catch (error) {
      console.error(`[DB ERROR] Failed to delete Telegram chat ID with ID ${id}:`, error);
      throw new Error(`Failed to delete Telegram chat ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Facebook Settings methods
  async getFacebookSettings(): Promise<FacebookSetting | undefined> {
    try {
      const result = await db.select()
        .from(facebookSettings)
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to get Facebook settings:", error);
      throw new Error(`Failed to get Facebook settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveFacebookSettings(data: InsertFacebookSetting): Promise<FacebookSetting> {
    try {
      const existing = await this.getFacebookSettings();
      
      if (existing) {
        const result = await db.update(facebookSettings)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(facebookSettings.id, existing.id))
          .returning();
        
        console.log(`[DB] Updated Facebook settings`);
        return result[0];
      } else {
        const result = await db.insert(facebookSettings).values({
          ...data,
          id: randomUUID(),
        }).returning();
        
        console.log(`[DB] Created Facebook settings`);
        return result[0];
      }
    } catch (error) {
      console.error("[DB ERROR] Failed to save Facebook settings:", error);
      throw new Error(`Failed to save Facebook settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateFacebookConnectionStatus(isConnected: boolean, error?: string): Promise<void> {
    try {
      const existing = await this.getFacebookSettings();
      
      if (existing) {
        await db.update(facebookSettings)
          .set({
            isConnected,
            lastTestedAt: new Date(),
            connectionError: error || null,
            updatedAt: new Date(),
          })
          .where(eq(facebookSettings.id, existing.id));
        
        console.log(`[DB] Updated Facebook connection status: ${isConnected ? 'connected' : 'disconnected'}`);
      }
    } catch (error) {
      console.error("[DB ERROR] Failed to update Facebook connection status:", error);
      throw new Error(`Failed to update Facebook connection status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Email Settings methods
  async getEmailSettings(): Promise<EmailSetting | undefined> {
    try {
      const result = await db.select()
        .from(emailSettings)
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to get email settings:", error);
      throw new Error(`Failed to get email settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveEmailSettings(data: InsertEmailSetting): Promise<EmailSetting> {
    try {
      const existing = await this.getEmailSettings();
      
      if (existing) {
        const result = await db.update(emailSettings)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(emailSettings.id, existing.id))
          .returning();
        
        console.log(`[DB] Updated email settings`);
        return result[0];
      } else {
        const result = await db.insert(emailSettings).values({
          ...data,
          id: randomUUID(),
        }).returning();
        
        console.log(`[DB] Created email settings`);
        return result[0];
      }
    } catch (error) {
      console.error("[DB ERROR] Failed to save email settings:", error);
      throw new Error(`Failed to save email settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateEmailConnectionStatus(isConfigured: boolean, error?: string): Promise<void> {
    try {
      const existing = await this.getEmailSettings();
      
      if (existing) {
        await db.update(emailSettings)
          .set({
            isConfigured,
            lastTestedAt: new Date(),
            connectionError: error || null,
            updatedAt: new Date(),
          })
          .where(eq(emailSettings.id, existing.id));
        
        console.log(`[DB] Updated email connection status: ${isConfigured ? 'configured' : 'not configured'}`);
      }
    } catch (error) {
      console.error("[DB ERROR] Failed to update email connection status:", error);
      throw new Error(`Failed to update email connection status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // SMS Settings methods
  async getSmsSettings(): Promise<SmsSetting | undefined> {
    try {
      const result = await db.select()
        .from(smsSettings)
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to get SMS settings:", error);
      throw new Error(`Failed to get SMS settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveSmsSettings(data: InsertSmsSetting): Promise<SmsSetting> {
    try {
      const existing = await this.getSmsSettings();
      
      if (existing) {
        const result = await db.update(smsSettings)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(smsSettings.id, existing.id))
          .returning();
        
        console.log(`[DB] Updated SMS settings`);
        return result[0];
      } else {
        const result = await db.insert(smsSettings).values({
          ...data,
          id: randomUUID(),
        }).returning();
        
        console.log(`[DB] Created SMS settings`);
        return result[0];
      }
    } catch (error) {
      console.error("[DB ERROR] Failed to save SMS settings:", error);
      throw new Error(`Failed to save SMS settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateSmsConnectionStatus(isConfigured: boolean, error?: string): Promise<void> {
    try {
      const existing = await this.getSmsSettings();
      
      if (existing) {
        await db.update(smsSettings)
          .set({
            isConfigured,
            lastTestedAt: new Date(),
            connectionError: error || null,
            updatedAt: new Date(),
          })
          .where(eq(smsSettings.id, existing.id));
        
        console.log(`[DB] Updated SMS connection status: ${isConfigured ? 'configured' : 'not configured'}`);
      }
    } catch (error) {
      console.error("[DB ERROR] Failed to update SMS connection status:", error);
      throw new Error(`Failed to update SMS connection status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Client Email Preferences methods
  async getClientEmailPreferences(clientId: string): Promise<ClientEmailPreference | undefined> {
    try {
      const result = await db.select()
        .from(clientEmailPreferences)
        .where(eq(clientEmailPreferences.clientId, clientId))
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to get client email preferences:", error);
      throw new Error(`Failed to get client email preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllClientEmailPreferences(): Promise<ClientEmailPreference[]> {
    try {
      const result = await db.select()
        .from(clientEmailPreferences);
      
      return result;
    } catch (error) {
      console.error("[DB ERROR] Failed to get all client email preferences:", error);
      throw new Error(`Failed to get all client email preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveClientEmailPreferences(clientId: string, preferences: InsertClientEmailPreference): Promise<ClientEmailPreference> {
    try {
      const existing = await this.getClientEmailPreferences(clientId);
      
      if (existing) {
        const result = await db.update(clientEmailPreferences)
          .set({
            ...preferences,
            updatedAt: new Date(),
          })
          .where(eq(clientEmailPreferences.clientId, clientId))
          .returning();
        
        console.log(`[DB] Updated client email preferences for client: ${clientId}`);
        return result[0];
      } else {
        const result = await db.insert(clientEmailPreferences).values({
          ...preferences,
          clientId,
          id: randomUUID(),
        }).returning();
        
        console.log(`[DB] Created client email preferences for client: ${clientId}`);
        return result[0];
      }
    } catch (error) {
      console.error("[DB ERROR] Failed to save client email preferences:", error);
      throw new Error(`Failed to save client email preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Facebook Account Insights methods
  async getFacebookAccountInsights(adAccountId: string, startDate: Date, endDate: Date): Promise<FacebookAccountInsight[]> {
    try {
      const result = await db.select()
        .from(facebookAccountInsights)
        .where(
          and(
            eq(facebookAccountInsights.adAccountId, adAccountId),
            gte(facebookAccountInsights.date, startDate),
            lte(facebookAccountInsights.date, endDate)
          )
        )
        .orderBy(desc(facebookAccountInsights.date));
      
      return result;
    } catch (error) {
      console.error("[DB ERROR] Failed to get Facebook account insights:", error);
      throw new Error(`Failed to get Facebook account insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async upsertFacebookAccountInsight(data: InsertFacebookAccountInsight): Promise<FacebookAccountInsight> {
    try {
      const result = await db.insert(facebookAccountInsights)
        .values({
          ...data,
          id: randomUUID(),
        })
        .onConflictDoUpdate({
          target: [facebookAccountInsights.adAccountId, facebookAccountInsights.date],
          set: {
            ...data,
            updatedAt: new Date(),
          }
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to upsert Facebook account insight:", error);
      throw new Error(`Failed to upsert Facebook account insight: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Facebook Campaign Insights methods
  async getFacebookCampaignInsights(adAccountId: string, startDate: Date, endDate: Date): Promise<FacebookCampaignInsight[]> {
    try {
      const result = await db.select()
        .from(facebookCampaignInsights)
        .where(
          and(
            eq(facebookCampaignInsights.adAccountId, adAccountId),
            gte(facebookCampaignInsights.date, startDate),
            lte(facebookCampaignInsights.date, endDate)
          )
        )
        .orderBy(desc(facebookCampaignInsights.date));
      
      return result;
    } catch (error) {
      console.error("[DB ERROR] Failed to get Facebook campaign insights:", error);
      throw new Error(`Failed to get Facebook campaign insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async upsertFacebookCampaignInsight(data: InsertFacebookCampaignInsight): Promise<FacebookCampaignInsight> {
    try {
      const result = await db.insert(facebookCampaignInsights)
        .values({
          ...data,
          id: randomUUID(),
        })
        .onConflictDoUpdate({
          target: [facebookCampaignInsights.fbCampaignId, facebookCampaignInsights.date],
          set: {
            ...data,
            updatedAt: new Date(),
          }
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to upsert Facebook campaign insight:", error);
      throw new Error(`Failed to upsert Facebook campaign insight: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Campaign Draft methods
  async getCampaignDrafts(): Promise<any[]> {
    try {
      const result = await db.select()
        .from(campaignDrafts)
        .orderBy(desc(campaignDrafts.createdAt));
      return result;
    } catch (error) {
      console.error("[DB ERROR] Failed to get campaign drafts:", error);
      return [];
    }
  }

  async getCampaignDraftById(id: string): Promise<any> {
    try {
      const result = await db.select()
        .from(campaignDrafts)
        .where(eq(campaignDrafts.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to get campaign draft:", error);
      return null;
    }
  }

  async createCampaignDraft(draft: any): Promise<any> {
    try {
      const result = await db.insert(campaignDrafts)
        .values({
          ...draft,
          id: randomUUID(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to create campaign draft:", error);
      throw error;
    }
  }

  async updateCampaignDraft(id: string, draft: any): Promise<any> {
    try {
      const result = await db.update(campaignDrafts)
        .set({
          ...draft,
          updatedAt: new Date(),
        })
        .where(eq(campaignDrafts.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to update campaign draft:", error);
      throw error;
    }
  }

  async deleteCampaignDraft(id: string): Promise<void> {
    try {
      await db.delete(campaignDrafts)
        .where(eq(campaignDrafts.id, id));
    } catch (error) {
      console.error("[DB ERROR] Failed to delete campaign draft:", error);
      throw error;
    }
  }

  async getCampaignTemplates(): Promise<any[]> {
    try {
      const result = await db.select()
        .from(campaignTemplates)
        .orderBy(desc(campaignTemplates.createdAt));
      return result;
    } catch (error) {
      console.error("[DB ERROR] Failed to get campaign templates:", error);
      return [];
    }
  }

  async getSavedAudiences(): Promise<any[]> {
    try {
      const result = await db.select()
        .from(savedAudiences)
        .orderBy(desc(savedAudiences.createdAt));
      return result;
    } catch (error) {
      console.error("[DB ERROR] Failed to get saved audiences:", error);
      return [];
    }
  }

  async getAdAccountById(id: string): Promise<any> {
    try {
      const result = await db.select()
        .from(adAccounts)
        .where(eq(adAccounts.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to get ad account:", error);
      return null;
    }
  }

  // Farming Accounts implementation
  async getFarmingAccounts(filters?: { status?: string; socialMedia?: string; vaId?: string; search?: string }): Promise<FarmingAccount[]> {
    try {
      let query = db.select().from(farmingAccounts);
      
      const conditions = [];
      if (filters?.status) {
        conditions.push(eq(farmingAccounts.status, filters.status));
      }
      if (filters?.socialMedia) {
        conditions.push(eq(farmingAccounts.socialMedia, filters.socialMedia));
      }
      if (filters?.vaId) {
        conditions.push(eq(farmingAccounts.vaId, filters.vaId));
      }
      if (filters?.search) {
        conditions.push(
          or(
            like(farmingAccounts.idName, `%${filters.search}%`),
            like(farmingAccounts.email, `%${filters.search}%`),
            like(farmingAccounts.comment, `%${filters.search}%`)
          )
        );
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const result = await query.orderBy(desc(farmingAccounts.createdAt));
      return result;
    } catch (error) {
      console.error("[DB ERROR] Failed to get farming accounts:", error);
      return [];
    }
  }

  async getFarmingAccount(id: string): Promise<FarmingAccount | undefined> {
    try {
      const result = await db.select()
        .from(farmingAccounts)
        .where(eq(farmingAccounts.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to get farming account:", error);
      return undefined;
    }
  }

  async getFarmingAccountWithSecrets(id: string): Promise<FarmingAccountWithSecrets | undefined> {
    try {
      const account = await this.getFarmingAccount(id);
      if (!account) return undefined;
      
      // Return account with sensitive fields (now stored as plain text)
      return {
        ...account,
        passwordDecrypted: account.password
      };
    } catch (error) {
      console.error("[DB ERROR] Failed to get farming account with secrets:", error);
      return undefined;
    }
  }

  async createFarmingAccount(account: InsertFarmingAccount): Promise<FarmingAccount> {
    try {
      const result = await db.insert(farmingAccounts).values({
        id: randomUUID(),
        comment: account.comment || null,
        socialMedia: account.socialMedia,
        vaId: account.vaId || null,
        status: account.status || 'new',
        idName: account.idName,
        email: account.email,
        recoveryEmail: account.recoveryEmail || null,
        password: account.password,
        twoFaSecret: account.twoFaSecret || null,
      }).returning();
      
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to create farming account:", error);
      throw error;
    }
  }

  async updateFarmingAccount(id: string, account: Partial<InsertFarmingAccount>): Promise<FarmingAccount | undefined> {
    try {
      const updateData: any = {
        ...account,
        updatedAt: new Date(),
      };
      
      const result = await db.update(farmingAccounts)
        .set(updateData)
        .where(eq(farmingAccounts.id, id))
        .returning();
        
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to update farming account:", error);
      return undefined;
    }
  }

  async deleteFarmingAccount(id: string): Promise<boolean> {
    try {
      await db.delete(farmingAccounts).where(eq(farmingAccounts.id, id));
      return true;
    } catch (error) {
      console.error("[DB ERROR] Failed to delete farming account:", error);
      return false;
    }
  }

  async importFarmingAccountsFromCsv(accounts: InsertFarmingAccount[]): Promise<{ success: number; errors: string[] }> {
    let success = 0;
    const errors: string[] = [];
    
    for (const account of accounts) {
      try {
        await this.createFarmingAccount(account);
        success++;
      } catch (error: any) {
        errors.push(`Failed to import ${account.email}: ${error.message}`);
      }
    }
    
    return { success, errors };
  }

  async exportFarmingAccountsToCsv(includeSecrets: boolean): Promise<any[]> {
    try {
      const accounts = await this.getFarmingAccounts();
      
      if (!includeSecrets) {
        // Return accounts without decrypting secrets
        return accounts.map(acc => ({
          id: acc.id,
          comment: acc.comment,
          socialMedia: acc.socialMedia,
          vaId: acc.vaId,
          status: acc.status,
          idName: acc.idName,
          email: acc.email,
          createdAt: acc.createdAt,
        }));
      }
      
      // Decrypt secrets for admin export
      const accountsWithSecrets = await Promise.all(
        accounts.map(async (acc) => {
          const withSecrets = await this.getFarmingAccountWithSecrets(acc.id);
          return {
            id: acc.id,
            comment: acc.comment,
            socialMedia: acc.socialMedia,
            vaId: acc.vaId,
            status: acc.status,
            idName: acc.idName,
            email: acc.email,
            recoveryEmail: withSecrets?.recoveryEmail || '',
            password: withSecrets?.passwordDecrypted || '',
            twoFaSecret: withSecrets?.twoFaSecret || '',
            createdAt: acc.createdAt,
          };
        })
      );
      
      return accountsWithSecrets;
    } catch (error) {
      console.error("[DB ERROR] Failed to export farming accounts:", error);
      return [];
    }
  }

  async getGherTags(): Promise<GherTag[]> {
    try {
      return await db.select().from(gherTags).orderBy(desc(gherTags.createdAt));
    } catch (error) {
      console.error("[DB ERROR] Failed to fetch gher tags:", error);
      return [];
    }
  }

  async getGherTag(id: string): Promise<GherTag | undefined> {
    try {
      const result = await db.select().from(gherTags).where(eq(gherTags.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to fetch gher tag:", error);
      return undefined;
    }
  }

  async createGherTag(tag: InsertGherTag): Promise<GherTag> {
    try {
      const result = await db.insert(gherTags).values(tag).returning();
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to create gher tag:", error);
      throw error;
    }
  }

  async updateGherTag(id: string, tag: Partial<InsertGherTag>): Promise<GherTag | undefined> {
    try {
      const result = await db.update(gherTags).set(tag).where(eq(gherTags.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to update gher tag:", error);
      return undefined;
    }
  }

  async deleteGherTag(id: string): Promise<boolean> {
    try {
      await db.delete(gherTags).where(eq(gherTags.id, id));
      return true;
    } catch (error) {
      console.error("[DB ERROR] Failed to delete gher tag:", error);
      return false;
    }
  }

  async getGherPartners(): Promise<GherPartner[]> {
    try {
      return await db.select().from(gherPartners).orderBy(desc(gherPartners.createdAt));
    } catch (error) {
      console.error("[DB ERROR] Failed to fetch gher partners:", error);
      return [];
    }
  }

  async getGherPartner(id: string): Promise<GherPartner | undefined> {
    try {
      const result = await db.select().from(gherPartners).where(eq(gherPartners.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to fetch gher partner:", error);
      return undefined;
    }
  }

  async createGherPartner(partner: InsertGherPartner): Promise<GherPartner> {
    try {
      const result = await db.insert(gherPartners).values(partner).returning();
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to create gher partner:", error);
      throw error;
    }
  }

  async updateGherPartner(id: string, partner: Partial<InsertGherPartner>): Promise<GherPartner | undefined> {
    try {
      const result = await db.update(gherPartners).set(partner).where(eq(gherPartners.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to update gher partner:", error);
      return undefined;
    }
  }

  async deleteGherPartner(id: string): Promise<boolean> {
    try {
      await db.delete(gherPartners).where(eq(gherPartners.id, id));
      return true;
    } catch (error) {
      console.error("[DB ERROR] Failed to delete gher partner:", error);
      return false;
    }
  }

  async getGherEntries(filters?: { startDate?: Date; endDate?: Date; partnerId?: string }): Promise<GherEntry[]> {
    try {
      let query = db.select().from(gherEntries);
      
      const conditions = [];
      if (filters?.startDate) {
        conditions.push(gte(gherEntries.date, filters.startDate));
      }
      if (filters?.endDate) {
        conditions.push(lte(gherEntries.date, filters.endDate));
      }
      if (filters?.partnerId) {
        conditions.push(eq(gherEntries.partnerId, filters.partnerId));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      return await query.orderBy(desc(gherEntries.date));
    } catch (error) {
      console.error("[DB ERROR] Failed to fetch gher entries:", error);
      return [];
    }
  }

  async getGherEntry(id: string): Promise<GherEntry | undefined> {
    try {
      const result = await db.select().from(gherEntries).where(eq(gherEntries.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to fetch gher entry:", error);
      return undefined;
    }
  }

  async createGherEntry(entry: InsertGherEntry): Promise<GherEntry> {
    try {
      const result = await db.insert(gherEntries).values(entry).returning();
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to create gher entry:", error);
      throw error;
    }
  }

  async updateGherEntry(id: string, entry: Partial<InsertGherEntry>): Promise<GherEntry | undefined> {
    try {
      const updateData = {
        ...entry,
        updatedAt: new Date(),
      };
      const result = await db.update(gherEntries).set(updateData).where(eq(gherEntries.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("[DB ERROR] Failed to update gher entry:", error);
      return undefined;
    }
  }

  async deleteGherEntry(id: string): Promise<boolean> {
    try {
      await db.delete(gherEntries).where(eq(gherEntries.id, id));
      return true;
    } catch (error) {
      console.error("[DB ERROR] Failed to delete gher entry:", error);
      return false;
    }
  }

  async getGherDashboardStats(filters?: { startDate?: Date; endDate?: Date; partnerId?: string }): Promise<{ 
    totalIncome: number; 
    totalExpense: number; 
    netBalance: number;
    expenseByTag: Array<{ tagId: string | null; tagName: string; amount: number; percentage: number }>;
    incomeByTag: Array<{ tagId: string | null; tagName: string; amount: number; percentage: number }>;
  }> {
    try {
      const entries = await this.getGherEntries(filters);
      const allTags = await this.getGherTags();
      
      let totalIncome = 0;
      let totalExpense = 0;
      const expenseByTagMap = new Map<string | null, number>();
      const incomeByTagMap = new Map<string | null, number>();
      
      entries.forEach(entry => {
        const amount = parseFloat(entry.amount);
        if (entry.type === 'income') {
          totalIncome += amount;
          const current = incomeByTagMap.get(entry.tagId) || 0;
          incomeByTagMap.set(entry.tagId, current + amount);
        } else if (entry.type === 'expense') {
          totalExpense += amount;
          const current = expenseByTagMap.get(entry.tagId) || 0;
          expenseByTagMap.set(entry.tagId, current + amount);
        }
      });
      
      const expenseByTag = Array.from(expenseByTagMap.entries())
        .map(([tagId, amount]) => {
          const tag = allTags.find(t => t.id === tagId);
          return {
            tagId,
            tagName: tag?.name || 'Untagged',
            amount,
            percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount);
      
      const incomeByTag = Array.from(incomeByTagMap.entries())
        .map(([tagId, amount]) => {
          const tag = allTags.find(t => t.id === tagId);
          return {
            tagId,
            tagName: tag?.name || 'Untagged',
            amount,
            percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount);
      
      return {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
        expenseByTag,
        incomeByTag,
      };
    } catch (error) {
      console.error("[DB ERROR] Failed to get gher dashboard stats:", error);
      return { 
        totalIncome: 0, 
        totalExpense: 0, 
        netBalance: 0,
        expenseByTag: [],
        incomeByTag: [],
      };
    }
  }
}