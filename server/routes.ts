import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { 
  loginSchema, 
  insertCampaignSchema, 
  insertCampaignDailySpendSchema,
  insertClientSchema,
  insertUserWithRoleSchema,
  insertAdAccountSchema,
  insertAdCopySetSchema,
  insertWorkReportSchema,
  insertRolePermissionSchema,
  insertFinanceProjectSchema,
  insertFinancePaymentSchema,
  insertFinanceExpenseSchema,
  insertFinanceSettingSchema,
  insertTagSchema,
  insertEmployeeSchema,
  insertUserMenuPermissionSchema,
  insertSalarySchema,
  insertTelegramConfigSchema,
  insertTelegramChatIdSchema,
  insertFarmingAccountSchema,
  type Campaign,
  type Client,
  type User,
  type FarmingAccount,
  type InsertFarmingAccount,
  type AdAccount,
  type AdCopySet,
  type WorkReport,
  type Page,
  type RolePermission,
  type FinanceProject,
  type FinancePayment,
  type FinanceExpense,
  type FinanceSetting,
  type Tag,
  type Employee,
  type UserMenuPermission,
  type Salary,
  type TelegramConfig,
  type TelegramChatId,
  UserRole,
  clients,
  campaigns,
  campaignDailySpends,
  adAccounts,
  facebookPages,
  facebookSettings
} from "@shared/schema";
import { z } from "zod";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { sendAdAccountActivationEmail, sendAdAccountSuspensionEmail, sendSpendWarningEmail } from "./email-sender";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
      };
    }
  }
}

// Middleware to authenticate requests
async function authenticate(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const session = await storage.getSessionByToken(token);
    if (!session) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }

    const user = await storage.getUser(session.userId!);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    next();
  } catch (error) {
    return res.status(500).json({ message: "Authentication error" });
  }
}

// Middleware to check Super Admin role
async function requireSuperAdmin(req: Request, res: Response, next: Function) {
  if (!req.user || req.user.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ message: "Super Admin access required" });
  }
  next();
}

// Middleware to check Admin or Super Admin role
async function requireAdminOrSuperAdmin(req: Request, res: Response, next: Function) {
  if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPER_ADMIN)) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// Middleware factory to check page permissions
