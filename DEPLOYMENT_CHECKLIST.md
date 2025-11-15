# 🚀 Deployment Checklist

This checklist ensures code works consistently across development and production environments.

## ⚠️ Common Issues & How to Prevent Them

**Problem:** Features work locally but fail in production  
**Root Cause:** Environment differences (missing secrets, database state, configuration)

---

## 📋 Pre-Deployment Checklist

### 1. Environment Variables
Ensure ALL required environment variables are set on the production server:

```bash
# Required for ALL deployments
DATABASE_URL=postgresql://...          # Production database connection string
PORT=5000                              # Application port (usually set by platform)
NODE_ENV=production                    # Environment mode

# Required for Email/Farming Features
ENCRYPTION_SECRET=<32-byte-hex>        # Generate with: openssl rand -base64 32

# Optional - Facebook Integration
FACEBOOK_APP_ID=...                    # Only if using FB features
FACEBOOK_APP_SECRET=...                # Only if using FB features
```

**How to generate ENCRYPTION_SECRET:**
```bash
openssl rand -base64 32
```

### 2. Database Migrations
Ensure database schema is up-to-date:

```bash
# Run migrations on production
npm run db:push
```

**If schema push fails or warns about data loss, use force flag:**
```bash
# Option 1: Using npm (-- passes flags through)
npm run db:push -- --force

# Option 2: Using npx directly
npx drizzle-kit push --force
```

**Note:** The `--force` flag will apply schema changes even if they may cause data loss. Review changes carefully and backup your database first.

**Check these tables exist:**
- `users`
- `sessions`
- `user_menu_permissions`
- `email_accounts` ← **IMPORTANT for Mail Management**
- `farming_accounts`
- `finance_expenses`
- `finance_projects`
- `gher_entries`
- `gher_tags`
- `gher_invoices`
- All other tables in `shared/schema.ts`

### 3. Database Connection Test
Verify production database is accessible:

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"
```

### 4. Feature-Specific Requirements

#### 📧 Mail Management (Own Farming)
- ✅ `email_accounts` table exists
- ✅ Database accessible
- ✅ User has permission: `mailManagement = true`

#### 🌾 Farming Accounts (Own Farming)
- ✅ `farming_accounts` table exists  
- ✅ `ENCRYPTION_SECRET` environment variable set
- ✅ User has permission: `farmingAccounts = true`

#### 💰 Finance Module
- ✅ `finance_expenses` table exists
- ✅ `finance_projects` table exists
- ✅ User has permission: `finance = true`

#### 🐟 Gher Management
- ✅ All gher-related tables exist
- ✅ User has permission: `gher_management = true`

---

## 🔍 Post-Deployment Verification

### 1. Health Check
Visit these endpoints to verify services are running:

```bash
# Check app is accessible
curl https://your-domain.com

# Check API responds
curl https://your-domain.com/api/health

# Check database connection (requires auth)
curl -H "Authorization: Bearer <token>" https://your-domain.com/api/users
```

### 2. Feature Testing
Test each major feature manually:

- [ ] Login/Authentication
- [ ] Dashboard loads
- [ ] Campaign Management
- [ ] Client Management  
- [ ] Finance Module (add expense)
- [ ] Own Farming - Mail Management (add email account)
- [ ] Own Farming - Farming Accounts (if encryption configured)
- [ ] Gher Management (add entry)

### 3. Check Browser Console
Open browser DevTools and verify:
- No JavaScript errors
- API calls return 200/201 status codes
- No CORS errors

### 4. Check Server Logs
Monitor production logs for errors:

```bash
# Look for these errors
"Failed to create email account"      → Missing table or database issue
"Encryption setup validation failed"  → Missing ENCRYPTION_SECRET
"Cannot connect to database"          → DATABASE_URL incorrect
```

---

## 🐛 Troubleshooting Guide

### "Failed to add email account"
**Diagnosis:**
1. Check server logs for actual error
2. Verify `email_accounts` table exists
3. Check database connection

**Fix:**
```bash
# Run migrations
npm run db:push

# Verify table exists
psql $DATABASE_URL -c "\d email_accounts"
```

### "Encryption not configured"  
**Diagnosis:** Missing `ENCRYPTION_SECRET` environment variable

**Fix:**
```bash
# Generate secret
ENCRYPTION_SECRET=$(openssl rand -base64 32)

# Set on production server
export ENCRYPTION_SECRET="<generated-value>"

# Restart application
```

### Features work locally but not in production
**Common Causes:**
1. **Missing environment variables** → Check `.env` vs production config
2. **Database schema mismatch** → Run migrations on production
3. **Different database data** → Seed production with required data
4. **CORS issues** → Check allowed origins
5. **Permission issues** → Verify user permissions in `user_menu_permissions` table

**Debug Process:**
1. Compare local `.env` with production environment variables
2. Check `git diff` to see what changed
3. Review server logs for specific errors
4. Test API endpoints directly with curl/Postman
5. Check database state with SQL queries

---

## 📝 Developer Workflow

### Before Committing Code
- [ ] Test feature works locally
- [ ] Check what environment variables are used
- [ ] Document any new environment variables needed
- [ ] Run database migrations locally
- [ ] Test with production-like data

### After Pushing to Git
- [ ] Client pulls latest code
- [ ] Client sets any NEW environment variables
- [ ] Client runs database migrations: `npm run db:push`
- [ ] Client restarts application
- [ ] Verify feature works in production

### When Adding New Features
If your feature requires:
- **New environment variable** → Document in this checklist
- **Database table/column** → Create schema in `shared/schema.ts`
- **External API** → Document API keys needed
- **File storage** → Document path permissions

---

## 🔐 Security Checklist
- [ ] All secrets stored as environment variables (never in code)
- [ ] Production uses HTTPS
- [ ] Database uses SSL connection
- [ ] CORS configured properly
- [ ] Authentication required on protected routes
- [ ] User permissions enforced

---

## 📞 When Things Go Wrong

1. **Check server logs** - Most errors appear here
2. **Check browser console** - Frontend errors show here
3. **Compare environments** - Dev vs Production differences
4. **Test API directly** - Isolate frontend vs backend issues
5. **Check database state** - Verify tables and data exist
6. **Restart services** - Sometimes fixes configuration changes

**Contact developer if:**
- Database schema needs complex migration
- New tables need to be created manually
- Encryption keys need rotation
- Major architectural changes needed