function requirePagePermission(pageKey: string, action: 'view' | 'edit' | 'delete' = 'view', options: { superAdminBypass?: boolean } = {}) {
  return async (req: Request, res: Response, next: Function) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Super Admin bypass only for emergency access (admin/permissions endpoints)
    if (options.superAdminBypass && req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    try {
      const hasPermission = await storage.checkUserPagePermission(req.user.id, pageKey, action);
      if (!hasPermission) {
        return res.status(403).json({ 
          message: `Access denied. You don't have ${action} permission for this page.`
        });
      }
      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Helper function to send work report notifications via Telegram
async function sendWorkReportNotification(workReport: WorkReport, submittedByUser: { id: string; username: string; role: string }) {
  try {
    // Get Telegram configuration
    const config = await storage.getTelegramConfig();
    if (!config || !config.botToken || !config.isActive) {
      return; // No Telegram config or not active
    }

    // Get active chat IDs
    const chatIds = await storage.getTelegramChatIds();
    const activeChatIds = chatIds.filter(chat => chat.isActive);
    if (activeChatIds.length === 0) {
      return; // No active chat IDs
    }

    // Get user details for the work report
    const reportUser = await storage.getUser(workReport.userId);
    if (!reportUser) {
      return;
    }

    // Format the notification message
    const message = `
🔔 <b>New Work Report Submitted</b>

👤 <b>Employee:</b> ${reportUser.name} (@${reportUser.username})
📅 <b>Date:</b> ${new Date(workReport.date).toLocaleDateString()}
📝 <b>Title:</b> ${workReport.title}
📋 <b>Description:</b> ${workReport.description}
⏰ <b>Hours Worked:</b> ${workReport.hoursWorked}
📊 <b>Status:</b> ${workReport.status}

<i>Submitted by ${submittedByUser.username} at ${new Date().toLocaleString()}</i>
`;

    // Send message to all active chat IDs
    for (const chatId of activeChatIds) {
      try {
        const telegramApiUrl = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
        const telegramResponse = await fetch(telegramApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId.chatId,
            text: message.trim(),
            parse_mode: 'HTML'
          })
        });

        if (!telegramResponse.ok) {
          const errorData = await telegramResponse.json();
          console.error(`Failed to send Telegram notification to ${chatId.name}:`, errorData.description);
        }
      } catch (error: any) {
        console.error(`Error sending Telegram notification to ${chatId.name}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error("Error in sendWorkReportNotification:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Login route
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const { username, password } = validatedData;

      const user = await storage.validateCredentials(username, password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const session = await storage.createSession(user.id);

      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
        },
        token: session.token,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout route
  app.post("/api/auth/logout", authenticate, async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        await storage.deleteSession(token);
      }
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get current user route
  app.get("/api/auth/user", authenticate, async (req: Request, res: Response) => {
    res.json(req.user);
  });

  // Client User Management Routes
  // Get all client users
  app.get("/api/client-users", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const clientUsers = await storage.getClientUsers();
      res.json(clientUsers);
    } catch (error) {
      console.error("Get client users error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create client user
  app.post("/api/client-users", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const userData = insertUserWithRoleSchema.parse(req.body);
      
      // Ensure role is CLIENT
      if (userData.role !== UserRole.CLIENT) {
        return res.status(400).json({ message: "Invalid role. Must be 'client'" });
      }

      // Ensure clientId is provided
      if (!userData.clientId) {
        return res.status(400).json({ message: "clientId is required for client users" });
      }

      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create client user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update client user
  app.put("/api/client-users/:id", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userData = insertUserWithRoleSchema.partial().parse(req.body);

      const user = await storage.updateUser(id, userData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update client user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete client user
  app.delete("/api/client-users/:id", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteUser(id);

      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete client user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Campaign Routes
  // Get all campaigns (filtered by clientId for client users)
  app.get("/api/campaigns", authenticate, requirePagePermission('campaigns', 'view'), async (req: Request, res: Response) => {
    try {
      // Get the full user object to check clientId
      const user = await storage.getUser(req.user!.id);
      
      // If user is a client, filter campaigns by their clientId
      let clientIdFilter: string | undefined = undefined;
      if (user?.role === UserRole.CLIENT && user.clientId) {
        clientIdFilter = user.clientId;
      }

      const campaigns = await storage.getCampaigns(clientIdFilter);
      res.json(campaigns);
    } catch (error) {
      console.error("Get campaigns error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get campaign analytics with filters
  app.get("/api/campaigns/analytics", authenticate, requirePagePermission('campaigns', 'view'), async (req: Request, res: Response) => {
    try {
      const { adAccountId, campaignId, startDate, endDate } = req.query;

      const hasDateFilter = (startDate && typeof startDate === 'string') || (endDate && typeof endDate === 'string');

      // Get the full user object to check clientId
      const user = await storage.getUser(req.user!.id);

      // Build campaign filter conditions
      const campaignConditions: any[] = [];
      
      // If user is a client, filter by their clientId
      if (user?.role === UserRole.CLIENT && user.clientId) {
        campaignConditions.push(eq(campaigns.clientId, user.clientId));
      }
      
      if (adAccountId && typeof adAccountId === 'string') {
        campaignConditions.push(eq(campaigns.adAccountId, adAccountId));
      }
      
      if (campaignId && typeof campaignId === 'string') {
        campaignConditions.push(eq(campaigns.id, campaignId));
      }

      // If date filters are provided, aggregate from daily spends
      if (hasDateFilter) {
        // Build date filter conditions for daily spends
        const dateConditions: any[] = [];
        
        if (startDate && typeof startDate === 'string') {
          dateConditions.push(gte(campaignDailySpends.date, new Date(startDate)));
        }
        
        if (endDate && typeof endDate === 'string') {
          dateConditions.push(lte(campaignDailySpends.date, new Date(endDate)));
        }

        // Fetch campaigns with their daily spends in the date range
        const campaignsWithSpend = await db
          .select({
            campaignId: campaigns.id,
            campaignName: campaigns.name,
            adAccountId: campaigns.adAccountId,
            adAccountName: adAccounts.accountName,
            adAccountPlatform: adAccounts.platform,
            budget: campaigns.budget,
            dailyBudget: campaigns.dailyBudget,
            lifetimeBudget: campaigns.lifetimeBudget,
            dailySpendAmount: campaignDailySpends.amount,
          })
          .from(campaigns)
          .leftJoin(adAccounts, eq(campaigns.adAccountId, adAccounts.id))
          .leftJoin(
            campaignDailySpends,
            and(
              eq(campaignDailySpends.campaignId, campaigns.id),
              ...(dateConditions.length > 0 ? dateConditions : [])
            )
          )
          .where(campaignConditions.length > 0 ? and(...campaignConditions) : undefined);

        // Group by campaign first to calculate campaign-level spend
        const campaignSpendMap = new Map<string, {
          campaignId: string;
          campaignName: string;
          adAccountId: string | null;
          adAccountName: string | null;
          platform: string | null;
          budget: string;
          totalSpend: number;
        }>();

        campaignsWithSpend.forEach(row => {
          const campaignId = row.campaignId;
          if (!campaignSpendMap.has(campaignId)) {
            campaignSpendMap.set(campaignId, {
              campaignId: row.campaignId,
              campaignName: row.campaignName,
              adAccountId: row.adAccountId,
              adAccountName: row.adAccountName,
              platform: row.adAccountPlatform,
              budget: row.budget || row.dailyBudget || row.lifetimeBudget || '0',
              totalSpend: 0,
            });
          }
          
          const campaignData = campaignSpendMap.get(campaignId)!;
          if (row.dailySpendAmount) {
            campaignData.totalSpend += parseFloat(row.dailySpendAmount);
          }
        });

        // Group by ad account
        const adAccountStats = new Map<string, {
          adAccountId: string;
          adAccountName: string;
          platform: string;
          totalSpend: number;
          totalBudget: number;
          availableBalance: number;
          campaignCount: number;
        }>();

        campaignSpendMap.forEach(campaign => {
          const accountId = campaign.adAccountId || 'unassigned';
          const accountName = campaign.adAccountName || 'Unassigned';
          const platform = campaign.platform || 'unknown';

          if (!adAccountStats.has(accountId)) {
            adAccountStats.set(accountId, {
              adAccountId: accountId,
              adAccountName: accountName,
              platform: platform,
              totalSpend: 0,
              totalBudget: 0,
              availableBalance: 0,
              campaignCount: 0,
            });
          }

          const stats = adAccountStats.get(accountId)!;
          stats.totalSpend += campaign.totalSpend;
          stats.totalBudget += parseFloat(campaign.budget);
          stats.campaignCount += 1;
        });

        const analytics = Array.from(adAccountStats.values()).map(stat => ({
          ...stat,
          availableBalance: stat.totalBudget - stat.totalSpend,
        }));

        return res.json({
          analytics,
          totalCampaigns: campaignSpendMap.size,
          grandTotalSpend: analytics.reduce((sum, a) => sum + a.totalSpend, 0),
          grandTotalBudget: analytics.reduce((sum, a) => sum + a.totalBudget, 0),
        });
      }

      // If no date filter, use campaign's total spend
      const filteredCampaigns = await db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          spend: campaigns.spend,
          budget: campaigns.budget,
          dailyBudget: campaigns.dailyBudget,
          lifetimeBudget: campaigns.lifetimeBudget,
          adAccountId: campaigns.adAccountId,
          adAccountName: adAccounts.accountName,
          adAccountPlatform: adAccounts.platform,
        })
        .from(campaigns)
        .leftJoin(adAccounts, eq(campaigns.adAccountId, adAccounts.id))
        .where(campaignConditions.length > 0 ? and(...campaignConditions) : undefined);

      // Group by ad account
      const adAccountStats = new Map<string, {
        adAccountId: string;
        adAccountName: string;
        platform: string;
        totalSpend: number;
        totalBudget: number;
        availableBalance: number;
        campaignCount: number;
      }>();

      filteredCampaigns.forEach(campaign => {
        const accountId = campaign.adAccountId || 'unassigned';
        const accountName = campaign.adAccountName || 'Unassigned';
        const platform = campaign.adAccountPlatform || 'unknown';

        if (!adAccountStats.has(accountId)) {
          adAccountStats.set(accountId, {
            adAccountId: accountId,
            adAccountName: accountName,
            platform: platform,
            totalSpend: 0,
            totalBudget: 0,
            availableBalance: 0,
            campaignCount: 0,
          });
        }

        const stats = adAccountStats.get(accountId)!;
        const spend = parseFloat(campaign.spend || '0');
        const budget = parseFloat(campaign.budget || campaign.dailyBudget || campaign.lifetimeBudget || '0');
        
        stats.totalSpend += spend;
        stats.totalBudget += budget;
        stats.campaignCount += 1;
      });

      const analytics = Array.from(adAccountStats.values()).map(stat => ({
        ...stat,
        availableBalance: stat.totalBudget - stat.totalSpend,
      }));

      res.json({
        analytics,
        totalCampaigns: filteredCampaigns.length,
        grandTotalSpend: analytics.reduce((sum, a) => sum + a.totalSpend, 0),
        grandTotalBudget: analytics.reduce((sum, a) => sum + a.totalBudget, 0),
      });
    } catch (error) {
      console.error("Get campaign analytics error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single campaign
  app.get("/api/campaigns/:id", authenticate, requirePagePermission('campaigns', 'view'), async (req: Request, res: Response) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Get campaign error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new campaign
  app.post("/api/campaigns", authenticate, requirePagePermission('campaigns', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertCampaignSchema.parse(req.body);
      
      // Validate that client exists if clientId is provided
      if (validatedData.clientId) {
        const client = await storage.getClient(validatedData.clientId);
        if (!client) {
          return res.status(400).json({ message: "Client not found" });
        }
      }
      
      const campaign = await storage.createCampaign(validatedData);
      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create campaign error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update campaign
  app.put("/api/campaigns/:id", authenticate, requirePagePermission('campaigns', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertCampaignSchema.partial().parse(req.body);
      
      // Validate that client exists if clientId is being updated
      if (validatedData.clientId) {
        const client = await storage.getClient(validatedData.clientId);
        if (!client) {
          return res.status(400).json({ message: "Client not found" });
        }
      }
      
      const campaign = await storage.updateCampaign(req.params.id, validatedData);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update campaign error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add campaign comment
  app.post("/api/campaigns/:id/comments", authenticate, requirePagePermission('campaigns', 'edit'), async (req: Request, res: Response) => {
    try {
      const { comment } = req.body;
      if (!comment || !comment.trim()) {
        return res.status(400).json({ message: "Comment is required" });
      }

      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Add the new comment to existing comments
      const existingComments = campaign.comments || "";
      const newComments = existingComments 
        ? `${existingComments}\n\n[${new Date().toISOString()}] ${req.user?.username}: ${comment.trim()}`
        : `[${new Date().toISOString()}] ${req.user?.username}: ${comment.trim()}`;

      const updatedCampaign = await storage.updateCampaign(req.params.id, {
        comments: newComments
      });

      if (!updatedCampaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      res.json({ 
        message: "Comment added successfully",
        campaign: updatedCampaign
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Delete campaign
  app.delete("/api/campaigns/:id", authenticate, requirePagePermission('campaigns', 'delete'), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteCampaign(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json({ message: "Campaign deleted successfully" });
    } catch (error) {
      console.error("Delete campaign error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Campaign Daily Spend Routes
  // Get all daily spends for a campaign
  app.get("/api/campaigns/:id/daily-spends", authenticate, requirePagePermission('campaigns', 'view'), async (req: Request, res: Response) => {
    try {
      const spends = await storage.getCampaignDailySpends(req.params.id);
      res.json(spends);
    } catch (error) {
      console.error("Get campaign daily spends error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upsert (create or update) daily spend for a campaign
  app.post("/api/campaigns/:id/daily-spends", authenticate, requirePagePermission('campaigns', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertCampaignDailySpendSchema.parse({
        ...req.body,
        campaignId: req.params.id,
      });
      
      const spend = await storage.upsertCampaignDailySpend(validatedData);
      res.json(spend);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Upsert campaign daily spend error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get total spend for a campaign
  app.get("/api/campaigns/:id/total-spend", authenticate, requirePagePermission('campaigns', 'view'), async (req: Request, res: Response) => {
    try {
      const totalSpend = await storage.getCampaignTotalSpend(req.params.id);
      res.json({ totalSpend });
    } catch (error) {
      console.error("Get campaign total spend error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Export campaigns to CSV
  app.get("/api/campaigns/export/csv", authenticate, requirePagePermission('campaigns', 'view'), async (req: Request, res: Response) => {
    try {
      const campaigns = await storage.getCampaigns();
      
      // Get daily spends for all campaigns
      const campaignsWithSpends = await Promise.all(
        campaigns.map(async (campaign) => {
          const dailySpends = await storage.getCampaignDailySpends(campaign.id);
          return {
            ...campaign,
            dailySpends: JSON.stringify(dailySpends.map(spend => ({
              date: new Date(spend.date).toISOString(),
              amount: spend.amount
            })))
          };
        })
      );

      // Create CSV header - include ALL fields for lossless export/import
      const headers = [
        'id', 'name', 'clientId', 'adAccountId', 'startDate', 'status', 
        'spend', 'budget', 'objective', 'comments',
        'createdAt', 'updatedAt', 'dailySpends'
      ];

      // Create CSV rows
      const csvRows = [headers.join(',')];
      
      campaignsWithSpends.forEach(campaign => {
        const row = headers.map(header => {
          let value = campaign[header as keyof typeof campaign] ?? '';
          
          // Handle special formatting
          if (header === 'startDate' || header === 'endDate' || header === 'createdAt' || header === 'updatedAt') {
            value = value ? new Date(value as string).toISOString() : '';
          }
          
          // Escape commas and quotes in values
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=campaigns-export.csv');
      res.send(csvContent);
    } catch (error) {
      console.error("Export campaigns CSV error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Import campaigns from CSV
  const upload = multer({ storage: multer.memoryStorage() });
  app.post("/api/campaigns/import/csv", authenticate, requirePagePermission('campaigns', 'edit'), upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }) as Record<string, string>[];

      // Validate CSV structure
      const requiredHeaders = [
        'id', 'name', 'clientId', 'adAccountId', 'startDate', 'status',
        'spend', 'budget', 'objective', 'comments',
        'createdAt', 'updatedAt', 'dailySpends'
      ];

      if (records.length === 0) {
        return res.status(400).json({ message: "CSV file is empty" });
      }

      const firstRecord = records[0];
      const missingHeaders = requiredHeaders.filter(header => !(header in firstRecord));
      
      if (missingHeaders.length > 0) {
        return res.status(400).json({ 
          message: `Invalid CSV format. Missing columns: ${missingHeaders.join(', ')}` 
        });
      }

      let importedCount = 0;
      const errors: string[] = [];

      for (const record of records) {
        try {
          // Parse campaign data with preserved ID and timestamps
          const campaignData = {
            id: record.id,
            name: record.name,
            clientId: record.clientId || null,
            adAccountId: record.adAccountId || '',
            startDate: record.startDate ? new Date(record.startDate) : new Date(),
            status: record.status || 'active',
            spend: record.spend || '0',
            budget: record.budget || '0',
            objective: record.objective || 'awareness',
            comments: record.comments || null,
            createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
            updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date(),
          };

          // Upsert campaign (insert with preserved ID or update if exists)
          await db.insert(campaigns).values(campaignData)
            .onConflictDoUpdate({
              target: campaigns.id,
              set: {
                name: campaignData.name,
                clientId: campaignData.clientId,
                adAccountId: campaignData.adAccountId,
                startDate: campaignData.startDate,
                status: campaignData.status,
                spend: campaignData.spend,
                budget: campaignData.budget,
                objective: campaignData.objective,
                comments: campaignData.comments,
                updatedAt: campaignData.updatedAt,
              }
            });
          
          // Import daily spends if present
          if (record.dailySpends && record.dailySpends !== '') {
            try {
              const dailySpends = JSON.parse(record.dailySpends);
              for (const spend of dailySpends) {
                const spendData = {
                  campaignId: record.id,
                  date: new Date(spend.date),
                  amount: spend.amount
                };
                
                // Upsert daily spend
                await db.insert(campaignDailySpends).values(spendData)
                  .onConflictDoUpdate({
                    target: [campaignDailySpends.campaignId, campaignDailySpends.date],
                    set: {
                      amount: spendData.amount
                    }
                  });
              }
            } catch (jsonError) {
              errors.push(`Failed to parse daily spends for campaign "${record.name}"`);
            }
          }

          importedCount++;
        } catch (error) {
          errors.push(`Failed to import campaign "${record.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        message: `Successfully imported ${importedCount} campaign(s)`,
        imported: importedCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Import campaigns CSV error:", error);
      res.status(500).json({ message: "Failed to import CSV file" });
    }
  });

  // Validation schema for Facebook sync
  const syncFacebookCampaignsSchema = z.object({
    adAccountId: z.string().min(1, "Ad Account ID is required").regex(/^\d+$/, "Ad Account ID must be numeric"),
    clientId: z.string().optional().nullable(),
  });

  // Sync campaigns from Facebook Marketing API
  app.post("/api/campaigns/sync-facebook", authenticate, requirePagePermission('campaigns', 'edit'), async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = syncFacebookCampaignsSchema.parse(req.body);
      
      // Get Facebook settings
      const fbSettings = await db.select().from(facebookSettings).limit(1);
      
      if (fbSettings.length === 0 || !fbSettings[0].accessToken) {
        return res.status(400).json({ 
          message: "Facebook API not configured. Please set up your Facebook access token in settings." 
        });
      }

      const { accessToken } = fbSettings[0];
      const { adAccountId, clientId } = validatedData;

      // Fetch campaigns from Facebook Marketing API
      const fields = 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,budget_remaining,spend_cap,created_time,updated_time';
      const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns`;
      
      const response = await fetch(`${url}?fields=${fields}&access_token=${accessToken}&limit=100`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Facebook API error:", errorData);
        return res.status(400).json({ 
          message: errorData.error?.message || "Failed to fetch campaigns from Facebook" 
        });
      }

      const data = await response.json();
      const fbCampaigns = data.data || [];

      // Get insights (spend data) for each campaign
      const campaignsWithInsights = await Promise.all(
        fbCampaigns.map(async (fbCampaign: any) => {
          try {
            const insightsUrl = `https://graph.facebook.com/v21.0/${fbCampaign.id}/insights`;
            const insightsResponse = await fetch(
              `${insightsUrl}?fields=spend&access_token=${accessToken}`
            );
            
            if (insightsResponse.ok) {
              const insightsData = await insightsResponse.json();
              const spend = insightsData.data?.[0]?.spend || '0';
              return { ...fbCampaign, spend };
            }
          } catch (error) {
            console.error(`Failed to fetch insights for campaign ${fbCampaign.id}:`, error);
          }
          return { ...fbCampaign, spend: '0' };
        })
      );

      // Get the ad account to link campaigns
      const adAccount = await db.select().from(adAccounts)
        .where(eq(adAccounts.accountId, adAccountId))
        .limit(1);

      let dbAdAccountId = adAccount[0]?.id;

      // If ad account doesn't exist, create it
      if (!dbAdAccountId) {
        const newAdAccount = await db.insert(adAccounts).values({
          platform: 'facebook',
          accountName: `Ad Account ${adAccountId}`,
          accountId: adAccountId,
          clientId: clientId || null,
          spendLimit: '999999',
          status: 'active'
        }).returning();
        dbAdAccountId = newAdAccount[0].id;
      }

      let syncedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      // Sync each campaign
      for (const fbCampaign of campaignsWithInsights) {
        try {
          // Convert budget from cents to dollars
          const dailyBudget = fbCampaign.daily_budget ? (parseFloat(fbCampaign.daily_budget) / 100).toFixed(2) : null;
          const lifetimeBudget = fbCampaign.lifetime_budget ? (parseFloat(fbCampaign.lifetime_budget) / 100).toFixed(2) : null;
          const budgetRemaining = fbCampaign.budget_remaining ? (parseFloat(fbCampaign.budget_remaining) / 100).toFixed(2) : null;
          const spend = fbCampaign.spend ? parseFloat(fbCampaign.spend).toFixed(2) : '0';

          // Determine which budget to use as the main budget
          const mainBudget = dailyBudget || lifetimeBudget || '0';

          const campaignData = {
            name: fbCampaign.name,
            startDate: fbCampaign.created_time ? new Date(fbCampaign.created_time) : new Date(),
            adAccountId: dbAdAccountId,
            clientId: clientId || null,
            status: fbCampaign.status === 'ACTIVE' ? 'active' : fbCampaign.status === 'PAUSED' ? 'paused' : 'completed',
            objective: fbCampaign.objective || 'awareness',
            budget: mainBudget,
            spend: spend,
            fbCampaignId: fbCampaign.id,
            isSynced: true,
            dailyBudget: dailyBudget,
            lifetimeBudget: lifetimeBudget,
            budgetRemaining: budgetRemaining,
            effectiveStatus: fbCampaign.effective_status,
            lastSyncedAt: new Date(),
            updatedAt: fbCampaign.updated_time ? new Date(fbCampaign.updated_time) : new Date(),
          };

          // Check if campaign already exists by fbCampaignId
          const existingCampaign = await db.select().from(campaigns)
            .where(eq(campaigns.fbCampaignId, fbCampaign.id))
            .limit(1);

          if (existingCampaign.length > 0) {
            // Update existing campaign
            await db.update(campaigns)
              .set(campaignData)
              .where(eq(campaigns.id, existingCampaign[0].id));
            updatedCount++;
          } else {
            // Insert new campaign
            await db.insert(campaigns).values(campaignData);
            syncedCount++;
          }
        } catch (error) {
          console.error(`Error syncing campaign ${fbCampaign.name}:`, error);
          errors.push(`Failed to sync campaign "${fbCampaign.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        message: `Successfully synced ${syncedCount} new campaign(s) and updated ${updatedCount} existing campaign(s)`,
        synced: syncedCount,
        updated: updatedCount,
        total: fbCampaigns.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Sync Facebook campaigns error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to sync campaigns from Facebook" 
      });
    }
  });

  // Client Routes
  // Get all clients
  app.get("/api/clients", authenticate, requirePagePermission('clients', 'view'), async (req: Request, res: Response) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Get clients error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single client
  app.get("/api/clients/:id", authenticate, requirePagePermission('clients', 'view'), async (req: Request, res: Response) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Get client error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new client
  app.post("/api/clients", authenticate, requirePagePermission('clients', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validatedData);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create client error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update client
  app.put("/api/clients/:id", authenticate, requirePagePermission('clients', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, validatedData);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update client error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete client
  app.delete("/api/clients/:id", authenticate, requirePagePermission('clients', 'delete'), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Delete client error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Export clients to CSV
  app.get("/api/clients/export/csv", authenticate, requirePagePermission('clients', 'view'), async (req: Request, res: Response) => {
    try {
      const clients = await storage.getClients();

      // Create CSV header
      const headers = [
        'id', 'clientName', 'businessName', 'contactPerson', 'email', 
        'phone', 'address', 'notes', 'status', 'createdAt', 'updatedAt'
      ];

      // Create CSV rows
      const csvRows = [headers.join(',')];
      
      clients.forEach(client => {
        const row = headers.map(header => {
          let value = client[header as keyof typeof client] ?? '';
          
          // Handle special formatting
          if (header === 'createdAt' || header === 'updatedAt') {
            value = value ? new Date(value as string).toISOString() : '';
          }
          
          // Escape commas and quotes in values
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=clients-export.csv');
      res.send(csvContent);
    } catch (error) {
      console.error("Export clients CSV error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Import clients from CSV
  app.post("/api/clients/import/csv", authenticate, requirePagePermission('clients', 'edit'), upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }) as Record<string, string>[];

      // Validate CSV structure
      const requiredHeaders = [
        'id', 'clientName', 'businessName', 'contactPerson', 'email',
        'phone', 'address', 'notes', 'status', 'createdAt', 'updatedAt'
      ];

      if (records.length === 0) {
        return res.status(400).json({ message: "CSV file is empty" });
      }

      const firstRecord = records[0];
      const missingHeaders = requiredHeaders.filter(header => !(header in firstRecord));
      
      if (missingHeaders.length > 0) {
        return res.status(400).json({ 
          message: `Invalid CSV format. Missing columns: ${missingHeaders.join(', ')}` 
        });
      }

      let importedCount = 0;
      const errors: string[] = [];

      for (const record of records) {
        try {
          // Parse client data with preserved ID and timestamps
          const clientData = {
            id: record.id,
            clientName: record.clientName,
            businessName: record.businessName,
            contactPerson: record.contactPerson,
            email: record.email,
            phone: record.phone,
            address: record.address || null,
            notes: record.notes || null,
            status: record.status || 'active',
            createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
            updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date(),
          };

          // Upsert client (insert with preserved ID or update if exists)
          await db.insert(clients).values(clientData)
            .onConflictDoUpdate({
              target: clients.id,
              set: {
                clientName: clientData.clientName,
                businessName: clientData.businessName,
                contactPerson: clientData.contactPerson,
                email: clientData.email,
                phone: clientData.phone,
                address: clientData.address,
                notes: clientData.notes,
                status: clientData.status,
                updatedAt: clientData.updatedAt,
              }
            });
          
          importedCount++;
        } catch (error) {
          errors.push(`Failed to import client "${record.clientName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        message: `Successfully imported ${importedCount} client(s)`,
        imported: importedCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Import clients CSV error:", error);
      res.status(500).json({ message: "Failed to import CSV file" });
    }
  });

  // User Management Routes (Super Admin only)
  // Get all users
  app.get("/api/users", authenticate, requirePagePermission('admin', 'view', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new user
  app.post("/api/users", authenticate, requirePagePermission('admin', 'edit', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserWithRoleSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update user (role changes)
  app.put("/api/users/:id", authenticate, requirePagePermission('admin', 'edit', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserWithRoleSchema.partial().parse(req.body);
      const user = await storage.updateUser(req.params.id, validatedData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", authenticate, requirePagePermission('admin', 'delete', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User Menu Permissions Routes
  // Get all user menu permissions or for a specific user
  app.get("/api/user-menu-permissions", authenticate, requirePagePermission('admin', 'view', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const { userId } = req.query;
      const permissions = await storage.getUserMenuPermissions(userId as string);
      res.json(permissions);
    } catch (error) {
      console.error("Get user menu permissions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user menu permission for a specific user
  app.get("/api/user-menu-permissions/:userId", authenticate, requirePagePermission('admin', 'view', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const permission = await storage.getUserMenuPermission(req.params.userId);
      if (!permission) {
        return res.status(404).json({ message: "User menu permission not found" });
      }
      res.json(permission);
    } catch (error) {
      console.error("Get user menu permission error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new user menu permission
  app.post("/api/user-menu-permissions", authenticate, requirePagePermission('admin', 'edit', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserMenuPermissionSchema.parse(req.body);
      
      // Validate that user exists
      const user = await storage.getUser(validatedData.userId);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
      
      const permission = await storage.createUserMenuPermission(validatedData);
      res.status(201).json(permission);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create user menu permission error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update user menu permission
  app.put("/api/user-menu-permissions/:userId", authenticate, requirePagePermission('admin', 'edit', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserMenuPermissionSchema.partial().parse(req.body);
      const permission = await storage.updateUserMenuPermission(req.params.userId, validatedData);
      if (!permission) {
        return res.status(404).json({ message: "User menu permission not found" });
      }
      res.json(permission);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update user menu permission error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete user menu permission
  app.delete("/api/user-menu-permissions/:userId", authenticate, requirePagePermission('admin', 'edit', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteUserMenuPermission(req.params.userId);
      if (!deleted) {
        return res.status(404).json({ message: "User menu permission not found" });
      }
      res.json({ message: "User menu permission deleted successfully" });
    } catch (error) {
      console.error("Delete user menu permission error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Ad Accounts Routes
  // Get all ad accounts (filtered by clientId for client users)
  app.get("/api/ad-accounts", authenticate, requirePagePermission('ad_accounts', 'view'), async (req: Request, res: Response) => {
    try {
      // Get the full user object to check clientId
      const user = await storage.getUser(req.user!.id);
      
      // If user is a client, filter ad accounts by their clientId
      let clientIdFilter: string | undefined = undefined;
      if (user?.role === UserRole.CLIENT && user.clientId) {
        clientIdFilter = user.clientId;
      }

      const adAccounts = await storage.getAdAccounts(clientIdFilter);
      res.json(adAccounts);
    } catch (error) {
      console.error("Get ad accounts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single ad account
  app.get("/api/ad-accounts/:id", authenticate, requirePagePermission('ad_accounts', 'view'), async (req: Request, res: Response) => {
    try {
      const adAccount = await storage.getAdAccount(req.params.id);
      if (!adAccount) {
        return res.status(404).json({ message: "Ad account not found" });
      }
      res.json(adAccount);
    } catch (error) {
      console.error("Get ad account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new ad account
  app.post("/api/ad-accounts", authenticate, requirePagePermission('ad_accounts', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertAdAccountSchema.parse(req.body);
      
      // Validate that client exists if clientId is provided
      if (validatedData.clientId) {
        const client = await storage.getClient(validatedData.clientId);
        if (!client) {
          return res.status(400).json({ message: "Client not found" });
        }
      }
      
      const adAccount = await storage.createAdAccount(validatedData);
      res.status(201).json(adAccount);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create ad account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update ad account
  app.put("/api/ad-accounts/:id", authenticate, requirePagePermission('ad_accounts', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertAdAccountSchema.partial().parse(req.body);
      
      // Validate that client exists if clientId is being updated
      if (validatedData.clientId) {
        const client = await storage.getClient(validatedData.clientId);
        if (!client) {
          return res.status(400).json({ message: "Client not found" });
        }
      }
      
      // Get old ad account to check for status changes
      const oldAdAccount = await storage.getAdAccount(req.params.id);
      if (!oldAdAccount) {
        return res.status(404).json({ message: "Ad account not found" });
      }
      
      const adAccount = await storage.updateAdAccount(req.params.id, validatedData);
      if (!adAccount) {
        return res.status(404).json({ message: "Ad account not found" });
      }
      
      // AUTOMATIC EMAIL SENDING DISABLED - Use Client Mailbox for manual emails
      // if (validatedData.status && validatedData.status !== oldAdAccount.status) {
      //   ... automatic email code removed ...
      // }
      
      res.json(adAccount);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update ad account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete ad account
  app.delete("/api/ad-accounts/:id", authenticate, requirePagePermission('ad_accounts', 'delete'), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteAdAccount(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Ad account not found" });
      }
      res.json({ message: "Ad account deleted successfully" });
    } catch (error) {
      console.error("Delete ad account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Export ad accounts to CSV
  app.get("/api/ad-accounts/export/csv", authenticate, requirePagePermission('ad_accounts', 'view'), async (req: Request, res: Response) => {
    try {
      const adAccounts = await storage.getAdAccounts();

      // Create CSV header - include ALL fields for lossless export/import
      const headers = [
        'id', 'platform', 'accountName', 'accountId', 'clientId', 
        'spendLimit', 'totalSpend', 'status', 'notes',
        'createdAt', 'updatedAt'
      ];

      // Create CSV rows
      const csvRows = [headers.join(',')];
      
      adAccounts.forEach(account => {
        const row = headers.map(header => {
          let value = account[header as keyof typeof account] ?? '';
          
          // Handle special formatting
          if (header === 'createdAt' || header === 'updatedAt') {
            value = value ? new Date(value as string).toISOString() : '';
          }
          
          // Escape commas and quotes in values
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=ad-accounts-export.csv');
      res.send(csvContent);
    } catch (error) {
      console.error("Export ad accounts CSV error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Import ad accounts from CSV
  app.post("/api/ad-accounts/import/csv", authenticate, requirePagePermission('ad_accounts', 'edit'), upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvData = req.file.buffer.toString('utf-8');
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }) as Record<string, string>[];

      // Validate CSV structure
      const requiredHeaders = [
        'id', 'platform', 'accountName', 'accountId', 'clientId',
        'spendLimit', 'totalSpend', 'status', 'notes',
        'createdAt', 'updatedAt'
      ];

      if (records.length === 0) {
        return res.status(400).json({ message: "CSV file is empty" });
      }

      const fileHeaders = Object.keys(records[0]);
      const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h));
      if (missingHeaders.length > 0) {
        return res.status(400).json({ 
          message: `Missing required columns: ${missingHeaders.join(', ')}` 
        });
      }

      // Process and insert/update ad accounts
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const record of records) {
        try {
          // Prepare ad account data with preserved ID and timestamps
          const adAccountData = {
            id: record.id,
            platform: record.platform,
            accountName: record.accountName,
            accountId: record.accountId,
            clientId: record.clientId,
            spendLimit: record.spendLimit,
            totalSpend: record.totalSpend || '0',
            status: record.status || 'active',
            notes: record.notes || null,
            createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
            updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date(),
          };

          // Use upsert to preserve IDs and update existing records
          await db.insert(adAccounts)
            .values(adAccountData)
            .onConflictDoUpdate({
              target: adAccounts.id,
              set: {
                platform: adAccountData.platform,
                accountName: adAccountData.accountName,
                accountId: adAccountData.accountId,
                clientId: adAccountData.clientId,
                spendLimit: adAccountData.spendLimit,
                totalSpend: adAccountData.totalSpend,
                status: adAccountData.status,
                notes: adAccountData.notes,
                createdAt: adAccountData.createdAt,
                updatedAt: adAccountData.updatedAt,
              }
            });

          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`Row ${successCount + errorCount}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (errorCount > 0) {
        return res.status(207).json({ 
          message: `Imported ${successCount} ad accounts with ${errorCount} errors`,
          successCount,
          errorCount,
          errors: errors.slice(0, 10)
        });
      }

      res.json({ 
        message: `Successfully imported ${successCount} ad accounts`,
        successCount 
      });
    } catch (error) {
      console.error("Import ad accounts CSV error:", error);
      res.status(500).json({ message: "Failed to import CSV" });
    }
  });

  // ====== AD COPY SETS ROUTES ======
  
  // Get ad copy sets for a campaign
  app.get("/api/campaigns/:campaignId/ad-copy-sets", authenticate, requirePagePermission('campaigns', 'view'), async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      const adCopySets = await storage.getAdCopySets(campaignId);
      res.json(adCopySets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ad copy sets" });
    }
  });

  // Get single ad copy set
  app.get("/api/ad-copy-sets/:id", authenticate, requirePagePermission('campaigns', 'view'), async (req: Request, res: Response) => {
    try {
      const adCopySet = await storage.getAdCopySet(req.params.id);
      if (!adCopySet) {
        return res.status(404).json({ message: "Ad copy set not found" });
      }
      res.json(adCopySet);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ad copy set" });
    }
  });

  // Create new ad copy set
  app.post("/api/campaigns/:campaignId/ad-copy-sets", authenticate, requirePagePermission('campaigns', 'edit'), async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      const validatedData = insertAdCopySetSchema.parse({
        ...req.body,
        campaignId,
      });
      
      // Validate that campaign exists
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(400).json({ message: "Campaign not found" });
      }

      const adCopySet = await storage.createAdCopySet(validatedData);
      res.status(201).json(adCopySet);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create ad copy set" });
    }
  });

  // Update ad copy set
  app.put("/api/ad-copy-sets/:id", authenticate, requirePagePermission('campaigns', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertAdCopySetSchema.partial().parse(req.body);
      const adCopySet = await storage.updateAdCopySet(req.params.id, validatedData);
      
      if (!adCopySet) {
        return res.status(404).json({ message: "Ad copy set not found" });
      }
      
      res.json(adCopySet);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update ad copy set" });
    }
  });

  // Set active ad copy set
  app.put("/api/campaigns/:campaignId/ad-copy-sets/:id/set-active", authenticate, requirePagePermission('campaigns', 'edit'), async (req: Request, res: Response) => {
    try {
      const { campaignId, id } = req.params;
      const success = await storage.setActiveAdCopySet(campaignId, id);
      
      if (!success) {
        return res.status(400).json({ message: "Failed to set active ad copy set" });
      }
      
      res.json({ message: "Ad copy set set as active" });
    } catch (error) {
      res.status(500).json({ message: "Failed to set active ad copy set" });
    }
  });

  // Delete ad copy set
  app.delete("/api/ad-copy-sets/:id", authenticate, requirePagePermission('campaigns', 'delete'), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteAdCopySet(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Ad copy set not found" });
      }
      res.json({ message: "Ad copy set deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete ad copy set" });
    }
  });

  // Work Report Routes
  
  // Get work reports - users see only their own, admins see all
  app.get("/api/work-reports", authenticate, requirePagePermission('work_reports', 'view'), async (req: Request, res: Response) => {
    try {
      let workReports: WorkReport[];
      
      if (req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN) {
        // Admin/Super Admin can see all work reports
        workReports = await storage.getWorkReports();
      } else {
        // Regular users see only their own work reports
        workReports = await storage.getWorkReports(req.user!.id);
      }
      
      res.json(workReports);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch work reports" });
    }
  });

  // Get single work report - check ownership or admin access
  app.get("/api/work-reports/:id", authenticate, requirePagePermission('work_reports', 'view'), async (req: Request, res: Response) => {
    try {
      const workReport = await storage.getWorkReport(req.params.id);
      if (!workReport) {
        return res.status(404).json({ message: "Work report not found" });
      }
      
      // Check if user can access this work report
      const isAdmin = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;
      const isOwner = workReport.userId === req.user!.id;
      
      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(workReport);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch work report" });
    }
  });

  // Create new work report
  app.post("/api/work-reports", authenticate, requirePagePermission('work_reports', 'edit'), async (req: Request, res: Response) => {
    try {
      let validatedData;
      
      if (req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN) {
        // Admin can create work reports for any user (if userId is provided)
        validatedData = insertWorkReportSchema.parse({
          ...req.body,
          userId: req.body.userId || req.user!.id // Default to current user if not specified
        });
      } else {
        // Regular users can only create work reports for themselves
        validatedData = insertWorkReportSchema.parse({
          ...req.body,
          userId: req.user!.id // Force current user
        });
      }
      
      const workReport = await storage.createWorkReport(validatedData);
      
      // Send Telegram notification for new work report (async, don't block response)
      sendWorkReportNotification(workReport, req.user!).catch(error => {
        console.error("Failed to send Telegram notification for work report:", error);
      });
      
      res.status(201).json(workReport);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create work report" });
    }
  });

  // Update work report - check ownership or admin access
  app.put("/api/work-reports/:id", authenticate, requirePagePermission('work_reports', 'edit'), async (req: Request, res: Response) => {
    try {
      const existingReport = await storage.getWorkReport(req.params.id);
      if (!existingReport) {
        return res.status(404).json({ message: "Work report not found" });
      }
      
      // Check if user can update this work report
      const isAdmin = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;
      const isOwner = existingReport.userId === req.user!.id;
      
      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validatedData = insertWorkReportSchema.partial().parse(req.body);
      
      // Prevent non-admin users from changing userId
      if (!isAdmin && validatedData.userId && validatedData.userId !== req.user!.id) {
        return res.status(403).json({ message: "Cannot change work report owner" });
      }
      
      const workReport = await storage.updateWorkReport(req.params.id, validatedData);
      res.json(workReport);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update work report" });
    }
  });

  // Delete all work reports - Admin only (MUST come before /:id route)
  app.delete("/api/work-reports/all", authenticate, async (req: Request, res: Response) => {
    try {
      // Only admins can delete all work reports
      const isAdmin = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;
      
      if (!isAdmin) {
        return res.status(403).json({ message: "Access denied. Only administrators can delete all work reports." });
      }
      
      const deletedCount = await storage.deleteAllWorkReports();
      
      res.json({ 
        message: "All work reports deleted successfully",
        deletedCount 
      });
    } catch (error) {
      console.error("Error deleting all work reports:", error);
      res.status(500).json({ message: "Failed to delete work reports" });
    }
  });

  // Delete work report - check ownership or admin access
  app.delete("/api/work-reports/:id", authenticate, requirePagePermission('work_reports', 'delete'), async (req: Request, res: Response) => {
    try {
      const existingReport = await storage.getWorkReport(req.params.id);
      if (!existingReport) {
        return res.status(404).json({ message: "Work report not found" });
      }
      
      // Check if user can delete this work report
      const isAdmin = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;
      const isOwner = existingReport.userId === req.user!.id;
      
      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const deleted = await storage.deleteWorkReport(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Work report not found" });
      }
      
      res.json({ message: "Work report deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete work report" });
    }
  });

  // === PAGE PERMISSIONS ROUTES ===
  
  // Get all pages (Super Admin only)
  app.get("/api/pages", authenticate, requirePagePermission('admin', 'view', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const pages = await storage.getPages();
      res.json(pages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pages" });
    }
  });

  // Get all role permissions (Super Admin only)
  app.get("/api/role-permissions", authenticate, requirePagePermission('admin', 'view', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const permissions = await storage.getRolePermissions();
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  // Get role permissions for a specific role (Super Admin only)
  app.get("/api/role-permissions/:role", authenticate, requirePagePermission('admin', 'view', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const permissions = await storage.getRolePermissions(req.params.role);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  // Update role permission (Super Admin only)
  app.put("/api/role-permissions/:id", authenticate, requirePagePermission('admin', 'edit', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const validatedData = insertRolePermissionSchema.partial().parse(req.body);
      const permission = await storage.updateRolePermission(req.params.id, validatedData);
      
      if (!permission) {
        return res.status(404).json({ message: "Role permission not found" });
      }
      
      res.json(permission);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update role permission" });
    }
  });

  // Bulk update role permissions (Super Admin only)
  app.put("/api/role-permissions/bulk", authenticate, requirePagePermission('admin', 'edit', { superAdminBypass: true }), async (req: Request, res: Response) => {
    try {
      const updates = z.array(z.object({
        id: z.string(),
        canView: z.boolean().optional(),
        canEdit: z.boolean().optional(),
        canDelete: z.boolean().optional(),
      })).parse(req.body);

      const updatedPermissions = [];
      for (const update of updates) {
        const { id, ...updateData } = update;
        const permission = await storage.updateRolePermission(id, updateData);
        if (permission) {
          updatedPermissions.push(permission);
        }
      }

      res.json(updatedPermissions);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update role permissions" });
    }
  });

  // Check user permission for a specific page
  app.get("/api/permissions/check/:pageKey", authenticate, async (req: Request, res: Response) => {
    try {
      const { pageKey } = req.params;
      const { action = 'view' } = req.query;
      
      if (!['view', 'edit', 'delete'].includes(action as string)) {
        return res.status(400).json({ message: "Invalid action. Must be 'view', 'edit', or 'delete'" });
      }
      
      const hasPermission = await storage.checkUserPagePermission(
        req.user!.id, 
        pageKey, 
        action as 'view' | 'edit' | 'delete'
      );
      
      res.json({ hasPermission });
    } catch (error) {
      res.status(500).json({ message: "Failed to check permission" });
    }
  });

  // Finance Routes
  
  // Finance Projects
  app.get("/api/finance/projects", authenticate, requirePagePermission('finance', 'view'), async (req: Request, res: Response) => {
    try {
      const projects = await storage.getFinanceProjects();
      res.json(projects);
    } catch (error) {
      console.error("Get finance projects error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/finance/projects/:id", authenticate, requirePagePermission('finance', 'view'), async (req: Request, res: Response) => {
    try {
      const project = await storage.getFinanceProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Get finance project error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/finance/projects", authenticate, requirePagePermission('finance', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertFinanceProjectSchema.parse(req.body);
      
      // Validate that client exists
      const client = await storage.getClient(validatedData.clientId);
      if (!client) {
        return res.status(400).json({ message: "Client not found" });
      }
      
      const project = await storage.createFinanceProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create finance project error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/finance/projects/:id", authenticate, requirePagePermission('finance', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertFinanceProjectSchema.partial().parse(req.body);
      
      // Validate that client exists if clientId is being updated
      if (validatedData.clientId) {
        const client = await storage.getClient(validatedData.clientId);
        if (!client) {
          return res.status(400).json({ message: "Client not found" });
        }
      }
      
      const project = await storage.updateFinanceProject(req.params.id, validatedData);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update finance project error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/finance/projects/:id", authenticate, requirePagePermission('finance', 'delete'), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteFinanceProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Delete finance project error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Finance Payments
  app.get("/api/finance/payments", authenticate, requirePagePermission('finance', 'view'), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.query;
      const payments = await storage.getFinancePayments(projectId as string);
      res.json(payments);
    } catch (error) {
      console.error("Get finance payments error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/finance/payments/:id", authenticate, requirePagePermission('finance', 'view'), async (req: Request, res: Response) => {
    try {
      const payment = await storage.getFinancePayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      console.error("Get finance payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/finance/payments", authenticate, requirePagePermission('finance', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertFinancePaymentSchema.parse(req.body);
      
      // Validate that client and project exist
      const client = await storage.getClient(validatedData.clientId);
      if (!client) {
        return res.status(400).json({ message: "Client not found" });
      }
      
      const project = await storage.getFinanceProject(validatedData.projectId);
      if (!project) {
        return res.status(400).json({ message: "Project not found" });
      }
      
      const payment = await storage.createFinancePayment(validatedData);
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create finance payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/finance/payments/:id", authenticate, requirePagePermission('finance', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertFinancePaymentSchema.partial().parse(req.body);
      
      const payment = await storage.updateFinancePayment(req.params.id, validatedData);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update finance payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/finance/payments/:id", authenticate, requirePagePermission('finance', 'delete'), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteFinancePayment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json({ message: "Payment deleted successfully" });
    } catch (error) {
      console.error("Delete finance payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Finance Expenses
  app.get("/api/finance/expenses", authenticate, requirePagePermission('finance', 'view'), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.query;
      const expenses = await storage.getFinanceExpenses(projectId as string);
      res.json(expenses);
    } catch (error) {
      console.error("Get finance expenses error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/finance/expenses/:id", authenticate, requirePagePermission('finance', 'view'), async (req: Request, res: Response) => {
    try {
      const expense = await storage.getFinanceExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error("Get finance expense error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/finance/expenses", authenticate, requirePagePermission('finance', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertFinanceExpenseSchema.parse(req.body);
      
      // Validate that project exists if projectId is provided
      if (validatedData.projectId) {
        const project = await storage.getFinanceProject(validatedData.projectId);
        if (!project) {
          return res.status(400).json({ message: "Project not found" });
        }
      }
      
      const expense = await storage.createFinanceExpense(validatedData);
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create finance expense error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/finance/expenses/:id", authenticate, requirePagePermission('finance', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertFinanceExpenseSchema.partial().parse(req.body);
      
      const expense = await storage.updateFinanceExpense(req.params.id, validatedData);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update finance expense error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/finance/expenses/:id", authenticate, requirePagePermission('finance', 'delete'), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteFinanceExpense(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error("Delete finance expense error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/finance/expenses/delete-all", authenticate, requirePagePermission('finance', 'delete'), async (req: Request, res: Response) => {
    try {
      const count = await storage.deleteAllFinanceExpenses();
      res.json({ message: `${count} expense(s) deleted successfully`, count });
    } catch (error) {
      console.error("Delete all finance expenses error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // CSV Preview for expenses (Step 1: Show data before importing)
  app.post("/api/finance/expenses/import-csv/preview", authenticate, requirePagePermission('finance', 'edit'), upload.single('csvFile'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      
      // Parse CSV data
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      let validRecords: any[] = [];
      let errors: string[] = [];

      // Process each record for preview
      for (let i = 0; i < records.length; i++) {
        const record = records[i] as any;
        const rowNumber = i + 2;

        try {
          // Validate required fields
          if (!record.type || !record.amount || !record.currency || !record.date) {
            errors.push(`Row ${rowNumber}: Missing required fields (type, amount, currency, date)`);
            continue;
          }

          // Normalize and validate type
          const typeLC = record.type.trim().toLowerCase();
          if (!['expense', 'salary'].includes(typeLC)) {
            errors.push(`Row ${rowNumber}: Type must be 'expense' or 'salary', got '${record.type}'`);
            continue;
          }

          // Validate currency
          const currencyUC = record.currency.trim().toUpperCase();
          if (!['USD', 'BDT'].includes(currencyUC)) {
            errors.push(`Row ${rowNumber}: Currency must be 'USD' or 'BDT', got '${record.currency}'`);
            continue;
          }

          // Validate amount
          const amount = parseFloat(record.amount);
          if (isNaN(amount) || amount <= 0) {
            errors.push(`Row ${rowNumber}: Amount must be a positive number, got '${record.amount}'`);
            continue;
          }

          // Validate date format
          const date = new Date(record.date);
          if (isNaN(date.getTime())) {
            errors.push(`Row ${rowNumber}: Date must be in YYYY-MM-DD format, got '${record.date}'`);
            continue;
          }

          // Validate projectId if provided
          let projectId: string | null = null;
          let projectName = 'No Project';
          if (record.projectId && record.projectId.trim() !== '') {
            const project = await storage.getFinanceProject(record.projectId.trim());
            if (!project) {
              errors.push(`Row ${rowNumber}: Project ID '${record.projectId}' not found`);
              continue;
            }
            projectId = record.projectId.trim();
            projectName = project.name;
          }

          // Create validated record for preview
          const validRecord = {
            rowNumber,
            type: typeLC,
            projectId,
            projectName,
            amount: amount.toString(),
            currency: currencyUC,
            date: date.toISOString().split('T')[0],
            notes: record.notes || '',
            originalRow: record
          };

          validRecords.push(validRecord);

        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            errors.push(`Row ${rowNumber}: ${validationError.errors.map(e => e.message).join(', ')}`);
          } else {
            errors.push(`Row ${rowNumber}: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`);
          }
        }
      }

      res.json({
        message: `Preview ready: ${validRecords.length} valid records, ${errors.length} errors`,
        validRecords,
        totalRows: records.length,
        validCount: validRecords.length,
        errorCount: errors.length,
        errors: errors,
      });

    } catch (error) {
      console.error("CSV Preview error:", error);
      res.status(500).json({ message: "Internal server error during preview" });
    }
  });

  // CSV Import for expenses (Step 2: Actually save the data)
  app.post("/api/finance/expenses/import-csv/confirm", authenticate, requirePagePermission('finance', 'edit'), async (req: Request, res: Response) => {
    try {
      const { validRecords } = req.body;
      
      if (!validRecords || !Array.isArray(validRecords)) {
        return res.status(400).json({ message: "Invalid data: validRecords array required" });
      }

      let imported = 0;
      let errors: string[] = [];

      for (const record of validRecords) {
        try {
          // Create expense data
          const expenseData = {
            type: record.type as 'expense' | 'salary',
            projectId: record.projectId || null,
            amount: record.amount,
            currency: record.currency as 'USD' | 'BDT',
            date: new Date(record.date),
            notes: record.notes || '',
          };

          // Validate with schema
          const validatedData = insertFinanceExpenseSchema.parse(expenseData);
          
          // Create the expense
          await storage.createFinanceExpense(validatedData);
          imported++;

        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            errors.push(`Row ${record.rowNumber}: ${validationError.errors.map(e => e.message).join(', ')}`);
          } else {
            errors.push(`Row ${record.rowNumber}: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`);
          }
        }
      }

      if (imported === 0 && errors.length > 0) {
        return res.status(400).json({
          message: "No records were imported due to validation errors",
          imported: 0,
          errors: errors.length,
          errorDetails: errors,
        });
      }

      res.json({
        message: `Import completed successfully! ${imported} expenses imported.`,
        imported,
        errors: errors.length,
        errorDetails: errors,
      });

    } catch (error) {
      console.error("CSV Confirm error:", error);
      res.status(500).json({ message: "Internal server error during import" });
    }
  });

  // Finance Settings
  app.get("/api/finance/settings/:key", authenticate, requirePagePermission('finance', 'view'), async (req: Request, res: Response) => {
    try {
      const setting = await storage.getFinanceSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Get finance setting error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/finance/settings", authenticate, requirePagePermission('finance', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertFinanceSettingSchema.parse(req.body);
      const setting = await storage.setFinanceSetting(validatedData);
      res.json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Set finance setting error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get exchange rate
  app.get("/api/finance/exchange-rate", authenticate, requirePagePermission('finance', 'view'), async (req: Request, res: Response) => {
    try {
      const rate = await storage.getExchangeRate();
      res.json({ rate });
    } catch (error) {
      console.error("Get exchange rate error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Finance Dashboard Analytics
  app.get("/api/finance/dashboard", authenticate, requirePagePermission('finance', 'view'), async (req: Request, res: Response) => {
    try {
      const { period = 'month' } = req.query;
      
      // Get all data for calculations
      const projects = await storage.getFinanceProjects();
      const payments = await storage.getFinancePayments();
      const expenses = await storage.getFinanceExpenses();
      const exchangeRate = await storage.getExchangeRate();
      
      // Calculate totals for payments
      const totalPaymentsUSD = payments.reduce((sum: number, payment: FinancePayment) => sum + parseFloat(payment.amount), 0);
      const totalPaymentsBDT = payments.reduce((sum: number, payment: FinancePayment) => sum + parseFloat(payment.convertedAmount), 0);
      
      // Calculate totals for expenses (both expense and salary types)
      const totalExpensesBDT = expenses.reduce((sum: number, expense: FinanceExpense) => sum + parseFloat(expense.amount), 0);
      const totalExpensesUSD = totalExpensesBDT / exchangeRate;
      
      // Calculate Available Balance
      const availableBalanceUSD = totalPaymentsUSD - totalExpensesUSD;
      const availableBalanceBDT = totalPaymentsBDT - totalExpensesBDT;
      
      // Legacy calculations for backwards compatibility
      const expensesOnlyBDT = expenses.filter((e: FinanceExpense) => e.type === 'expense').reduce((sum: number, expense: FinanceExpense) => sum + parseFloat(expense.amount), 0);
      const totalSalariesBDT = expenses.filter((e: FinanceExpense) => e.type === 'salary').reduce((sum: number, expense: FinanceExpense) => sum + parseFloat(expense.amount), 0);
      const totalFundUSD = totalPaymentsUSD;
      const totalFundBDT = totalPaymentsBDT;
      const netBalanceBDT = totalPaymentsBDT - expensesOnlyBDT - totalSalariesBDT;
      
      // Group payments by month for chart
      const paymentsByMonth = payments.reduce((acc: Record<string, number>, payment: FinancePayment) => {
        const month = new Date(payment.date).toLocaleString('default', { month: 'short', year: 'numeric' });
        acc[month] = (acc[month] || 0) + parseFloat(payment.amount);
        return acc;
      }, {});
      
      // Group expenses by month for chart
      const expensesByMonth = expenses.reduce((acc: Record<string, { expenses: number, salaries: number }>, expense: FinanceExpense) => {
        const month = new Date(expense.date).toLocaleString('default', { month: 'short', year: 'numeric' });
        if (!acc[month]) acc[month] = { expenses: 0, salaries: 0 };
        if (expense.type === 'expense') {
          acc[month].expenses += parseFloat(expense.amount);
        } else {
          acc[month].salaries += parseFloat(expense.amount);
        }
        return acc;
      }, {});
      
      res.json({
        summary: {
          totalPaymentsUSD,
          totalPaymentsBDT,
          totalExpensesUSD,
          totalExpensesBDT,
          availableBalanceUSD,
          availableBalanceBDT,
          exchangeRate,
          // Legacy fields for backwards compatibility
          totalFundUSD,
          totalFundBDT,
          totalSalariesBDT: totalSalariesBDT,
          netBalanceBDT,
        },
        charts: {
          paymentsByMonth,
          expensesByMonth,
        },
        counts: {
          totalProjects: projects.length,
          activeProjects: projects.filter((p: FinanceProject) => p.status === 'active').length,
          totalPayments: payments.length,
          totalExpenses: expenses.length,
        }
      });
    } catch (error) {
      console.error("Get finance dashboard error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Tag Management Routes - Admin Only
  
  // Get all tags
  app.get("/api/tags", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tags = await storage.getTags();
      res.json(tags);
    } catch (error) {
      console.error("Get tags error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single tag
  app.get("/api/tags/:id", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tag = await storage.getTag(req.params.id);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json(tag);
    } catch (error) {
      console.error("Get tag error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new tag
  app.post("/api/tags", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(validatedData);
      res.status(201).json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create tag error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update tag
  app.put("/api/tags/:id", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = insertTagSchema.partial().parse(req.body);
      const tag = await storage.updateTag(req.params.id, validatedData);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update tag error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete tag
  app.delete("/api/tags/:id", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteTag(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json({ message: "Tag deleted successfully" });
    } catch (error) {
      console.error("Delete tag error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Employee Management Routes - Admin Only
  
  // Get all employees
  app.get("/api/employees", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      console.error("Get employees error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single employee
  app.get("/api/employees/:id", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Get employee error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new employee
  app.post("/api/employees", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(validatedData);
      res.status(201).json(employee);
    } catch (error) {
      console.error("Create employee error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update employee
  app.put("/api/employees/:id", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = insertEmployeeSchema.partial().parse(req.body);
      const employee = await storage.updateEmployee(req.params.id, validatedData);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Update employee error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete employee
  app.delete("/api/employees/:id", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteEmployee(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json({ message: "Employee deleted successfully" });
    } catch (error) {
      console.error("Delete employee error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Salary Management API Routes
  
  // Get all salaries
  app.get("/api/salaries", authenticate, requirePagePermission('salary_management', 'view'), async (req: Request, res: Response) => {
    try {
      const salaries = await storage.getSalaries();
      res.json(salaries);
    } catch (error) {
      console.error("Get salaries error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Generate Salary routes (MUST be before /:id route)
  app.get("/api/salaries/generate-preview", authenticate, requirePagePermission('salary_management', 'view'), async (req: Request, res: Response) => {
    try {
      const { employeeId, month } = req.query;
      
      if (!employeeId || !month) {
        return res.status(400).json({ message: "Employee ID and month are required" });
      }

      // Validate month format (YYYY-MM)
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month as string)) {
        return res.status(400).json({ message: "Invalid month format. Use YYYY-MM" });
      }

      // Get employee details
      const employee = await storage.getUser(employeeId as string);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Check if salary already exists for this employee and month
      const allSalaries = await storage.getSalaries();
      const existingSalary = allSalaries.find(s => s.employeeId === employeeId && s.month === month);
      
      if (existingSalary) {
        return res.status(200).json({
          exists: true,
          existingSalary,
          message: "Salary already exists for this employee and month"
        });
      }

      // Get work reports for this employee and month
      const allWorkReports = await storage.getWorkReports(employeeId as string);
      const monthStart = new Date(`${month}-01T00:00:00`);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthWorkReports = allWorkReports.filter(report => {
        const reportDate = new Date(report.date);
        return reportDate >= monthStart && reportDate < monthEnd && 
               (report.status === 'submitted' || report.status === 'approved');
      });

      // Calculate total hours
      const totalHours = monthWorkReports.reduce((sum, report) => {
        return sum + parseFloat(report.hoursWorked as string);
      }, 0);

      // Get most recent salary for this employee to get basic salary and contractual hours
      const employeeSalaries = allSalaries
        .filter(s => s.employeeId === employeeId)
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      
      const previousSalary = employeeSalaries[0];

      // Default values
      let basicSalary = previousSalary?.basicSalary ? parseFloat(previousSalary.basicSalary) : 0;
      let contractualHours = previousSalary?.contractualHours || 160;

      // Calculate hourly rate and base payment
      const hourlyRate = contractualHours > 0 ? basicSalary / contractualHours : 0;
      const basePayment = totalHours * hourlyRate;

      res.json({
        exists: false,
        employee: {
          id: employee.id,
          name: employee.name || employee.username,
        },
        workReports: {
          count: monthWorkReports.length,
          totalHours: totalHours.toFixed(2),
          reports: monthWorkReports.map(r => ({
            id: r.id,
            title: r.title,
            date: r.date,
            hoursWorked: r.hoursWorked,
          }))
        },
        preview: {
          basicSalary: basicSalary.toFixed(2),
          contractualHours,
          actualWorkingHours: totalHours.toFixed(2),
          hourlyRate: hourlyRate.toFixed(2),
          basePayment: basePayment.toFixed(2),
          hasPreviousSalary: !!previousSalary
        }
      });
    } catch (error) {
      console.error("Generate salary preview error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/salaries/generate", authenticate, requirePagePermission('salary_management', 'edit'), async (req: Request, res: Response) => {
    try {
      const {
        employeeId,
        employeeName,
        month,
        basicSalary,
        contractualHours,
        actualWorkingHours,
        festivalBonus = 0,
        performanceBonus = 0,
        otherBonus = 0,
        paymentMethod = 'bank_transfer',
        paymentStatus = 'unpaid',
        salaryApprovalStatus = 'pending',
        remarks
      } = req.body;

      // Validate required fields
      if (!employeeId || !employeeName || !month || !basicSalary || !contractualHours || actualWorkingHours === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if salary already exists
      const allSalaries = await storage.getSalaries();
      const existingSalary = allSalaries.find(s => s.employeeId === employeeId && s.month === month);
      
      if (existingSalary) {
        return res.status(409).json({ message: "Salary already exists for this employee and month" });
      }

      // Get work reports to validate
      const allWorkReports = await storage.getWorkReports(employeeId);
      const monthStart = new Date(`${month}-01T00:00:00`);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthWorkReports = allWorkReports.filter(report => {
        const reportDate = new Date(report.date);
        return reportDate >= monthStart && reportDate < monthEnd && 
               (report.status === 'submitted' || report.status === 'approved');
      });

      if (monthWorkReports.length === 0) {
        return res.status(400).json({ message: "No work reports found for this employee and month" });
      }

      // Calculate values
      const totalBonus = parseFloat(festivalBonus) + parseFloat(performanceBonus) + parseFloat(otherBonus);
      const hourlyRate = parseFloat(basicSalary) / contractualHours;
      const basePayment = parseFloat(actualWorkingHours) * hourlyRate;
      const grossPayment = basePayment + totalBonus;
      const finalPayment = grossPayment;

      const salaryData = {
        employeeId,
        employeeName,
        month,
        basicSalary: parseFloat(basicSalary),
        contractualHours,
        actualWorkingHours: parseFloat(actualWorkingHours),
        hourlyRate: parseFloat(hourlyRate.toFixed(2)),
        basePayment: parseFloat(basePayment.toFixed(2)),
        festivalBonus: parseFloat(festivalBonus),
        performanceBonus: parseFloat(performanceBonus),
        otherBonus: parseFloat(otherBonus),
        totalBonus: parseFloat(totalBonus.toFixed(2)),
        grossPayment: parseFloat(grossPayment.toFixed(2)),
        finalPayment: parseFloat(finalPayment.toFixed(2)),
        paymentMethod,
        paymentStatus,
        salaryApprovalStatus,
        remarks
      };

      const salary = await storage.createSalary(salaryData);
      res.status(201).json(salary);
    } catch (error) {
      console.error("Generate salary error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get salary statistics (MUST be before /:id route)
  app.get("/api/salaries/stats", authenticate, requirePagePermission('salary_management', 'view'), async (req: Request, res: Response) => {
    try {
      const [salaries, workReports] = await Promise.all([
        storage.getSalaries(),
        storage.getWorkReports()
      ]);

      // Calculate salary statistics
      const totalSalaries = salaries.length;
      const paidSalaries = salaries.filter(s => s.paymentStatus === 'paid');
      const unpaidSalaries = salaries.filter(s => s.paymentStatus === 'unpaid');
      
      const totalPaidAmount = paidSalaries.reduce((sum, salary) => sum + parseFloat(salary.finalPayment), 0);
      const totalPendingAmount = unpaidSalaries.reduce((sum, salary) => sum + parseFloat(salary.finalPayment), 0);
      const totalSalaryAmount = salaries.reduce((sum, salary) => sum + parseFloat(salary.finalPayment), 0);
      
      // Calculate work report statistics
      const totalWorkHours = workReports.reduce((sum, report) => sum + parseFloat(report.hoursWorked), 0);
      const totalSalaryHours = salaries.reduce((sum, salary) => sum + parseFloat(salary.actualWorkingHours), 0);
      
      // Group by user for comparison
      const userWorkHours: Record<string, number> = {};
      const userSalaryHours: Record<string, number> = {};
      
      workReports.forEach(report => {
        userWorkHours[report.userId] = (userWorkHours[report.userId] || 0) + parseFloat(report.hoursWorked);
      });
      
      salaries.forEach(salary => {
        userSalaryHours[salary.employeeId] = (userSalaryHours[salary.employeeId] || 0) + parseFloat(salary.actualWorkingHours);
      });

      const stats = {
        totalSalaries,
        paidSalaries: paidSalaries.length,
        unpaidSalaries: unpaidSalaries.length,
        totalPaidAmount,
        totalPendingAmount,
        totalSalaryAmount,
        totalWorkHours,
        totalSalaryHours,
        hoursDifference: totalWorkHours - totalSalaryHours,
        userWorkHours,
        userSalaryHours,
        averageSalary: totalSalaries > 0 ? totalSalaryAmount / totalSalaries : 0,
        paymentRate: totalSalaries > 0 ? (paidSalaries.length / totalSalaries) * 100 : 0
      };

      res.json(stats);
    } catch (error) {
      console.error("Get salary stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single salary
  app.get("/api/salaries/:id", authenticate, requirePagePermission('salary_management', 'view'), async (req: Request, res: Response) => {
    try {
      const salary = await storage.getSalary(req.params.id);
      if (!salary) {
        return res.status(404).json({ message: "Salary record not found" });
      }
      res.json(salary);
    } catch (error) {
      console.error("Get salary error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new salary
  app.post("/api/salaries", authenticate, requirePagePermission('salary_management', 'edit'), async (req: Request, res: Response) => {
    try {
      // For now, accept the data as-is since frontend sends calculated fields
      // TODO: Add proper validation later
      const salary = await storage.createSalary(req.body);
      res.status(201).json(salary);
    } catch (error) {
      console.error("Create salary error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update salary
  app.put("/api/salaries/:id", authenticate, requirePagePermission('salary_management', 'edit'), async (req: Request, res: Response) => {
    try {
      const validatedData = insertSalarySchema.partial().parse(req.body);
      const salary = await storage.updateSalary(req.params.id, validatedData);
      if (!salary) {
        return res.status(404).json({ message: "Salary record not found" });
      }
      res.json(salary);
    } catch (error) {
      console.error("Update salary error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete salary
  app.delete("/api/salaries/:id", authenticate, requirePagePermission('salary_management', 'delete'), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteSalary(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Salary record not found" });
      }
      res.json({ message: "Salary record deleted successfully" });
    } catch (error) {
      console.error("Delete salary error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Data Backup and Export Endpoints - Super Admin Only
  
  // Helper function to check if user is Super Admin
  function requireSuperAdmin(req: Request, res: Response, next: Function) {
    if (!req.user || req.user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ message: "Super Admin access required" });
    }
    next();
  }

  // Full Database Backup (JSON format)
  app.get("/api/backup/full", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const [
        allUsers,
        allCampaigns,
        allClients,
        allAdAccounts,
        allAdCopySets,
        allWorkReports,
        allPages,
        allRolePermissions,
        allFinanceProjects,
        allFinancePayments,
        allFinanceExpenses,
        allFinanceSettings
      ] = await Promise.all([
        storage.getAllUsers(),
        storage.getCampaigns(),
        storage.getClients(),
        storage.getAdAccounts(),
        storage.getAllAdCopySets(), // Get all ad copy sets
        storage.getWorkReports(),
        storage.getPages(),
        storage.getRolePermissions(),
        storage.getFinanceProjects(),
        storage.getFinancePayments(),
        storage.getFinanceExpenses(),
        storage.getAllFinanceSettings(), // Get all settings
      ]);

      const backup = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        data: {
          users: allUsers,
          campaigns: allCampaigns,
          clients: allClients,
          adAccounts: allAdAccounts,
          adCopySets: allAdCopySets,
          workReports: allWorkReports,
          pages: allPages,
          rolePermissions: allRolePermissions,
          financeProjects: allFinanceProjects,
          financePayments: allFinancePayments,
          financeExpenses: allFinanceExpenses,
          financeSettings: allFinanceSettings,
        }
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="advantix-backup-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(backup);
    } catch (error) {
      console.error("Full backup error:", error);
      res.status(500).json({ message: "Backup failed" });
    }
  });

  // Individual table exports (JSON format)
  app.get("/api/backup/users", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="users-backup-${new Date().toISOString().split('T')[0]}.json"`);
      res.json({ exportedAt: new Date().toISOString(), data: users });
    } catch (error) {
      res.status(500).json({ message: "Users backup failed" });
    }
  });

  app.get("/api/backup/clients", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const clients = await storage.getClients();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="clients-backup-${new Date().toISOString().split('T')[0]}.json"`);
      res.json({ exportedAt: new Date().toISOString(), data: clients });
    } catch (error) {
      res.status(500).json({ message: "Clients backup failed" });
    }
  });

  app.get("/api/backup/campaigns", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="campaigns-backup-${new Date().toISOString().split('T')[0]}.json"`);
      res.json({ exportedAt: new Date().toISOString(), data: campaigns });
    } catch (error) {
      res.status(500).json({ message: "Campaigns backup failed" });
    }
  });

  app.get("/api/backup/finance", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const [projects, payments, expenses, settings] = await Promise.all([
        storage.getFinanceProjects(),
        storage.getFinancePayments(),
        storage.getFinanceExpenses(),
        storage.getAllFinanceSettings(), // Get all settings
      ]);

      const financeData = {
        projects,
        payments,
        expenses,
        settings
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="finance-backup-${new Date().toISOString().split('T')[0]}.json"`);
      res.json({ exportedAt: new Date().toISOString(), data: financeData });
    } catch (error) {
      res.status(500).json({ message: "Finance backup failed" });
    }
  });

  // CSV Export Functions
  function convertToCSV(data: any[], headers: string[]): string {
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(',');
    });
    return [csvHeaders, ...csvRows].join('\n');
  }

  // CSV Export Endpoints
  app.get("/api/backup/clients/csv", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const clients = await storage.getClients();
      const headers = ['id', 'clientName', 'businessName', 'contactPerson', 'email', 'phone', 'address', 'notes', 'status', 'createdAt', 'updatedAt'];
      const csv = convertToCSV(clients, headers);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="clients-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "CSV export failed" });
    }
  });

  app.get("/api/backup/campaigns/csv", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const campaigns = await storage.getCampaigns();
      const headers = ['id', 'name', 'startDate', 'comments', 'adAccountId', 'clientId', 'spend', 'status', 'createdAt', 'updatedAt'];
      const csv = convertToCSV(campaigns, headers);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="campaigns-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "CSV export failed" });
    }
  });

  app.get("/api/backup/finance-projects/csv", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const projects = await storage.getFinanceProjects();
      const headers = ['id', 'name', 'description', 'budget', 'expenses', 'status', 'createdAt', 'updatedAt'];
      const csv = convertToCSV(projects, headers);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="finance-projects-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "CSV export failed" });
    }
  });

  app.get("/api/backup/finance-payments/csv", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const payments = await storage.getFinancePayments();
      const headers = ['id', 'projectId', 'amount', 'currency', 'description', 'paymentDate', 'createdAt', 'updatedAt'];
      const csv = convertToCSV(payments, headers);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="finance-payments-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "CSV export failed" });
    }
  });

  app.get("/api/backup/finance-expenses/csv", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const expenses = await storage.getFinanceExpenses();
      const headers = ['id', 'projectId', 'amount', 'currency', 'category', 'description', 'expenseDate', 'createdAt', 'updatedAt'];
      const csv = convertToCSV(expenses, headers);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="finance-expenses-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "CSV export failed" });
    }
  });

  app.get("/api/backup/employees/csv", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const employees = await storage.getEmployees();
      const headers = ['id', 'name', 'department', 'position', 'notes', 'isActive', 'createdAt', 'updatedAt'];
      const csv = convertToCSV(employees, headers);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="employees-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "CSV export failed" });
    }
  });

  // Data Recovery Information Endpoint
  app.get("/api/backup/info", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const [
        usersCount,
        campaignsCount,
        clientsCount,
        adAccountsCount,
        workReportsCount,
        financeProjectsCount,
        financePaymentsCount,
        financeExpensesCount,
        employeesCount
      ] = await Promise.all([
        storage.getAllUsers().then(users => users.length),
        storage.getCampaigns().then(campaigns => campaigns.length),
        storage.getClients().then(clients => clients.length),
        storage.getAdAccounts().then(accounts => accounts.length),
        storage.getWorkReports().then(reports => reports.length),
        storage.getFinanceProjects().then(projects => projects.length),
        storage.getFinancePayments().then(payments => payments.length),
        storage.getFinanceExpenses().then(expenses => expenses.length),
        storage.getEmployees().then(employees => employees.length),
      ]);

      res.json({
        message: "Data backup and recovery system active",
        dataIntegrity: "All data is permanently stored in PostgreSQL database",
        backupOptions: {
          fullBackup: "/api/backup/full",
          individualBackups: {
            users: "/api/backup/users",
            clients: "/api/backup/clients", 
            campaigns: "/api/backup/campaigns",
            finance: "/api/backup/finance"
          },
          csvExports: {
            clients: "/api/backup/clients/csv",
            campaigns: "/api/backup/campaigns/csv",
            financeProjects: "/api/backup/finance-projects/csv",
            financePayments: "/api/backup/finance-payments/csv",
            financeExpenses: "/api/backup/finance-expenses/csv",
            employees: "/api/backup/employees/csv"
          }
        },
        dataStats: {
          users: usersCount,
          campaigns: campaignsCount,
          clients: clientsCount,
          adAccounts: adAccountsCount,
          workReports: workReportsCount,
          financeProjects: financeProjectsCount,
          financePayments: financePaymentsCount,
          financeExpenses: financeExpensesCount,
          employees: employeesCount,
          lastBackupAvailable: "On-demand via API endpoints"
        },
        securityNote: "All backup endpoints require Super Admin authentication"
      });
    } catch (error) {
      res.status(500).json({ message: "Backup info retrieval failed" });
    }
  });

  // User-friendly CSV Export Endpoints for Finance Users
  app.get("/api/finance/expenses/export/csv", authenticate, requirePagePermission('finance', 'view'), async (req: Request, res: Response) => {
    try {
      const expenses = await storage.getFinanceExpenses();
      const headers = ['id', 'projectId', 'amount', 'currency', 'category', 'description', 'expenseDate', 'createdAt', 'updatedAt'];
      const csv = convertToCSV(expenses, headers);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="expenses-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Finance expenses CSV export error:', error);
      res.status(500).json({ message: "CSV export failed" });
    }
  });

  app.get("/api/employees/export/csv", authenticate, requirePagePermission('finance', 'view'), async (req: Request, res: Response) => {
    try {
      const employees = await storage.getEmployees();
      const headers = ['id', 'name', 'department', 'position', 'notes', 'isActive', 'createdAt', 'updatedAt'];
      const csv = convertToCSV(employees, headers);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="employees-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Employees CSV export error:', error);
      res.status(500).json({ message: "CSV export failed" });
    }
  });

  // JSON Export/Import Endpoints for Admin Panel

  // Full Data Export (JSON)
  app.get("/api/data/export", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const [
        users,
        campaigns,
        clients,
        adAccounts,
        adCopySets,
        workReports,
        pages,
        rolePermissions,
        financeProjects,
        financePayments,
        financeExpenses,
        financeSettings,
        tags,
        employees
      ] = await Promise.all([
        storage.getAllUsers(),
        storage.getCampaigns(),
        storage.getClients(),
        storage.getAdAccounts(),
        storage.getAllAdCopySets(),
        storage.getWorkReports(),
        storage.getPages(),
        storage.getRolePermissions(),
        storage.getFinanceProjects(),
        storage.getFinancePayments(),
        storage.getFinanceExpenses(),
        storage.getAllFinanceSettings(),
        storage.getTags(),
        storage.getEmployees()
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user?.username,
        version: "1.0",
        data: {
          users: users.map(u => ({ ...u, password: "[REDACTED]" })), // Remove passwords for security
          campaigns,
          clients,
          adAccounts,
          adCopySets,
          workReports,
          pages,
          rolePermissions,
          financeProjects,
          financePayments,
          financeExpenses,
          financeSettings,
          tags,
          employees
        }
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="data-export-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(exportData);
    } catch (error) {
      console.error("Data export failed:", error);
      res.status(500).json({ message: "Data export failed" });
    }
  });

  // Full Data Import (JSON)
  app.post("/api/data/import", authenticate, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    try {
      const importData = req.body;
      
      if (!importData || !importData.data) {
        return res.status(400).json({ message: "Invalid import data format" });
      }

      const results = {
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[]
      };

      // Helper function to convert date strings back to Date objects
      const convertDatesToObjects = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) return obj.map(convertDatesToObjects);
        if (typeof obj !== 'object') return obj;
        
        const converted: any = {};
        for (const [key, value] of Object.entries(obj)) {
          // Convert ISO date strings to Date objects - more comprehensive detection
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            // Convert any string that looks like an ISO date to Date object
            converted[key] = new Date(value);
          } else if (typeof value === 'object') {
            converted[key] = convertDatesToObjects(value);
          } else {
            converted[key] = value;
          }
        }
        return converted;
      };

      // Import data with duplicate handling - simplified approach
      try {
        // Users MUST be imported first - everything else depends on them
        if (importData.data.users && Array.isArray(importData.data.users)) {
          for (const user of importData.data.users) {
            try {
              const processedUser = convertDatesToObjects(user);
              const existing = await storage.getUser(processedUser.id);
              if (existing) {
                await storage.updateUser(processedUser.id, processedUser);
                results.updated++;
              } else {
                await storage.createUser(processedUser);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`user (${user.username || user.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

        // Core system data next
        if (importData.data.pages && Array.isArray(importData.data.pages)) {
          for (const page of importData.data.pages) {
            try {
              const processedPage = convertDatesToObjects(page);
              // Check for existing page by pageKey to handle duplicates
              const existingByKey = await storage.getPageByKey(processedPage.pageKey);
              const existingById = await storage.getPage(processedPage.id);
              
              if (existingByKey && existingByKey.id !== processedPage.id) {
                // Page key already exists with different ID - skip to avoid unique constraint violation
                results.errors.push(`page (${page.pageKey}): duplicate key value violates unique constraint "pages_page_key_unique"`);
                results.skipped++;
              } else if (existingByKey) {
                // Same pageKey exists - update it
                await storage.updatePage(existingByKey.id, processedPage);
                results.updated++;
              } else if (existingById) {
                // Same ID exists - update it
                await storage.updatePage(processedPage.id, processedPage);
                results.updated++;
              } else {
                // No existing record - create new
                await storage.createPage(processedPage);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`page (${page.pageKey || page.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

        // Business data
        if (importData.data.clients && Array.isArray(importData.data.clients)) {
          for (const client of importData.data.clients) {
            try {
              const processedClient = convertDatesToObjects(client);
              const existing = await storage.getClient(processedClient.id);
              if (existing) {
                await storage.updateClient(processedClient.id, processedClient);
                results.updated++;
              } else {
                await storage.createClient(processedClient);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`client (${client.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

        if (importData.data.adAccounts && Array.isArray(importData.data.adAccounts)) {
          for (const account of importData.data.adAccounts) {
            try {
              const processedAccount = convertDatesToObjects(account);
              const existing = await storage.getAdAccount(processedAccount.id);
              if (existing) {
                await storage.updateAdAccount(processedAccount.id, processedAccount);
                results.updated++;
              } else {
                await storage.createAdAccount(processedAccount);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`adAccount (${account.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

        if (importData.data.campaigns && Array.isArray(importData.data.campaigns)) {
          for (const campaign of importData.data.campaigns) {
            try {
              const processedCampaign = convertDatesToObjects(campaign);
              const existing = await storage.getCampaign(processedCampaign.id);
              if (existing) {
                await storage.updateCampaign(processedCampaign.id, processedCampaign);
                results.updated++;
              } else {
                await storage.createCampaign(processedCampaign);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`campaign (${campaign.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

        if (importData.data.adCopySets && Array.isArray(importData.data.adCopySets)) {
          for (const copySet of importData.data.adCopySets) {
            try {
              const processedCopySet = convertDatesToObjects(copySet);
              const existing = await storage.getAdCopySet(processedCopySet.id);
              if (existing) {
                await storage.updateAdCopySet(processedCopySet.id, processedCopySet);
                results.updated++;
              } else {
                await storage.createAdCopySet(processedCopySet);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`adCopySet (${copySet.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

        if (importData.data.workReports && Array.isArray(importData.data.workReports)) {
          for (const report of importData.data.workReports) {
            try {
              const processedReport = convertDatesToObjects(report);
              
              // Check if user exists before creating work report
              if (processedReport.userId) {
                const user = await storage.getUser(processedReport.userId);
                if (!user) {
                  results.errors.push(`workReport (${report.id}): user ${processedReport.userId} not found`);
                  results.skipped++;
                  continue;
                }
              }
              
              const existing = await storage.getWorkReport(processedReport.id);
              if (existing) {
                await storage.updateWorkReport(processedReport.id, processedReport);
                results.updated++;
              } else {
                await storage.createWorkReport(processedReport);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`workReport (${report.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

        // Finance data - ensure client dependencies exist
        if (importData.data.financeProjects && Array.isArray(importData.data.financeProjects)) {
          for (const project of importData.data.financeProjects) {
            try {
              const processedProject = convertDatesToObjects(project);
              
              // Check if client exists before creating finance project
              if (processedProject.clientId) {
                const client = await storage.getClient(processedProject.clientId);
                if (!client) {
                  results.errors.push(`financeProject (${project.id}): client ${processedProject.clientId} not found`);
                  results.skipped++;
                  continue;
                }
              }
              
              const existing = await storage.getFinanceProject(processedProject.id);
              if (existing) {
                await storage.updateFinanceProject(processedProject.id, processedProject);
                results.updated++;
              } else {
                await storage.createFinanceProject(processedProject);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`financeProject (${project.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

        if (importData.data.financePayments && Array.isArray(importData.data.financePayments)) {
          for (const payment of importData.data.financePayments) {
            try {
              const processedPayment = convertDatesToObjects(payment);
              
              // Check if client exists before creating finance payment
              if (processedPayment.clientId) {
                const client = await storage.getClient(processedPayment.clientId);
                if (!client) {
                  results.errors.push(`financePayment (${payment.id}): client ${processedPayment.clientId} not found`);
                  results.skipped++;
                  continue;
                }
              }
              
              const existing = await storage.getFinancePayment(processedPayment.id);
              if (existing) {
                await storage.updateFinancePayment(processedPayment.id, processedPayment);
                results.updated++;
              } else {
                await storage.createFinancePayment(processedPayment);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`financePayment (${payment.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

        if (importData.data.financeExpenses && Array.isArray(importData.data.financeExpenses)) {
          for (const expense of importData.data.financeExpenses) {
            try {
              const processedExpense = convertDatesToObjects(expense);
              
              // Check if project exists before creating finance expense
              if (processedExpense.projectId) {
                const project = await storage.getFinanceProject(processedExpense.projectId);
                if (!project) {
                  results.errors.push(`financeExpense (${expense.id}): project ${processedExpense.projectId} not found`);
                  results.skipped++;
                  continue;
                }
              }
              
              const existing = await storage.getFinanceExpense(processedExpense.id);
              if (existing) {
                await storage.updateFinanceExpense(processedExpense.id, processedExpense);
                results.updated++;
              } else {
                await storage.createFinanceExpense(processedExpense);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`financeExpense (${expense.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

        if (importData.data.tags && Array.isArray(importData.data.tags)) {
          for (const tag of importData.data.tags) {
            try {
              const processedTag = convertDatesToObjects(tag);
              const existing = await storage.getTag(processedTag.id);
              if (existing) {
                await storage.updateTag(processedTag.id, processedTag);
                results.updated++;
              } else {
                await storage.createTag(processedTag);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`tag (${tag.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

        if (importData.data.employees && Array.isArray(importData.data.employees)) {
          for (const employee of importData.data.employees) {
            try {
              const processedEmployee = convertDatesToObjects(employee);
              const existing = await storage.getEmployee(processedEmployee.id);
              if (existing) {
                await storage.updateEmployee(processedEmployee.id, processedEmployee);
                results.updated++;
              } else {
                await storage.createEmployee(processedEmployee);
                results.imported++;
              }
            } catch (error: any) {
              results.errors.push(`employee (${employee.id}): ${error.message}`);
              results.skipped++;
            }
          }
        }

      } catch (importError: any) {
        results.errors.push(`Import process error: ${importError.message}`);
      }

      res.json({
        message: "Data import completed",
        results: {
          ...results,
          totalProcessed: results.imported + results.updated + results.skipped
        },
        importedAt: new Date().toISOString(),
        importedBy: req.user?.username
      });

    } catch (error: any) {
      console.error("Data import failed:", error);
      res.status(500).json({ 
        message: "Data import failed", 
        error: error.message,
        importedAt: new Date().toISOString(),
        importedBy: req.user?.username
      });
    }
  });

  // Telegram Configuration Routes
  // Get Telegram configuration
  app.get("/api/telegram/config", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const config = await storage.getTelegramConfig();
      res.json(config);
    } catch (error) {
      console.error("Get Telegram config error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create or update Telegram configuration
  app.post("/api/telegram/config", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = insertTelegramConfigSchema.parse(req.body);
      const config = await storage.createTelegramConfig(validatedData);
      res.status(201).json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create Telegram config error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update Telegram configuration
  app.put("/api/telegram/config", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = insertTelegramConfigSchema.parse(req.body);
      const config = await storage.updateTelegramConfig(validatedData);
      if (!config) {
        return res.status(404).json({ message: "Telegram configuration not found" });
      }
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update Telegram config error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete Telegram configuration
  app.delete("/api/telegram/config", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteTelegramConfig();
      res.json({ message: "Telegram configuration deleted successfully" });
    } catch (error) {
      console.error("Delete Telegram config error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Telegram Chat ID Routes
  // Get all chat IDs
  app.get("/api/telegram/chat-ids", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const chatIds = await storage.getTelegramChatIds();
      res.json(chatIds);
    } catch (error) {
      console.error("Get Telegram chat IDs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create chat ID
  app.post("/api/telegram/chat-ids", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = insertTelegramChatIdSchema.parse(req.body);
      const chatId = await storage.createTelegramChatId(validatedData);
      res.status(201).json(chatId);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create Telegram chat ID error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update chat ID
  app.put("/api/telegram/chat-ids/:id", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = insertTelegramChatIdSchema.parse(req.body);
      const chatId = await storage.updateTelegramChatId(req.params.id, validatedData);
      if (!chatId) {
        return res.status(404).json({ message: "Chat ID not found" });
      }
      res.json(chatId);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Update Telegram chat ID error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete chat ID
  app.delete("/api/telegram/chat-ids/:id", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteTelegramChatId(req.params.id);
      res.json({ message: "Chat ID deleted successfully" });
    } catch (error) {
      console.error("Delete Telegram chat ID error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Test message endpoint
  app.post("/api/telegram/test-message", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      const config = await storage.getTelegramConfig();
      if (!config || !config.botToken) {
        return res.status(400).json({ message: "Telegram bot token not configured" });
      }

      const chatIds = await storage.getTelegramChatIds();
      if (chatIds.length === 0) {
        return res.status(400).json({ message: "No chat IDs configured" });
      }

      // Send message to all configured chat IDs
      let sentCount = 0;
      let errors: string[] = [];

      for (const chatId of chatIds) {
        if (!chatId.isActive) continue;

        try {
          const telegramApiUrl = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
          const telegramResponse = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId.chatId,
              text: message.trim(),
              parse_mode: 'HTML'
            })
          });

          if (telegramResponse.ok) {
            sentCount++;
          } else {
            const errorData = await telegramResponse.json();
            errors.push(`${chatId.name}: ${errorData.description || 'Unknown error'}`);
          }
        } catch (error: any) {
          errors.push(`${chatId.name}: ${error.message}`);
        }
      }

      if (sentCount === 0) {
        return res.status(500).json({ 
          message: "Failed to send test message to any chat", 
          errors: errors 
        });
      }

      res.json({ 
        message: "Test message sent successfully",
        sentCount: sentCount,
        totalChatIds: chatIds.filter(c => c.isActive).length,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error("Send test message error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Facebook Settings Routes
  // Get Facebook settings
  app.get("/api/facebook/settings", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getFacebookSettings();
      if (!settings) {
        return res.json(null);
      }
      
      // Don't send app secret to frontend for security
      const safeSettings = {
        ...settings,
        appSecret: settings.appSecret ? '••••••••' : ''
      };
      
      res.json(safeSettings);
    } catch (error) {
      console.error("Get Facebook settings error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Save Facebook settings
  app.post("/api/facebook/settings", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { appId, appSecret, accessToken } = req.body;
      
      console.log("[FB Settings] Save request received from:", req.headers.origin || req.headers.referer);
      console.log("[FB Settings] Auth token present:", !!req.headers.authorization);
      console.log("[FB Settings] User:", (req as any).user?.username);
      
      if (!appId || !appSecret || !accessToken) {
        console.log("[FB Settings] Missing fields - appId:", !!appId, "appSecret:", !!appSecret, "accessToken:", !!accessToken);
        return res.status(400).json({ message: "App ID, App Secret, and Access Token are required" });
      }

      // Save settings
      await storage.saveFacebookSettings({
        appId,
        appSecret,
        accessToken,
        isConnected: false
      });

      console.log("[FB Settings] Settings saved successfully");
      res.json({ message: "Facebook settings saved successfully" });
    } catch (error: any) {
      console.error("[FB Settings] Save error:", error);
      const errorMessage = error?.message || "Internal server error";
      
      // Check if it's a database table error
      if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
        return res.status(500).json({ 
          message: "Database schema not initialized. Please run 'npm run db:push' to create required tables in production database." 
        });
      }
      
      res.status(500).json({ message: errorMessage });
    }
  });

  // Test Facebook connection
  app.post("/api/facebook/test-connection", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getFacebookSettings();
      
      if (!settings) {
        return res.status(400).json({ message: "Facebook settings not configured" });
      }

      // Test API connection by making a simple request
      const testUrl = `https://graph.facebook.com/v18.0/me?access_token=${settings.accessToken}`;
      const response = await fetch(testUrl);
      
      if (response.ok) {
        const data = await response.json();
        await storage.updateFacebookConnectionStatus(true);
        res.json({ 
          success: true, 
          message: "Connection successful",
          userId: data.id,
          userName: data.name
        });
      } else {
        const errorData = await response.json();
        await storage.updateFacebookConnectionStatus(false, errorData.error?.message || 'Connection failed');
        res.status(400).json({ 
          success: false, 
          message: errorData.error?.message || "Connection failed" 
        });
      }
    } catch (error: any) {
      await storage.updateFacebookConnectionStatus(false, error.message);
      console.error("Test Facebook connection error:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Internal server error" 
      });
    }
  });

  // Disconnect Facebook
  app.post("/api/facebook/disconnect", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getFacebookSettings();
      
      if (!settings) {
        return res.status(400).json({ message: "No Facebook settings to disconnect" });
      }

      // Clear settings by setting empty values and marking as disconnected
      await storage.saveFacebookSettings({
        appId: "",
        appSecret: "",
        accessToken: "",
        isConnected: false
      });

      res.json({ message: "Facebook disconnected successfully" });
    } catch (error) {
      console.error("Disconnect Facebook error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Email Settings Routes
  // Get Email settings
  app.get("/api/email/settings", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getEmailSettings();
      if (!settings) {
        return res.json(null);
      }
      res.json(settings);
    } catch (error) {
      console.error("Get email settings error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Save Email settings
  app.post("/api/email/settings", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { provider, apiKey, senderEmail, senderName, enableNotifications, enableNewAdAlerts, enableDailySummary, dailySummaryTime } = req.body;
      
      // Validate required fields
      if (!provider || !apiKey || !senderEmail || !senderName) {
        return res.status(400).json({ message: "Provider, API key, sender email, and sender name are required" });
      }

      // Save settings
      await storage.saveEmailSettings({
        provider,
        apiKey,
        senderEmail,
        senderName,
        enableNotifications: enableNotifications ?? false,
        enableNewAdAlerts: enableNewAdAlerts ?? true,
        enableDailySummary: enableDailySummary ?? true,
        dailySummaryTime: dailySummaryTime || "07:00",
        isConfigured: false
      });

      res.json({ message: "Email settings saved successfully" });
    } catch (error: any) {
      console.error("Save email settings error:", error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Test Email connection
  app.post("/api/email/test-connection", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getEmailSettings();
      
      if (!settings) {
        return res.status(400).json({ message: "Email settings not configured" });
      }

      if (!settings.apiKey) {
        await storage.updateEmailConnectionStatus(false, "API key not configured");
        return res.status(400).json({ 
          success: false, 
          message: "Email service API key not configured. Please save your settings with an API key." 
        });
      }

      // For now, just validate settings exist and API key is present
      // In production, this would make an actual test request to the email service
      await storage.updateEmailConnectionStatus(true);
      res.json({ 
        success: true, 
        message: "Email service configured successfully",
        provider: settings.provider
      });
    } catch (error: any) {
      await storage.updateEmailConnectionStatus(false, error.message);
      console.error("Test email connection error:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Internal server error" 
      });
    }
  });

  // Send Test Email
  app.post("/api/email/test-send", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getEmailSettings();
      const { recipientEmail } = req.body;

      console.log("Send test email request:", { recipientEmail, provider: settings?.provider });

      if (!settings || !settings.apiKey) {
        return res.status(400).json({ 
          success: false, 
          message: "Email settings not configured. Please save your settings first." 
        });
      }

      if (!recipientEmail) {
        return res.status(400).json({ 
          success: false, 
          message: "Recipient email is required" 
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid email address" 
        });
      }

      // Send test email based on provider
      console.log(`Sending test email via ${settings.provider} to ${recipientEmail}`);
      let response;
      
      if (settings.provider === 'resend') {
        response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `${settings.senderName} <${settings.senderEmail}>`,
            to: recipientEmail,
            subject: 'Test Email from Advantix Admin',
            html: `
              <h2>Email Configuration Test</h2>
              <p>This is a test email from your Advantix Admin dashboard.</p>
              <p>If you received this email, your email service is configured correctly!</p>
              <hr>
              <p><small>Provider: ${settings.provider}</small></p>
              <p><small>Sender: ${settings.senderEmail}</small></p>
            `
          })
        });
      } else if (settings.provider === 'sendgrid') {
        response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: recipientEmail }]
            }],
            from: {
              email: settings.senderEmail,
              name: settings.senderName
            },
            subject: 'Test Email from Advantix Admin',
            content: [{
              type: 'text/html',
              value: `
                <h2>Email Configuration Test</h2>
                <p>This is a test email from your Advantix Admin dashboard.</p>
                <p>If you received this email, your email service is configured correctly!</p>
                <hr>
                <p><small>Provider: ${settings.provider}</small></p>
                <p><small>Sender: ${settings.senderEmail}</small></p>
              `
            }]
          })
        });
      } else if (settings.provider === 'mailgun') {
        const domain = settings.senderEmail.split('@')[1];
        response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${settings.apiKey}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            from: `${settings.senderName} <${settings.senderEmail}>`,
            to: recipientEmail,
            subject: 'Test Email from Advantix Admin',
            html: `
              <h2>Email Configuration Test</h2>
              <p>This is a test email from your Advantix Admin dashboard.</p>
              <p>If you received this email, your email service is configured correctly!</p>
              <hr>
              <p><small>Provider: ${settings.provider}</small></p>
              <p><small>Sender: ${settings.senderEmail}</small></p>
            `
          }).toString()
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          message: `Unsupported email provider: ${settings.provider}` 
        });
      }

      if (!response) {
        console.error("No response from email provider - provider may not be configured correctly");
        return res.status(500).json({ 
          success: false, 
          message: `Email provider ${settings.provider} is not properly configured` 
        });
      }

      console.log(`Email provider response status: ${response.status}`);

      if (!response.ok) {
        let errorMessage = 'Failed to send test email';
        try {
          const errorData = await response.text();
          console.error("Email send error:", errorData);
          errorMessage = errorData.substring(0, 200);
        } catch (e) {
          console.error("Error parsing email provider response:", e);
        }
        return res.status(400).json({ 
          success: false, 
          message: errorMessage
        });
      }

      const responseData = await response.json();
      console.log("Email sent successfully:", responseData);
      
      res.json({ 
        success: true, 
        message: `Test email sent successfully to ${recipientEmail}` 
      });
    } catch (error: any) {
      console.error("Send test email error:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Internal server error" 
      });
    }
  });

  // Client Email Preferences Routes
  // Get all client email preferences (must be before :clientId route)
  app.get("/api/clients/email-preferences/all", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const allPreferences = await storage.getAllClientEmailPreferences();
      res.json(allPreferences);
    } catch (error) {
      console.error("Get all client email preferences error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get client email preferences for a specific client
  app.get("/api/clients/:clientId/email-preferences", authenticate, async (req: Request, res: Response) => {
    try {
      const preferences = await storage.getClientEmailPreferences(req.params.clientId);
      if (!preferences) {
        // Return default preferences if none exist
        return res.json({
          enableNotifications: false,
          enableAdAccountActivationAlerts: false,
          enableAdAccountSuspensionAlerts: false,
          enableSpendWarnings: false,
          spendWarningThreshold: 80
        });
      }
      res.json(preferences);
    } catch (error) {
      console.error("Get client email preferences error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Save client email preferences
  app.post("/api/clients/:clientId/email-preferences", authenticate, async (req: Request, res: Response) => {
    try {
      const { enableNotifications, enableAdAccountActivationAlerts, enableAdAccountSuspensionAlerts, enableSpendWarnings, spendWarningThreshold } = req.body;
      
      // Validate that client exists
      const client = await storage.getClient(req.params.clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Save preferences
      const preferences = await storage.saveClientEmailPreferences(req.params.clientId, {
        enableNotifications: enableNotifications ?? false,
        enableAdAccountActivationAlerts: enableAdAccountActivationAlerts ?? false,
        enableAdAccountSuspensionAlerts: enableAdAccountSuspensionAlerts ?? false,
        enableSpendWarnings: enableSpendWarnings ?? false,
        spendWarningThreshold: spendWarningThreshold || 80
      });

      res.json({ message: "Email preferences saved successfully", preferences });
    } catch (error: any) {
      console.error("Save client email preferences error:", error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Manual email send from Client Mailbox
  app.post("/api/client-mailbox/send", authenticate, requirePagePermission("client_mailbox", "edit"), async (req: Request, res: Response) => {
    try {
      // Validate request body with Zod
      const { clientMailboxEmailSchema } = await import('@shared/schema');
      const validationResult = clientMailboxEmailSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: validationResult.error.errors 
        });
      }
      
      const { clientId, emailType, subject, customMessage, adAccountId } = validationResult.data;
      
      // Validate client exists
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      if (!client.email) {
        return res.status(400).json({ message: "Client has no email address" });
      }
      
      // Check email settings
      const emailSettings = await storage.getEmailSettings();
      if (!emailSettings?.isConfigured) {
        return res.status(400).json({ message: "Email service is not configured" });
      }
      
      let emailHtml = "";
      let emailSubject = subject || "Message from Advantix Admin";
      let emailText = "";
      
      const baseStyle = `font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;`;
      const cardStyle = `background-color: white; padding: 30px; border-radius: 8px;`;
      const footerStyle = `color: #6b7280; font-size: 14px; margin-top: 30px;`;

      // Handle template emails
      if (emailType === "custom") {
        emailHtml = `<div style="${baseStyle}"><div style="${cardStyle}"><h2 style="color: #1a73e8; margin-bottom: 20px;">Message from Advantix Admin</h2><p style="color: #333; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${customMessage}</p><p style="${footerStyle}">Best regards,<br/><strong>Advantix Admin Team</strong></p></div></div>`;
        emailText = customMessage || "";
      } else if (emailType === "welcome") {
        emailHtml = `<div style="${baseStyle}"><div style="${cardStyle}"><h2 style="color: #10b981; margin-bottom: 20px;">🎉 Welcome to Advantix!</h2><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Hello <strong>${client.clientName}</strong>,</p><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">We're thrilled to have you on board! Welcome to Advantix, your trusted partner in digital advertising success.</p><div style="background-color: #f0fdf4; padding: 20px; border-radius: 6px; margin-bottom: 20px;"><h3 style="color: #15803d; margin-top: 0;">What's Next?</h3><ul style="color: #166534; margin: 0; padding-left: 20px;"><li>Your account is set up and ready to go</li><li>We'll be managing your ad campaigns with care</li><li>You'll receive regular updates on performance</li><li>Our team is here to support you every step of the way</li></ul></div><p style="color: #333; font-size: 16px; line-height: 1.6;">If you have any questions, please don't hesitate to reach out. We're here to help!</p><p style="${footerStyle}">Best regards,<br/><strong>Advantix Admin Team</strong></p></div></div>`;
        emailText = `Welcome to Advantix!\n\nHello ${client.clientName},\n\nWe're thrilled to have you on board! Welcome to Advantix, your trusted partner in digital advertising success.\n\nWhat's Next?\n- Your account is set up and ready to go\n- We'll be managing your ad campaigns with care\n- You'll receive regular updates on performance\n- Our team is here to support you every step of the way\n\nIf you have any questions, please don't hesitate to reach out. We're here to help!\n\nBest regards,\nAdvantix Admin Team`;
      } else if (emailType === "monthly_report") {
        emailHtml = `<div style="${baseStyle}"><div style="${cardStyle}"><h2 style="color: #1a73e8; margin-bottom: 20px;">📊 Your Monthly Performance Report</h2><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Hello <strong>${client.clientName}</strong>,</p><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Here's a summary of your advertising performance this month.</p><div style="background-color: #f3f4f6; padding: 20px; border-radius: 6px; margin-bottom: 20px;"><h3 style="color: #1f2937; margin-top: 0;">Key Metrics:</h3><p style="margin: 8px 0; color: #4b5563;"><strong>Total Ad Spend:</strong> $X,XXX.XX</p><p style="margin: 8px 0; color: #4b5563;"><strong>Impressions:</strong> XXX,XXX</p><p style="margin: 8px 0; color: #4b5563;"><strong>Clicks:</strong> XX,XXX</p><p style="margin: 8px 0; color: #4b5563;"><strong>Conversions:</strong> XXX</p><p style="margin: 8px 0; color: #4b5563;"><strong>ROI:</strong> XX%</p></div><p style="color: #333; font-size: 16px; line-height: 1.6;">Your campaigns are performing well! Let's schedule a call to discuss optimization opportunities.</p><p style="${footerStyle}">Best regards,<br/><strong>Advantix Admin Team</strong></p></div></div>`;
        emailText = `Your Monthly Performance Report\n\nHello ${client.clientName},\n\nHere's a summary of your advertising performance this month.\n\nYour campaigns are performing well! Let's schedule a call to discuss optimization opportunities.\n\nBest regards,\nAdvantix Admin Team`;
      } else if (emailType === "payment_reminder") {
        emailHtml = `<div style="${baseStyle}"><div style="${cardStyle}"><h2 style="color: #f59e0b; margin-bottom: 20px;">💳 Payment Reminder</h2><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Hello <strong>${client.clientName}</strong>,</p><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">This is a friendly reminder about your upcoming payment.</p><div style="background-color: #fef3c7; padding: 20px; border-radius: 6px; margin-bottom: 20px;"><h3 style="color: #92400e; margin-top: 0;">Payment Details:</h3><p style="margin: 8px 0; color: #78350f;"><strong>Amount Due:</strong> $X,XXX.XX</p><p style="margin: 8px 0; color: #78350f;"><strong>Due Date:</strong> [Date]</p><p style="margin: 8px 0; color: #78350f;"><strong>Invoice Number:</strong> INV-XXXXX</p></div><p style="color: #333; font-size: 16px; line-height: 1.6;">Please process this payment at your earliest convenience to avoid any service interruptions.</p><p style="${footerStyle}">Best regards,<br/><strong>Advantix Admin Team</strong></p></div></div>`;
        emailText = `Payment Reminder\n\nHello ${client.clientName},\n\nThis is a friendly reminder about your upcoming payment.\n\nPlease process this payment at your earliest convenience to avoid any service interruptions.\n\nBest regards,\nAdvantix Admin Team`;
      } else if (emailType === "campaign_launch") {
        emailHtml = `<div style="${baseStyle}"><div style="${cardStyle}"><h2 style="color: #8b5cf6; margin-bottom: 20px;">🚀 Your New Campaign is Live!</h2><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Hello <strong>${client.clientName}</strong>,</p><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Great news! Your new advertising campaign has just been launched and is now live.</p><div style="background-color: #f5f3ff; padding: 20px; border-radius: 6px; margin-bottom: 20px;"><h3 style="color: #6b21a8; margin-top: 0;">Campaign Details:</h3><p style="margin: 8px 0; color: #5b21b6;"><strong>Campaign Name:</strong> [Campaign Name]</p><p style="margin: 8px 0; color: #5b21b6;"><strong>Platform:</strong> [Platform]</p><p style="margin: 8px 0; color: #5b21b6;"><strong>Budget:</strong> $X,XXX.XX</p><p style="margin: 8px 0; color: #5b21b6;"><strong>Duration:</strong> [Start Date] - [End Date]</p></div><p style="color: #333; font-size: 16px; line-height: 1.6;">We'll be monitoring performance closely and will keep you updated with regular reports.</p><p style="${footerStyle}">Best regards,<br/><strong>Advantix Admin Team</strong></p></div></div>`;
        emailText = `Your New Campaign is Live!\n\nHello ${client.clientName},\n\nGreat news! Your new advertising campaign has just been launched and is now live.\n\nWe'll be monitoring performance closely and will keep you updated with regular reports.\n\nBest regards,\nAdvantix Admin Team`;
      } else if (emailType === "budget_alert") {
        emailHtml = `<div style="${baseStyle}"><div style="${cardStyle}"><h2 style="color: #dc2626; margin-bottom: 20px;">⚠️ Budget Alert</h2><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Hello <strong>${client.clientName}</strong>,</p><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">This is an important notification about your campaign budget.</p><div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 20px;"><h3 style="color: #991b1b; margin-top: 0;">Budget Status:</h3><p style="margin: 8px 0; color: #7f1d1d;"><strong>Campaign:</strong> [Campaign Name]</p><p style="margin: 8px 0; color: #7f1d1d;"><strong>Budget Used:</strong> 85% ($X,XXX.XX of $X,XXX.XX)</p><p style="margin: 8px 0; color: #7f1d1d;"><strong>Remaining:</strong> $XXX.XX</p><p style="margin: 8px 0; color: #7f1d1d;"><strong>Estimated Days Left:</strong> X days</p></div><p style="color: #333; font-size: 16px; line-height: 1.6;">Please let us know if you'd like to increase the budget to maintain campaign momentum.</p><p style="${footerStyle}">Best regards,<br/><strong>Advantix Admin Team</strong></p></div></div>`;
        emailText = `Budget Alert\n\nHello ${client.clientName},\n\nThis is an important notification about your campaign budget.\n\nPlease let us know if you'd like to increase the budget to maintain campaign momentum.\n\nBest regards,\nAdvantix Admin Team`;
      } else if (emailType === "thank_you") {
        emailHtml = `<div style="${baseStyle}"><div style="${cardStyle}"><h2 style="color: #ec4899; margin-bottom: 20px;">💝 Thank You!</h2><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Hello <strong>${client.clientName}</strong>,</p><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">We wanted to take a moment to thank you for your continued trust in Advantix.</p><div style="background-color: #fdf2f8; padding: 20px; border-radius: 6px; margin-bottom: 20px; text-align: center;"><p style="color: #9f1239; font-size: 18px; font-weight: bold; margin: 0;">Your partnership means the world to us!</p></div><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">It's clients like you that make what we do so rewarding. We're committed to delivering exceptional results and supporting your business growth.</p><p style="color: #333; font-size: 16px; line-height: 1.6;">Here's to our continued success together!</p><p style="${footerStyle}">With gratitude,<br/><strong>Advantix Admin Team</strong></p></div></div>`;
        emailText = `Thank You!\n\nHello ${client.clientName},\n\nWe wanted to take a moment to thank you for your continued trust in Advantix.\n\nYour partnership means the world to us!\n\nIt's clients like you that make what we do so rewarding. We're committed to delivering exceptional results and supporting your business growth.\n\nHere's to our continued success together!\n\nWith gratitude,\nAdvantix Admin Team`;
      } else if (emailType === "activation" || emailType === "suspension") {
        // Account activation or suspension email - requires ad account
        if (!adAccountId || adAccountId.trim() === "") {
          return res.status(400).json({ message: "Ad account is required for activation and suspension emails" });
        }
        
        const adAccount = await storage.getAdAccount(adAccountId);
        if (!adAccount) {
          return res.status(404).json({ message: "Ad account not found" });
        }
        
        if (adAccount.clientId !== clientId) {
          return res.status(400).json({ message: "Ad account does not belong to this client" });
        }
        
        // Use existing email templates
        const { getAdAccountActivationEmailTemplate, getAdAccountSuspensionEmailTemplate } = await import('./email-templates');
        
        if (emailType === "activation") {
          const template = getAdAccountActivationEmailTemplate({ adAccount, client });
          emailHtml = template.html;
          emailText = template.text;
          emailSubject = subject || template.subject;
        } else if (emailType === "suspension") {
          const template = getAdAccountSuspensionEmailTemplate({ adAccount, client });
          emailHtml = template.html;
          emailText = template.text;
          emailSubject = subject || template.subject;
        }
      } else {
        return res.status(400).json({ message: "Invalid email type" });
      }
      
      // Send the email
      const { sendEmail } = await import('./email-sender');
      const success = await sendEmail(emailSettings, {
        to: client.email,
        subject: emailSubject,
        html: emailHtml,
        text: emailText
      });
      
      if (!success) {
        return res.status(500).json({ message: "Failed to send email" });
      }
      
      res.json({ message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Manual email send error:", error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Send test email to a client
  app.post("/api/clients/:clientId/email-preferences/test", authenticate, async (req: Request, res: Response) => {
    try {
      const client = await storage.getClient(req.params.clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      if (!client.email) {
        return res.status(400).json({ message: "Client has no email address" });
      }
      
      const emailSettings = await storage.getEmailSettings();
      if (!emailSettings?.isConfigured) {
        return res.status(400).json({ message: "Email service is not configured" });
      }
      
      // Create a test ad account with realistic spend data
      const testAdAccount: AdAccount = {
        id: '',
        platform: 'Facebook' as any,
        accountName: 'Test Ad Account',
        accountId: 'test-123',
        clientId: client.id,
        spendLimit: '5000.00',
        totalSpend: '3500.00',
        status: 'suspended',
        notes: null,
        createdAt: null,
        updatedAt: null
      };
      
      // Send a test suspension email with real spend data
      await sendAdAccountSuspensionEmail(testAdAccount, client);
      
      console.log(`[EMAIL TEST] Sent test email to ${client.email}`);
      res.json({ message: "Test email sent successfully" });
    } catch (error) {
      console.error("Send test email error:", error);
      res.status(500).json({ message: "Failed to send test email", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // SMS Settings Routes
  // Get SMS settings
  app.get("/api/sms/settings", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSmsSettings();
      if (!settings) {
        return res.json(null);
      }
      res.json(settings);
    } catch (error) {
      console.error("Get SMS settings error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Save SMS settings
  app.post("/api/sms/settings", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { provider, apiKey, senderId, enableNotifications, enableAdActiveAlerts } = req.body;
      
      // Validate required fields
      if (!provider || !apiKey || !senderId) {
        return res.status(400).json({ message: "Provider, API key, and sender ID are required" });
      }

      // Save settings
      await storage.saveSmsSettings({
        provider,
        apiKey,
        senderId,
        enableNotifications: enableNotifications ?? false,
        enableAdActiveAlerts: enableAdActiveAlerts ?? true,
        isConfigured: false
      });

      res.json({ message: "SMS settings saved successfully" });
    } catch (error: any) {
      console.error("Save SMS settings error:", error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Send Test SMS
  app.post("/api/sms/test-send", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSmsSettings();
      const { phoneNumber, message } = req.body;

      console.log("Send test SMS request:", { phoneNumber, provider: settings?.provider });

      if (!settings || !settings.apiKey) {
        return res.status(400).json({ 
          success: false, 
          message: "SMS settings not configured. Please save your settings first." 
        });
      }

      if (!phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          message: "Phone number is required" 
        });
      }

      // Validate Bangladesh phone number format (starts with +880 or 880 or 01)
      const phoneRegex = /^(\+?880|0)?1[3-9]\d{8}$/;
      if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid Bangladesh phone number format. Use format: +8801XXXXXXXXX or 01XXXXXXXXX" 
        });
      }

      // Normalize phone number to international format
      let normalizedPhone = phoneNumber.replace(/\s/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '880' + normalizedPhone.substring(1);
      } else if (normalizedPhone.startsWith('+')) {
        normalizedPhone = normalizedPhone.substring(1);
      }

      // Use custom message if provided, otherwise use default
      const smsMessage = message || 'Test SMS from Advantix Admin. Your SMS service is configured correctly!';

      // Send test SMS based on provider
      console.log(`Sending test SMS via ${settings.provider} to ${normalizedPhone}`);
      let response;
      
      if (settings.provider === 'sms_in_bd') {
        // SMS in BD API - uses 'msg' and 'to' parameters (no senderid needed - it's in dashboard)
        const requestBody = {
          api_key: settings.apiKey,
          msg: smsMessage,
          to: normalizedPhone
        };
        console.log('SMS in BD request body:', JSON.stringify(requestBody, null, 2));
        
        response = await fetch('https://api.sms.net.bd/sendsms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
      } else if (settings.provider === 'bd_bulk_sms') {
        // BD Bulk SMS API
        response = await fetch('https://api.bdbulksms.com/api/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            api_key: settings.apiKey,
            sender_id: settings.senderId,
            to: normalizedPhone,
            message: smsMessage
          })
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          message: `Unsupported SMS provider: ${settings.provider}` 
        });
      }

      if (!response) {
        console.error("No response from SMS provider - provider may not be configured correctly");
        return res.status(500).json({ 
          success: false, 
          message: `SMS provider ${settings.provider} is not properly configured` 
        });
      }

      console.log(`SMS provider response status: ${response.status}`);

      if (!response.ok) {
        let errorMessage = 'Failed to send test SMS';
        try {
          const errorData = await response.text();
          console.error("SMS send error:", errorData);
          errorMessage = errorData.substring(0, 200);
        } catch (e) {
          console.error("Error parsing SMS provider response:", e);
        }
        
        await storage.updateSmsConnectionStatus(false, errorMessage);
        return res.status(400).json({ 
          success: false, 
          message: errorMessage
        });
      }

      const responseData = await response.json();
      console.log("SMS provider response:", responseData);
      
      // Check if the response contains an error (some providers return 200 with error object)
      if (responseData.error || responseData.msg?.toLowerCase().includes('error') || responseData.msg?.toLowerCase().includes('required')) {
        const errorMsg = responseData.msg || responseData.message || 'SMS provider returned an error';
        console.error("SMS send failed:", errorMsg);
        await storage.updateSmsConnectionStatus(false, errorMsg);
        return res.status(400).json({ 
          success: false, 
          message: errorMsg
        });
      }
      
      await storage.updateSmsConnectionStatus(true);
      res.json({ 
        success: true, 
        message: `Test SMS sent successfully to ${phoneNumber}` 
      });
    } catch (error: any) {
      console.error("Send test SMS error:", error);
      await storage.updateSmsConnectionStatus(false, error.message);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Internal server error" 
      });
    }
  });

  // Sync Facebook ad accounts
  app.post("/api/facebook/sync-accounts", authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getFacebookSettings();
      
      if (!settings || !settings.accessToken) {
        return res.status(400).json({ message: "Facebook settings not configured" });
      }

      // Fetch ad accounts from Facebook API
      const adAccountsUrl = `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id,account_status&access_token=${settings.accessToken}`;
      const response = await fetch(adAccountsUrl);
      
      if (!response.ok) {
        const errorData = await response.json();
        return res.status(400).json({ 
          message: errorData.error?.message || "Failed to fetch ad accounts from Facebook" 
        });
      }

      const data = await response.json();
      const fbAdAccounts = data.data || [];

      if (fbAdAccounts.length === 0) {
        return res.json({ 
          message: "No ad accounts found in your Facebook account",
          count: 0
        });
      }

      // Get all clients to use the first one as default
      const clients = await storage.getClients();
      let defaultClientId: string;
      
      if (clients.length === 0) {
        // Create a default client for Facebook ads
        const newClient = await storage.createClient({
          clientName: "Facebook Ads Client",
          businessName: "Facebook Advertising",
          contactPerson: "Facebook Admin",
          email: "facebook@default.com",
          phone: "",
          address: "",
          notes: "Auto-created for Facebook ad accounts"
        });
        defaultClientId = newClient.id;
      } else {
        defaultClientId = clients[0].id;
      }

      // Save ad accounts to database
      let syncedCount = 0;
      const errors: string[] = [];

      for (const fbAccount of fbAdAccounts) {
        try {
          // Check if account already exists
          const existingAccounts = await storage.getAdAccounts();
          const exists = existingAccounts.find(acc => 
            acc.platform.toLowerCase() === 'facebook' && acc.accountId === fbAccount.account_id
          );

          if (!exists) {
            await storage.createAdAccount({
              platform: 'facebook',
              accountName: fbAccount.name,
              accountId: fbAccount.account_id,
              clientId: defaultClientId,
              spendLimit: '10000.00',
              status: fbAccount.account_status === 1 ? 'active' : 'suspended',
              notes: `Synced from Facebook on ${new Date().toISOString()}`
            });
            syncedCount++;
          }
        } catch (error: any) {
          errors.push(`Failed to sync account ${fbAccount.name}: ${error.message}`);
        }
      }

      // Also sync Facebook Pages for each ad account
      let pagesSynced = 0;
      const pageErrors: string[] = [];
      
      for (const fbAccount of fbAdAccounts) {
        try {
          // Find the synced ad account ID
          const syncedAccounts = await storage.getAdAccounts();
          const syncedAccount = syncedAccounts.find(acc => 
            acc.platform.toLowerCase() === 'facebook' && acc.accountId === fbAccount.account_id
          );

          if (syncedAccount) {
            // Fetch pages for this ad account from Facebook
            // Note: Pages API requires page-level access token or user access token with pages_manage_metadata permission
            const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,category,picture&access_token=${settings.accessToken}`;
            const pagesResponse = await fetch(pagesUrl);
            
            if (pagesResponse.ok) {
              const pagesData = await pagesResponse.json();
              const fbPages = pagesData.data || [];

              // Save pages to database (associate with this ad account)
              for (const fbPage of fbPages) {
                try {
                  // Check if page already exists for this ad account
                  const existingPages = await db.select()
                    .from(facebookPages)
                    .where(eq(facebookPages.facebookPageId, fbPage.id));

                  if (existingPages.length === 0) {
                    await db.insert(facebookPages).values({
                      facebookPageId: fbPage.id,
                      pageName: fbPage.name,
                      category: fbPage.category || 'Not specified',
                      profilePictureUrl: fbPage.picture?.data?.url || null,
                      accessToken: null, // We'd need page-specific token for posting
                      adAccountId: syncedAccount.id,
                      isActive: true
                    });
                    pagesSynced++;
                  }
                } catch (pageError: any) {
                  pageErrors.push(`Failed to sync page ${fbPage.name}: ${pageError.message}`);
                }
              }
            }
          }
        } catch (error: any) {
          pageErrors.push(`Failed to sync pages for account ${fbAccount.name}: ${error.message}`);
        }
      }

      res.json({ 
        message: `Successfully synced ${syncedCount} ad account(s) and ${pagesSynced} page(s)`,
        accountsSynced: syncedCount,
        pagesSynced,
        total: fbAdAccounts.length,
        errors: [...errors, ...pageErrors].length > 0 ? [...errors, ...pageErrors] : undefined
      });
    } catch (error: any) {
      console.error("Sync Facebook ad accounts error:", error);
      res.status(500).json({ 
        message: error.message || "Internal server error" 
      });
    }
  });

  // Get Facebook ad accounts (from existing ad_accounts table filtered by platform)
  app.get("/api/facebook/ad-accounts", authenticate, async (req: Request, res: Response) => {
    try {
      const allAdAccounts = await storage.getAdAccounts();
      const facebookAccounts = allAdAccounts
        .filter(acc => acc.platform.toLowerCase() === 'facebook')
        .map(acc => ({
          id: acc.id,
          name: acc.accountName,
          accountId: acc.accountId,
          platform: acc.platform
        }));
      res.json(facebookAccounts);
    } catch (error) {
      console.error("Get Facebook ad accounts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get Facebook Pages for an ad account
  app.get("/api/facebook/pages/:adAccountId?", authenticate, async (req: Request, res: Response) => {
    try {
      const { adAccountId } = req.params;
      const pages = await db.select()
        .from(facebookPages)
        .where(adAccountId ? eq(facebookPages.adAccountId, adAccountId) : sql`true`)
        .orderBy(desc(facebookPages.createdAt));
      res.json(pages);
    } catch (error) {
      console.error("Get Facebook pages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get Facebook account insights
  app.get("/api/facebook/insights/:adAccountId", authenticate, async (req: Request, res: Response) => {
    try {
      const { adAccountId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      
      const insights = await storage.getFacebookAccountInsights(adAccountId, startDate, endDate);
      res.json(insights);
    } catch (error) {
      console.error("Get Facebook account insights error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get Facebook campaign insights
  app.get("/api/facebook/campaigns/:adAccountId", authenticate, async (req: Request, res: Response) => {
    try {
      const { adAccountId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      
      const insights = await storage.getFacebookCampaignInsights(adAccountId, startDate, endDate);
      res.json(insights);
    } catch (error) {
      console.error("Get Facebook campaign insights error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Sync Facebook data
  app.post("/api/facebook/sync/:adAccountId", authenticate, async (req: Request, res: Response) => {
    try {
      const { adAccountId } = req.params;
      const settings = await storage.getFacebookSettings();
      
      if (!settings || !settings.isConnected) {
        return res.status(400).json({ message: "Facebook not connected. Please configure settings first." });
      }

      const adAccount = await storage.getAdAccount(adAccountId);
      if (!adAccount || adAccount.platform.toLowerCase() !== 'facebook') {
        return res.status(404).json({ message: "Facebook ad account not found" });
      }

      // Calculate date range (last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const since = startDate.toISOString().split('T')[0];
      const until = endDate.toISOString().split('T')[0];

      // Fetch account-level insights with daily breakdown
      const accountApiUrl = `https://graph.facebook.com/v18.0/act_${adAccount.accountId}/insights?access_token=${settings.accessToken}&time_range={'since':'${since}','until':'${until}'}&time_increment=1&level=account&fields=spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions`;
      
      const accountResponse = await fetch(accountApiUrl);
      
      if (!accountResponse.ok) {
        const errorData = await accountResponse.json();
        return res.status(400).json({ message: errorData.error?.message || "Failed to fetch account insights from Facebook" });
      }

      const accountData = await accountResponse.json();
      let accountRecordsUpdated = 0;
      
      // Store account insights in database
      if (accountData.data && accountData.data.length > 0) {
        for (const dailyInsight of accountData.data) {
          const dateString = dailyInsight.date_start;
          const conversionsAction = dailyInsight.actions?.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_purchase');
          const conversions = conversionsAction ? parseInt(conversionsAction.value) : 0;
          const spend = parseFloat(dailyInsight.spend || "0");
          const conversionValue = conversionsAction ? parseFloat(conversionsAction.value || "0") : 0;
          const roas = spend > 0 && conversionValue > 0 ? (conversionValue / spend).toFixed(2) : "0";
          
          await storage.upsertFacebookAccountInsight({
            adAccountId: adAccount.id,
            date: new Date(dateString),
            spend: dailyInsight.spend || "0",
            impressions: parseInt(dailyInsight.impressions) || 0,
            clicks: parseInt(dailyInsight.clicks) || 0,
            ctr: dailyInsight.ctr || "0",
            cpc: dailyInsight.cpc || "0",
            cpm: dailyInsight.cpm || "0",
            reach: parseInt(dailyInsight.reach) || 0,
            frequency: dailyInsight.frequency || "0",
            conversions,
            costPerConversion: conversions > 0 ? (spend / conversions).toFixed(2) : "0",
            conversionRate: dailyInsight.clicks > 0 ? ((conversions / parseInt(dailyInsight.clicks)) * 100).toFixed(2) : "0",
            roas
          });
          accountRecordsUpdated++;
        }
      }

      // First fetch campaign details (status, objective, budget)
      const campaignsUrl = `https://graph.facebook.com/v18.0/act_${adAccount.accountId}/campaigns?access_token=${settings.accessToken}&fields=id,name,status,objective,daily_budget&limit=100`;
      const campaignsResponse = await fetch(campaignsUrl);
      const campaignDetailsMap = new Map();
      
      if (campaignsResponse.ok) {
        const campaignsData = await campaignsResponse.json();
        if (campaignsData.data) {
          for (const camp of campaignsData.data) {
            campaignDetailsMap.set(camp.id, {
              status: camp.status || 'ACTIVE',
              objective: camp.objective || null,
              dailyBudget: camp.daily_budget ? (parseFloat(camp.daily_budget) / 100).toFixed(2) : null // Facebook returns cents
            });
          }
        }
      }

      // Fetch campaign-level insights
      const campaignApiUrl = `https://graph.facebook.com/v18.0/act_${adAccount.accountId}/insights?access_token=${settings.accessToken}&time_range={'since':'${since}','until':'${until}'}&time_increment=1&level=campaign&fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions`;
      
      const campaignResponse = await fetch(campaignApiUrl);
      let campaignRecordsUpdated = 0;
      
      if (campaignResponse.ok) {
        const campaignData = await campaignResponse.json();
        
        if (campaignData.data && campaignData.data.length > 0) {
          for (const dailyCampaign of campaignData.data) {
            const dateString = dailyCampaign.date_start;
            const conversionsAction = dailyCampaign.actions?.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_purchase');
            const conversions = conversionsAction ? parseInt(conversionsAction.value) : 0;
            const spend = parseFloat(dailyCampaign.spend || "0");
            const conversionValue = conversionsAction ? parseFloat(conversionsAction.value || "0") : 0;
            const roas = spend > 0 && conversionValue > 0 ? (conversionValue / spend).toFixed(2) : "0";
            
            // Get campaign details from map
            const campaignDetails = campaignDetailsMap.get(dailyCampaign.campaign_id) || {};
            
            await storage.upsertFacebookCampaignInsight({
              adAccountId: adAccount.id,
              fbCampaignId: dailyCampaign.campaign_id,
              campaignName: dailyCampaign.campaign_name || "Unnamed Campaign",
              status: campaignDetails.status || "ACTIVE",
              objective: campaignDetails.objective,
              dailyBudget: campaignDetails.dailyBudget,
              date: new Date(dateString),
              spend: dailyCampaign.spend || "0",
              impressions: parseInt(dailyCampaign.impressions) || 0,
              clicks: parseInt(dailyCampaign.clicks) || 0,
              ctr: dailyCampaign.ctr || "0",
              cpc: dailyCampaign.cpc || "0",
              cpm: dailyCampaign.cpm || "0",
              reach: parseInt(dailyCampaign.reach) || 0,
              frequency: dailyCampaign.frequency || "0",
              conversions,
              costPerConversion: conversions > 0 ? (spend / conversions).toFixed(2) : "0",
              conversionRate: dailyCampaign.clicks > 0 ? ((conversions / parseInt(dailyCampaign.clicks)) * 100).toFixed(2) : "0",
              roas
            });
            campaignRecordsUpdated++;
          }
        }
      }

      res.json({ 
        message: "Data synced successfully", 
        accountRecordsUpdated,
        campaignRecordsUpdated,
        totalRecords: accountRecordsUpdated + campaignRecordsUpdated
      });
    } catch (error: any) {
      console.error("Sync Facebook data error:", error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // ============================================================================
  // ADVANTIX ADS MANAGER ROUTES - Campaign Creation & Management
  // ============================================================================

  // Get all campaign drafts
  app.get("/api/campaign-drafts", authenticate, async (req: Request, res: Response) => {
    try {
      const drafts = await storage.getCampaignDrafts();
      res.json(drafts);
    } catch (error) {
      console.error("Get campaign drafts error:", error);
      res.status(500).json({ message: "Failed to fetch campaign drafts" });
    }
  });

  // Get single campaign draft
  app.get("/api/campaign-drafts/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const draft = await storage.getCampaignDraftById(id);
      
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }
      
      res.json(draft);
    } catch (error) {
      console.error("Get campaign draft error:", error);
      res.status(500).json({ message: "Failed to fetch campaign draft" });
    }
  });

  // Create new campaign draft
  app.post("/api/campaign-drafts", authenticate, async (req: Request, res: Response) => {
    try {
      const draftData = {
        ...req.body,
        createdBy: (req as any).user?.id,
      };
      
      const draft = await storage.createCampaignDraft(draftData);
      res.json(draft);
    } catch (error) {
      console.error("Create campaign draft error:", error);
      res.status(500).json({ message: "Failed to create campaign draft" });
    }
  });

  // Update campaign draft
  app.put("/api/campaign-drafts/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const draft = await storage.updateCampaignDraft(id, req.body);
      
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }
      
      res.json(draft);
    } catch (error) {
      console.error("Update campaign draft error:", error);
      res.status(500).json({ message: "Failed to update campaign draft" });
    }
  });

  // Delete campaign draft
  app.delete("/api/campaign-drafts/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteCampaignDraft(id);
      res.json({ message: "Draft deleted successfully" });
    } catch (error) {
      console.error("Delete campaign draft error:", error);
      res.status(500).json({ message: "Failed to delete campaign draft" });
    }
  });

  // Publish campaign draft to Facebook
  app.post("/api/campaign-drafts/:id/publish", authenticate, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const draft = await storage.getCampaignDraftById(id);
      
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      // Get Facebook settings
      const settings = await storage.getFacebookSettings();
      if (!settings || !settings.accessToken) {
        return res.status(400).json({ message: "Facebook settings not configured" });
      }

      // Get ad account details
      const adAccount = await storage.getAdAccountById(draft.adAccountId);
      if (!adAccount) {
        return res.status(404).json({ message: "Ad account not found" });
      }

      // Update draft status to publishing
      await storage.updateCampaignDraft(id, { status: "publishing" });

      // Create Campaign on Facebook
      const campaignData = {
        name: draft.campaignName,
        objective: draft.objective,
        status: "PAUSED", // Start paused for safety
        special_ad_categories: [],
      };

      const campaignUrl = `https://graph.facebook.com/v18.0/act_${adAccount.accountId}/campaigns?access_token=${settings.accessToken}`;
      const campaignResponse = await fetch(campaignUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignData),
      });

      if (!campaignResponse.ok) {
        const error = await campaignResponse.json();
        await storage.updateCampaignDraft(id, { status: "failed", notes: error.error?.message || "Campaign creation failed" });
        return res.status(400).json({ message: error.error?.message || "Failed to create campaign" });
      }

      const campaignResult = await campaignResponse.json();
      const fbCampaignId = campaignResult.id;

      // Update draft as published
      await storage.updateCampaignDraft(id, {
        status: "published",
        publishedCampaignId: fbCampaignId,
      });

      res.json({
        message: "Campaign published successfully",
        campaignId: fbCampaignId,
        draft: await storage.getCampaignDraftById(id),
      });
    } catch (error: any) {
      console.error("Publish campaign error:", error);
      const { id } = req.params;
      await storage.updateCampaignDraft(id, { status: "failed", notes: error.message });
      res.status(500).json({ message: error.message || "Failed to publish campaign" });
    }
  });

  // Get campaign templates
  app.get("/api/campaign-templates", authenticate, async (req: Request, res: Response) => {
    try {
      const templates = await storage.getCampaignTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Get campaign templates error:", error);
      res.status(500).json({ message: "Failed to fetch campaign templates" });
    }
  });

  // Get saved audiences
  app.get("/api/saved-audiences", authenticate, async (req: Request, res: Response) => {
    try {
      const audiences = await storage.getSavedAudiences();
      res.json(audiences);
    } catch (error) {
      console.error("Get saved audiences error:", error);
      res.status(500).json({ message: "Failed to fetch saved audiences" });
    }
  });

  // ===== FARMING ACCOUNTS ROUTES =====
  
  // Get all farming accounts with optional filters
  app.get("/api/farming-accounts", authenticate, async (req: Request, res: Response) => {
    try {
      const { status, socialMedia, vaId, search } = req.query;
      
      const filters = {
        status: status as string | undefined,
        socialMedia: socialMedia as string | undefined,
        vaId: vaId as string | undefined,
        search: search as string | undefined,
      };
      
      const accounts = await storage.getFarmingAccounts(filters);
      res.json(accounts);
    } catch (error) {
      console.error("Get farming accounts error:", error);
      res.status(500).json({ message: "Failed to fetch farming accounts" });
    }
  });

  // Get single farming account (with secrets for admin only)
  app.get("/api/farming-accounts/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const includeSecrets = req.query.includeSecrets === 'true';
      
      // Only admin/super_admin can view secrets
      if (includeSecrets && req.user?.role !== UserRole.ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ message: "Access denied. Admin access required to view secrets." });
      }
      
      const account = includeSecrets 
        ? await storage.getFarmingAccountWithSecrets(id)
        : await storage.getFarmingAccount(id);
        
      if (!account) {
        return res.status(404).json({ message: "Farming account not found" });
      }
      
      res.json(account);
    } catch (error) {
      console.error("Get farming account error:", error);
      res.status(500).json({ message: "Failed to fetch farming account" });
    }
  });

  // Create farming account
  app.post("/api/farming-accounts", authenticate, async (req: Request, res: Response) => {
    try {
      const accountData = insertFarmingAccountSchema.parse(req.body);
      const account = await storage.createFarmingAccount(accountData);
      res.status(201).json(account);
    } catch (error: any) {
      console.error("Create farming account error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to create farming account" });
    }
  });

  // Update farming account
  app.put("/api/farming-accounts/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const accountData = insertFarmingAccountSchema.partial().parse(req.body);
      
      const account = await storage.updateFarmingAccount(id, accountData);
      if (!account) {
        return res.status(404).json({ message: "Farming account not found" });
      }
      
      res.json(account);
    } catch (error: any) {
      console.error("Update farming account error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to update farming account" });
    }
  });

  // Delete farming account
  app.delete("/api/farming-accounts/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteFarmingAccount(id);
      
      if (!success) {
        return res.status(404).json({ message: "Farming account not found" });
      }
      
      res.json({ message: "Farming account deleted successfully" });
    } catch (error) {
      console.error("Delete farming account error:", error);
      res.status(500).json({ message: "Failed to delete farming account" });
    }
  });

  // CSV Import farming accounts
  app.post("/api/farming-accounts/import/csv", authenticate, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString();
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      // Validate and transform CSV records
      const accounts: InsertFarmingAccount[] = records.map((record: any) => ({
        comment: record.comment || record.Comment || null,
        socialMedia: (record.socialMedia || record['Social Media'] || record.social_media || '').toLowerCase(),
        vaId: record.vaId || record.VA || record.va_id || null,
        status: (record.status || record.Status || 'new').toLowerCase(),
        idName: record.idName || record['ID Name'] || record.id_name || '',
        email: record.email || record.Email || '',
        recoveryEmail: record.recoveryEmail || record['Recovery Mail'] || record.recovery_email || record.recovery_mail || undefined,
        password: record.password || record.Password || '',
        twoFaSecret: record.twoFaSecret || record['2FA'] || record.two_fa_secret || record.two_fa || undefined,
      }));

      const result = await storage.importFarmingAccountsFromCsv(accounts);
      
      res.json({
        message: `Imported ${result.success} accounts successfully`,
        success: result.success,
        errors: result.errors,
      });
    } catch (error: any) {
      console.error("CSV import error:", error);
      res.status(500).json({ message: error.message || "Failed to import CSV" });
    }
  });

  // CSV Export farming accounts (admin only for secrets)
  app.get("/api/farming-accounts/export/csv", authenticate, async (req: Request, res: Response) => {
    try {
      const includeSecrets = req.query.includeSecrets === 'true';
      
      // Only admin/super_admin can export with secrets
      if (includeSecrets && req.user?.role !== UserRole.ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ message: "Access denied. Admin access required to export with secrets." });
      }
      
      const accounts = await storage.exportFarmingAccountsToCsv(includeSecrets);
      
      // Convert to CSV format
      const headers = includeSecrets
        ? ['id', 'comment', 'socialMedia', 'vaId', 'status', 'idName', 'email', 'recoveryEmail', 'password', 'twoFaSecret', 'createdAt']
        : ['id', 'comment', 'socialMedia', 'vaId', 'status', 'idName', 'email', 'createdAt'];
      
      let csvContent = headers.join(',') + '\n';
      
      accounts.forEach(account => {
        const row = headers.map(header => {
          const value = (account as any)[header];
          // Escape values with commas or quotes
          if (value && typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        });
        csvContent += row.join(',') + '\n';
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=farming-accounts-${Date.now()}.csv`);
      res.send(csvContent);
    } catch (error) {
      console.error("CSV export error:", error);
      res.status(500).json({ message: "Failed to export CSV" });
    }
  });

  // Gher Management - Tags
  app.get("/api/gher/tags", authenticate, async (req: Request, res: Response) => {
    try {
      const tags = await storage.getGherTags();
      res.json(tags);
    } catch (error) {
      console.error("Get gher tags error:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  app.post("/api/gher/tags", authenticate, async (req: Request, res: Response) => {
    try {
      const tag = await storage.createGherTag(req.body);
      res.status(201).json(tag);
    } catch (error) {
      console.error("Create gher tag error:", error);
      res.status(500).json({ message: "Failed to create tag" });
    }
  });

  app.patch("/api/gher/tags/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const tag = await storage.updateGherTag(req.params.id, req.body);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json(tag);
    } catch (error) {
      console.error("Update gher tag error:", error);
      res.status(500).json({ message: "Failed to update tag" });
    }
  });

  app.delete("/api/gher/tags/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteGherTag(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete gher tag error:", error);
      res.status(500).json({ message: "Failed to delete tag" });
    }
  });

  // Gher Management - Partners
  app.get("/api/gher/partners", authenticate, async (req: Request, res: Response) => {
    try {
      const partners = await storage.getGherPartners();
      res.json(partners);
    } catch (error) {
      console.error("Get gher partners error:", error);
      res.status(500).json({ message: "Failed to fetch partners" });
    }
  });

  app.post("/api/gher/partners", authenticate, async (req: Request, res: Response) => {
    try {
      const partner = await storage.createGherPartner(req.body);
      res.status(201).json(partner);
    } catch (error) {
      console.error("Create gher partner error:", error);
      res.status(500).json({ message: "Failed to create partner" });
    }
  });

  app.patch("/api/gher/partners/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const partner = await storage.updateGherPartner(req.params.id, req.body);
      if (!partner) {
        return res.status(404).json({ message: "Partner not found" });
      }
      res.json(partner);
    } catch (error) {
      console.error("Update gher partner error:", error);
      res.status(500).json({ message: "Failed to update partner" });
    }
  });

  app.delete("/api/gher/partners/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteGherPartner(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Partner not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete gher partner error:", error);
      res.status(500).json({ message: "Failed to delete partner" });
    }
  });

  // Gher Management - Entries
  app.get("/api/gher/entries", authenticate, async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      if (req.query.partnerId) {
        filters.partnerId = req.query.partnerId as string;
      }
      
      const entries = await storage.getGherEntries(filters);
      res.json(entries);
    } catch (error) {
      console.error("Get gher entries error:", error);
      res.status(500).json({ message: "Failed to fetch entries" });
    }
  });

  app.post("/api/gher/entries", authenticate, async (req: Request, res: Response) => {
    try {
      const entryData = {
        ...req.body,
        date: new Date(req.body.date),
      };
      const entry = await storage.createGherEntry(entryData);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Create gher entry error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create entry";
      if (errorMessage.includes("Cannot use") || errorMessage.includes("Tag with ID")) {
        return res.status(400).json({ message: errorMessage });
      }
      res.status(500).json({ message: "Failed to create entry" });
    }
  });

  app.patch("/api/gher/entries/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const updateData = {
        ...req.body,
        ...(req.body.date && { date: new Date(req.body.date) }),
      };
      const entry = await storage.updateGherEntry(req.params.id, updateData);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Update gher entry error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update entry";
      if (errorMessage.includes("Cannot use") || errorMessage.includes("Tag with ID")) {
        return res.status(400).json({ message: errorMessage });
      }
      res.status(500).json({ message: "Failed to update entry" });
    }
  });

  app.delete("/api/gher/entries/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteGherEntry(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete gher entry error:", error);
      res.status(500).json({ message: "Failed to delete entry" });
    }
  });

  app.post("/api/gher/entries/delete-all", authenticate, async (req: Request, res: Response) => {
    try {
      const count = await storage.deleteAllGherEntries();
      res.json({ message: `${count} entry(ies) deleted successfully`, count });
    } catch (error) {
      console.error("Delete all gher entries error:", error);
      res.status(500).json({ message: "Failed to delete all entries" });
    }
  });

  // Gher Management - Dashboard Stats
  app.get("/api/gher/dashboard-stats", authenticate, async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      if (req.query.partnerId) {
        filters.partnerId = req.query.partnerId as string;
      }
      
      const stats = await storage.getGherDashboardStats(filters);
      res.json(stats);
    } catch (error) {
      console.error("Get gher dashboard stats error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
