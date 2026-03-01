# SanaaDeck - AI Development Prompts (Revised)
## Copy-Paste Prompts for No-Code AI Development

---

## DOCUMENT PURPOSE

This document provides ready-to-use prompts for AI coding assistants (Cursor AI, Bolt.new, Claude Code) to build SanaaDeck's credit-based creative platform.

**Changes from Original:**
- Credit tracking system prompts
- Dashboard-only workflow (no WhatsApp)
- Performance scoring implementation
- Extra credit pack management
- Removed AI brief enhancement prompts

---

## HOW TO USE THIS DOCUMENT

1. **Copy the entire prompt** including context
2. **Paste into your AI coding tool** (Cursor, Bolt, Claude Code)
3. **Review the generated code** before committing
4. **Test thoroughly** in local environment
5. **Deploy** to Firebase when ready

**Tip:** Always provide the full context section with each prompt for best results.

---

## PROMPT 1: PROJECT INITIALIZATION

### Context to Provide

```
I'm building SanaaDeck, a credit-based creative production platform for East Africa. 

Key features:
- Credit system (1 credit = 45 min production time)
- Three subscription tiers (Starter: 15 credits, Growth: 30 credits, Pro: 60 credits)
- Dashboard-only workflow (no WhatsApp integration)
- Firebase backend (Firestore, Auth, Functions, Storage)
- React 18 + Vite + TailwindCSS + Shadcn/ui frontend
- M-Pesa and Pesapal payment integration
- Performance tracking for creatives (CPS score)

Target users: East African businesses needing design services
```

### Prompt

```
Create a complete React 18 + Vite project structure for SanaaDeck with the following specifications:

TECH STACK:
- React 18.2+ with Vite
- TailwindCSS 3.x for styling
- Shadcn/ui for UI components
- React Router 6 for routing
- React Query for data fetching
- Zustand for state management
- Firebase SDK (Auth, Firestore, Storage, Functions)

PROJECT STRUCTURE:
/src
  /components
    /ui (shadcn components)
    /dashboard (Client, Creative, Admin dashboards)
    /auth (Login, Signup components)
    /projects (Project management components)
    /credits (Credit tracking components)
  /services
    firebase.js
    authService.js
    creditService.js
    projectService.js
    paymentService.js
  /hooks
    useAuth.js
    useCredits.js
    useProjects.js
  /stores
    authStore.js
    creditsStore.js
  /utils
    constants.js
    helpers.js
  /pages
    Dashboard.jsx
    Login.jsx
    Signup.jsx
    Projects.jsx
    Credits.jsx
  App.jsx
  main.jsx

CONFIGURATION FILES NEEDED:
- vite.config.js
- tailwind.config.js
- .env.example
- package.json with all dependencies

Include:
1. Complete file structure
2. All necessary dependencies in package.json
3. Vite configuration optimized for production
4. TailwindCSS config with custom colors for SanaaDeck brand
5. Basic Firebase config template
6. React Router setup with protected routes
7. Shadcn/ui initialization

Generate all configuration files and basic project structure. Do not implement features yet - just set up the foundation.
```

---

## PROMPT 2: FIREBASE CONFIGURATION

### Prompt

```
Set up complete Firebase configuration for SanaaDeck:

Create /src/services/firebase.js with:
1. Firebase app initialization
2. Authentication instance
3. Firestore database instance
4. Firebase Storage instance
5. Cloud Functions instance

Environment variables needed:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

Also create .env.example file with placeholder values and instructions.

Use ES6 imports and export instances ready for use throughout the application.
```

---

## PROMPT 3: AUTHENTICATION SYSTEM

### Prompt

```
Create a complete authentication system for SanaaDeck with role-based access:

ROLES:
- client
- creative
- admin
- super_admin

FEATURES NEEDED:
1. Email/password signup and login
2. Role selection during signup
3. Automatic user document creation in Firestore
4. Automatic profile creation (clients/ or creatives/ collection based on role)
5. Protected routes based on role
6. Auth state persistence
7. Login/logout functionality

CREATE THESE FILES:

1. /src/services/authService.js
   - signUp(email, password, userData) - creates user + profile
   - signIn(email, password)
   - signOut()
   - getUserProfile(uid) - fetches user + profile data
   - createClientProfile(userId, data)
   - createCreativeProfile(userId, data)

2. /src/hooks/useAuth.js
   - Custom hook for auth state
   - Returns: { user, loading, signIn, signUp, signOut, userProfile }

3. /src/stores/authStore.js (Zustand)
   - Centralized auth state management
   - Persist auth state across refreshes

4. /src/components/auth/LoginForm.jsx
   - Email/password inputs
   - Form validation
   - Error handling
   - Submit handler

5. /src/components/auth/SignupForm.jsx
   - Email, password, confirmPassword
   - Role selection (Client or Creative)
   - Business/creative info fields (conditional based on role)
   - Form validation
   - Submit handler

6. /src/components/ProtectedRoute.jsx
   - Route wrapper that checks authentication
   - Redirects to /login if not authenticated
   - Supports role-based access (optional allowedRoles prop)

FOR CLIENT PROFILE CREATION:
When role is 'client', create document in clients/ collection with:
- userId (reference to users/)
- businessName
- industry
- country (KE, UG, RW, BI)
- subscription object with tier (starter/growth/pro) and credit allocation
- Empty extraCredits array
- paymentMethod and phoneNumber
- Initial stats (all zeros)
- Brand assets object (empty initially)
- Timestamps

FOR CREATIVE PROFILE CREATION:
When role is 'creative', create document in creatives/ collection with:
- userId (reference to users/)
- displayName
- specialty (graphic_design, illustration, motion_graphics, copywriting)
- tier (mid by default)
- payoutRate ($9 for mid tier)
- performance object (initialized with default good scores)
- earnings object (all zeros)
- Empty bonuses object
- Timestamps

Include proper error handling, loading states, and TypeScript types if using TS.
```

---

## PROMPT 4: CREDIT TRACKING ENGINE

### Prompt

```
Create the core credit tracking system for SanaaDeck:

CREDIT SYSTEM RULES:
- 1 credit = 45 minutes of production time
- Credits come from: monthly subscription allocation OR extra credit packs
- Subscription credits reset monthly
- Extra credit packs: 10 credits, $250, valid 30 days, max 20 unused stacked
- Credits deducted ONLY after client confirms project (no auto-deduction)
- Deduction priority: subscription credits first, then extra packs (FIFO)
- All credit movements must be logged in creditTransactions/ collection

CREATE /src/services/creditService.js with:

1. getCreditBalance(clientId)
   - Returns: { subscriptionCredits, extraCredits, totalCredits, tier, creditsPerMonth, creditsUsed }
   - Calculates subscription credits remaining
   - Adds valid (non-expired) extra pack credits
   - Returns complete breakdown

2. estimateCredits(deliverableType, complexity)
   - deliverableType: 'social_post', 'carousel', 'flyer', 'poster', etc.
   - complexity: 'standard', 'complex', 'advanced'
   - Returns estimated credit cost
   - Base estimates:
     * social_post: 1
     * carousel: 2
     * flyer: 2
     * poster: 2
     * brochure_4pg: 4
     * presentation_10slides: 5
     * logo_concepts: 6
     * packaging: 6
     * motion_30sec: 5
   - Multipliers: complex (+50%), advanced (+100%)

3. reserveCredits(clientId, projectId, creditsAmount)
   - Check if sufficient credits available
   - Deduct from subscription credits first
   - If not enough, deduct from extra packs (oldest first - FIFO)
   - Update client document
   - Log transaction for each deduction
   - Throw error if insufficient credits
   - Return success boolean

4. deductFromExtraPacks(clientId, projectId, creditsAmount)
   - Get client's extra packs
   - Filter valid (non-expired) packs
   - Sort by purchaseDate (oldest first)
   - Deduct from packs in order until amount satisfied
   - Update pack creditsUsed and creditsRemaining
   - Log each pack deduction
   - Update client document with modified packs array

5. logCreditTransaction(clientId, projectId, details)
   - Create document in creditTransactions/ collection
   - Include: type, amount, balanceBefore, balanceAfter, packId (if applicable)
   - Add timestamp and description
   - Set createdBy (system or userId)

6. purchaseExtraPack(clientId, paymentId, creditsAmount)
   - Default creditsAmount = 10
   - Check current unused extra credits
   - Throw error if would exceed 20 unused limit
   - Create new pack object with:
     * packId (unique)
     * credits: 10
     * purchaseDate: now
     * expiryDate: now + 30 days
     * creditsUsed: 0
     * creditsRemaining: 10
     * paymentId: reference
   - Add to client's extraCredits array
   - Log transaction
   - Return new pack

7. allocateMonthlyCredits(clientId)
   - Called on subscription renewal
   - Reset subscription.creditsUsed to 0
   - Set subscription.creditsRemaining to creditsPerMonth
   - Log allocation transaction
   - Return success

8. handleExpiredPacks()
   - Cloud Function (scheduled daily)
   - Query all clients
   - Check each client's extra packs
   - Remove expired packs (expiryDate < now)
   - Log expiry for any credits remaining
   - Update client document

Include comprehensive error handling and Firestore transaction support where needed.
```

---

## PROMPT 5: CLIENT DASHBOARD

### Prompt

```
Create the Client Dashboard for SanaaDeck:

DASHBOARD SECTIONS:

1. HEADER
   - Welcome message with business name
   - Current tier badge (Starter/Growth/Pro)
   - Quick stats: Total projects, Credits remaining, Active requests

2. CREDIT BALANCE CARD (PROMINENT)
   - Large display of total credits available
   - Breakdown: Subscription credits + Extra credits
   - Progress bar showing usage (creditsUsed / creditsPerMonth)
   - Monthly allocation amount
   - Expiring credits warning (if any extra packs expire in <7 days)
   - "Buy Extra Credits" button (if usage > 80%)

3. ACTIVE REQUESTS COUNTER
   - Show: "2 of 2 active requests" (based on tier limit)
   - Disable "New Request" button if at limit
   - List active project cards

4. NEW REQUEST BUTTON
   - Opens project creation modal
   - Disabled state if at active request limit
   - Tooltip explaining limit

5. PROJECT TABS
   - Active (in progress)
   - Pending Confirmation (awaiting credit approval)
   - Completed (approved & delivered)
   - All Projects

6. PROJECT CARDS
   - Project title and deliverable type
   - Status badge with color coding
   - Credits used (confirmed or estimated)
   - Assigned creative (if any) with avatar
   - Timeline (created date, deadline)
   - Quick actions: View, Request Revision, Approve

7. QUICK ACTIONS
   - Upgrade subscription (if frequently hitting limits)
   - Purchase extra credits
   - View billing history
   - Update brand assets

CREATE FILES:

1. /src/components/dashboard/ClientDashboard.jsx
   - Main dashboard layout
   - Fetch client data and credit balance
   - Real-time updates using Firestore listeners
   - Handle all dashboard sections

2. /src/components/credits/CreditBalanceCard.jsx
   - Display total credits with breakdown
   - Visual progress bar
   - Expiry warnings
   - "Buy Extra Credits" CTA

3. /src/components/credits/CreditEstimator.jsx
   - Deliverable type selector (dropdown)
   - Complexity selector (standard/complex/advanced)
   - Real-time credit estimate display
   - "Estimate time: X hours" (credits * 45 min)

4. /src/components/projects/ProjectCard.jsx
   - Compact card showing project details
   - Status-based styling
   - Click to view full project details
   - Quick action buttons

5. /src/components/projects/NewProjectModal.jsx
   - Multi-step form:
     * Step 1: Deliverable type selection (with credit estimates)
     * Step 2: Project details (title, description, brief)
     * Step 3: Reference files upload
     * Step 4: Review & confirm (shows credit deduction)
   - Estimate credits before confirmation
   - Show confirmation dialog with exact credit cost
   - Call reserveCredits() on confirmation
   - Create project in Firestore with status: 'confirmed'
   - Handle errors (insufficient credits)

6. /src/components/credits/BuyExtraCreditsModal.jsx
   - Show package: 10 credits for $250
   - Display expiry info (valid 30 days)
   - Payment method selection (M-Pesa or Pesapal)
   - Initiate payment flow
   - On success: call creditService.purchaseExtraPack()

REAL-TIME UPDATES:
Use Firestore onSnapshot listeners for:
- Client document (credit balance changes)
- Projects collection (status updates)
- Notifications collection (new notifications)

STYLING:
- Use Shadcn/ui components (Card, Button, Badge, Progress, Dialog, Tabs)
- TailwindCSS for layout and spacing
- Color code status badges:
  * pending_confirmation: yellow
  * confirmed: blue
  * in_progress: purple
  * ready_for_qc: orange
  * approved: green
  * revision_requested: red
```

---

## PROMPT 6: CREATIVE DASHBOARD

### Prompt

```
Create the Creative Dashboard for SanaaDeck:

DASHBOARD SECTIONS:

1. HEADER
   - Welcome message with creative name
   - Current tier badge (Junior/Mid/Senior)
   - Quick stats: Active projects, Credits this month, Rating

2. EARNINGS CARD (PROMINENT)
   - This month earnings (creditsCompleted * payoutRate)
   - Last month earnings
   - Lifetime total
   - Pending payout amount
   - Last payout date
   - "View Payment History" link

3. PERFORMANCE SCORE CARD
   - CPS Score (0-100) with colored gauge
   - Key metrics:
     * Average rating (target: ≥4.2/5) ⭐
     * On-time rate (target: ≥95%) 🕐
     * Revision rate (target: ≤35%) 🔄
     * Missed deadlines this month (limit: 2) ⚠️
   - Status badge (Excellent/Good/Needs Improvement/Warning)
   - Performance trend (arrow up/down/stable)

4. WORKLOAD TRACKER
   - Credits completed this month / Max credits per month (120)
   - Progress bar
   - Available capacity indicator
   - Warning if approaching max (>100 credits)

5. ASSIGNED PROJECTS
   - List of assigned projects
   - Sort by deadline (urgent first)
   - Show:
     * Project title
     * Client name
     * Deliverable type
     * Credit value
     * Deadline countdown
     * Status
   - Quick actions: Start, Upload, Submit for QC

6. PROJECT WORKSPACE
   - When clicked, open project details
   - Show full brief
   - Reference files gallery
   - Upload work-in-progress
   - Log credits used (time tracker)
   - Submit for QC button
   - Comment thread (Figma-style)

7. BONUS ELIGIBILITY INDICATORS
   - Show which bonuses are active:
     * 5-star bonus (+10%) - if avgRating ≥ 4.8
     * Fast-track bonus (+20%) - for 24hr completions
     * Volume bonus (+5%) - if ≥20 credits/month
     * Consistency bonus (+10%) - 3 months of 4.5+ rating
   - Explain how to earn each bonus

8. TEMPLATE CONTRIBUTIONS
   - Track monthly contributions (target: 2/month)
   - Upload template button
   - View contribution history

CREATE FILES:

1. /src/components/dashboard/CreativeDashboard.jsx
   - Main creative dashboard
   - Fetch creative data and performance metrics
   - Real-time project updates
   - Handle all dashboard sections

2. /src/components/creative/EarningsCard.jsx
   - Display earnings breakdown
   - Calculate this month: creditsCompleted * payoutRate
   - Show bonus multipliers
   - Payment history modal

3. /src/components/creative/PerformanceScoreCard.jsx
   - Display CPS score with gauge/chart
   - Show all performance metrics
   - Color code based on score:
     * 90-100: green (Excellent)
     * 70-89: blue (Good)
     * 50-69: yellow (Needs Improvement)
     * <50: red (Warning)
   - Tooltip explanations for each metric

4. /src/components/creative/WorkloadTracker.jsx
   - Progress bar for monthly credits
   - Warning at 80% capacity
   - Availability status toggle (Available/Busy/Unavailable)

5. /src/components/creative/ProjectWorkspace.jsx
   - Full project details view
   - Brief display (all fields)
   - Reference files gallery (with lightbox)
   - File uploader for deliverables
     * Drag-drop support
     * Google Drive link input
     * Version management (v1, v2, v3)
   - Credit logger
     * Input actual credits used
     * Justification text (if different from estimate)
   - Comments section
     * Pin-point comments on designs
     * Thread replies
     * @mentions
   - Submit to QC button
     * Confirms credit usage
     * Changes status to 'ready_for_qc'

6. /src/components/creative/BonusExplainer.jsx
   - Card or modal explaining each bonus
   - Current eligibility status
   - Progress toward each bonus
   - Tips to improve performance

REAL-TIME UPDATES:
- Creative document (performance updates)
- Assigned projects (new assignments, status changes)
- Earnings (payment completions)
```

---

## PROMPT 7: ADMIN DASHBOARD

### Prompt

```
Create the Admin Dashboard for SanaaDeck:

DASHBOARD SECTIONS:

1. PLATFORM KPIs (TOP ROW)
   - Monthly Recurring Revenue (MRR)
   - Annual Recurring Revenue (ARR)
   - Active Subscriptions (by tier)
   - Total Credits Issued vs Used (utilization %)
   - Gross Margin %
   - Active Projects count

2. REVENUE ANALYTICS
   - Revenue per credit (by tier)
   - Revenue trend chart (last 6 months)
   - Subscription breakdown (Starter/Growth/Pro counts)
   - Extra credit pack sales
   - Churn rate

3. CREDIT ANALYTICS
   - Credits issued this month
   - Credits consumed this month
   - Utilization rate (consumed/issued %)
   - Credits expiring soon (<7 days)
   - Average credits per project (by deliverable type)
   - Credit burn patterns (which deliverables consume most)

4. CLIENT MANAGEMENT TABLE
   - Searchable, sortable, filterable
   - Columns:
     * Business name
     * Tier
     * Subscription status
     * Credits remaining
     * Credits used this month
     * Lifetime value
     * Last active
     * Actions (View, Edit, Pause, Cancel)
   - Filters: Tier, Status, Country
   - Bulk actions: Export CSV, Send notification

5. CREATIVE MANAGEMENT TABLE
   - Columns:
     * Name
     * Specialty
     * Tier
     * CPS Score
     * Active projects
     * Credits this month
     * Utilization %
     * Status
     * Actions (View, Edit, Warn, Suspend)
   - Color code CPS scores
   - Filter by: Specialty, Tier, Performance status
   - Identify: Underperformers, Overworked

6. PROJECT OVERSIGHT
   - Projects by status (pie chart or bar chart)
   - Bottleneck alerts (projects stuck in status >48hrs)
   - Projects nearing deadline
   - QC queue (projects ready for review)
   - Overdue projects (red flag)
   - Average turnaround time

7. PERFORMANCE ALERTS
   - Creatives with CPS <70 (warning)
   - Clients hitting credit limits frequently (upgrade candidates)
   - Expired credit packs (lost value)
   - Failed payments (past due subscriptions)
   - High revision rates (quality issues)

8. PAYMENT MONITORING
   - Pending payments
   - Failed payment retries
   - Subscription renewals due (next 7 days)
   - Payment success rate

9. ADMIN ACTIONS
   - Assign projects manually
   - Adjust credit estimates
   - Refund credits
   - Issue warnings/bonuses to creatives
   - Pause/resume subscriptions
   - Generate reports (CSV export)

CREATE FILES:

1. /src/components/dashboard/AdminDashboard.jsx
   - Main admin dashboard layout
   - Fetch aggregated data
   - Real-time platform metrics

2. /src/components/admin/PlatformKPIs.jsx
   - Grid of KPI cards
   - Calculate MRR, ARR from subscriptions
   - Real-time updates

3. /src/components/admin/RevenueChart.jsx
   - Line or bar chart showing revenue trends
   - Use chart library (Recharts or Chart.js)
   - Monthly breakdown by tier

4. /src/components/admin/ClientManagementTable.jsx
   - Data table with all client records
   - Search by business name or email
   - Sort by any column
   - Filters for tier, status, country
   - Action buttons: View details, Edit, Pause subscription, Cancel
   - Bulk actions toolbar

5. /src/components/admin/CreativeManagementTable.jsx
   - Data table with all creative records
   - CPS score color coding
   - Utilization % indicator
   - Actions: View, Edit, Issue warning, Suspend
   - Filter by performance status

6. /src/components/admin/ProjectOversightPanel.jsx
   - Projects by status chart
   - Bottleneck alerts list
   - QC queue list (click to review)
   - Manual assignment tool

7. /src/components/admin/PerformanceAlerts.jsx
   - Alert cards or list
   - Grouped by severity (Critical/Warning/Info)
   - Click to view details and take action

8. /src/components/admin/CreditAdjustmentModal.jsx
   - Form to adjust credits for a project or client
   - Reason input (required)
   - Add or deduct credits
   - Log as 'admin_adjustment' transaction

9. /src/components/admin/ReportGenerator.jsx
   - Select report type:
     * Client revenue report
     * Creative payout report
     * Credit usage report
     * Project completion report
   - Date range selector
   - Generate CSV button
   - Download file

USE SHADCN/UI DATA TABLES:
- Implement proper pagination (50 rows per page)
- Column sorting
- Search/filter
- Responsive design
- Loading states
- Empty states

CHARTS:
Use Recharts library for all visualizations:
- Line charts for trends
- Pie charts for breakdowns
- Bar charts for comparisons
```

---

## PROMPT 8: M-PESA PAYMENT INTEGRATION

### Prompt

```
Create M-Pesa payment integration for SanaaDeck:

PAYMENT FLOWS:
1. Subscription payment (monthly renewal)
2. Extra credit pack purchase ($250 for 10 credits)
3. One-off bundle purchase (for non-subscribers)

CREATE CLOUD FUNCTION: /functions/payments/mpesa.js

REQUIREMENTS:
- Use Safaricom Daraja API v2
- STK Push for payment initiation
- Callback handling for payment confirmation
- Support sandbox and production modes

FUNCTIONS NEEDED:

1. initiateMpesaPayment (Callable Function)
   - Input: { clientId, amount, phoneNumber, reason }
   - Steps:
     * Get M-Pesa access token (OAuth)
     * Format phone number (remove leading 0, add 254)
     * Generate timestamp and password
     * Make STK Push request
     * Create payment record in Firestore (status: pending)
     * Return: { success, paymentId, checkoutRequestId }

2. mpesaCallback (HTTP Function)
   - Receives callback from Safaricom
   - Extracts ResultCode and other data
   - Updates payment record:
     * If ResultCode === 0: status = 'completed'
     * Else: status = 'failed'
   - If successful:
     * For subscription: Call handleSubscriptionPayment()
     * For extra_credits: Call handleExtraCreditsPayment()
   - Send notification to client
   - Return 200 OK

3. handleSubscriptionPayment(clientId, paymentId)
   - Extend subscription period by 30 days
   - Update currentPeriodStart, currentPeriodEnd, renewalDate
   - Reset credits: creditsUsed = 0, creditsRemaining = creditsPerMonth
   - Update subscription status to 'active'
   - Log credit allocation transaction

4. handleExtraCreditsPayment(clientId, paymentId)
   - Call creditService.purchaseExtraPack(clientId, paymentId, 10)
   - Creates new extra credit pack
   - Sets 30-day expiry
   - Logs transaction

5. sendPaymentNotification(clientId, status, amount, errorMessage)
   - Create notification in Firestore
   - Send email via SendGrid
   - SMS optional

ENVIRONMENT CONFIG:
- MPESA_CONSUMER_KEY
- MPESA_CONSUMER_SECRET
- MPESA_PASSKEY
- MPESA_SHORTCODE (174379 for production)
- MPESA_CALLBACK_URL (https://sanaadeck.com/api/mpesa-callback)
- MPESA_ENV (sandbox or production)

ERROR HANDLING:
- Retry logic for failed requests (up to 3 times)
- Log all errors to Firestore
- Send failure notifications
- Grace period for subscription payments (5 days)

FRONTEND COMPONENT: /src/components/payments/MpesaPayment.jsx
- Phone number input (validates Kenyan format)
- Amount display
- "Pay with M-Pesa" button
- Shows: "Payment initiated. Check your phone for STK prompt"
- Polling for payment status (check Firestore every 5 seconds)
- Success/failure feedback
- Retry option if failed

Include:
- Complete Cloud Function code
- Frontend component
- Error handling
- Testing instructions for sandbox
```

---

## PROMPT 9: PERFORMANCE TRACKING SYSTEM

### Prompt

```
Create the Creative Performance Score (CPS) system for SanaaDeck:

CPS CALCULATION:
- Score range: 0-100
- Components:
  * Client rating (40 points): (avgRating / 5) * 40
  * On-time delivery (30 points): (onTimeRate / 100) * 30
  * Revision rate (20 points): (100 - revisionRate * 2) / 100 * 20
  * Missed deadlines (10 points): (100 - missedDeadlines * 20) / 100 * 10

PERFORMANCE TARGETS:
- Rating ≥ 4.2/5
- On-time rate ≥ 95%
- Revision rate ≤ 35%
- Missed deadlines ≤ 2/month

STATUS DETERMINATION:
- 90-100: Excellent
- 70-89: Good
- 50-69: Needs Improvement
- 30-49: Warning
- <30: Probation

CREATE CLOUD FUNCTION: /functions/performance/cpsCalculator.js

SCHEDULED FUNCTION (runs monthly on 1st at 2 AM EAT):
calculateMonthlyCPS()
- Query all creatives
- For each creative:
  * Get last month's completed projects
  * Calculate metrics:
    - Total projects
    - Total credits
    - Average rating
    - On-time deliveries (actualTurnaround <= estimatedTurnaround)
    - Total revisions
    - Missed deadlines (deliveredAt > deadline)
  * Calculate CPS score
  * Determine status
  * Check bonus eligibility
  * Check tier promotion (3 months of CPS ≥90)
  * Create performanceReview document
  * Update creative performance object
  * Issue warnings if needed (status: warning or probation)
  * Promote tier if eligible

HELPER FUNCTIONS:

1. calculateCPSScore(metrics)
   - Input: { averageRating, onTimeRate, revisionRate, missedDeadlines }
   - Apply formula
   - Return: cpsScore (0-100)

2. checkTierPromotion(creativeId, currentScore)
   - Get last 3 performance reviews
   - Check if all have CPS ≥90
   - Return boolean

3. generateReviewNotes(status, metrics)
   - Create human-readable notes
   - Highlight problem areas
   - Suggest improvements

4. updateCreativeBonuses(creativeId, bonusEligible, creditsCompleted)
   - fiveStarBonus: avgRating ≥ 4.8
   - volumeBonus: creditsCompleted ≥ 20
   - Update creative document

5. issuePerformanceWarning(creativeId, status, score)
   - Create warning in creative.warnings array
   - Set accountStatus to 'probation' if score <30
   - Send notification to creative
   - Email alert

6. promoteCreativeTier(creativeId)
   - Junior → Mid ($9/credit)
   - Mid → Senior ($11/credit)
   - Update tier and payoutRate
   - Send congratulations notification

FRONTEND COMPONENT: /src/components/creative/PerformanceReview.jsx
- Display current month's performance
- Show CPS score with gauge chart
- Break down each component with progress bars
- Compare to targets (green if meeting, red if not)
- Show trend (compared to last month)
- List active bonuses
- Display warnings/probation status (if any)
- Link to full performance history

ADMIN VIEW: /src/components/admin/CreativePerformancePanel.jsx
- List all creatives with CPS scores
- Filter by status (Excellent/Good/Warning/Probation)
- Click to view detailed review
- Manual override option (with justification)
```

---

## PROMPT 10: FILE UPLOAD & MANAGEMENT

### Prompt

```
Create file upload and management system for SanaaDeck:

UPLOAD SCENARIOS:
1. Client uploads reference files (project brief)
2. Creative uploads deliverables (work files)
3. Client uploads brand assets (logo, fonts)
4. Creative uploads template library items

FILE HANDLING:
- Firebase Storage for direct uploads (≤10MB)
- Google Drive integration for large files (>10MB)
- Support: PNG, JPG, PDF, AI, PSD, Figma links, MP4

CREATE FILES:

1. /src/components/common/FileUploader.jsx
   - Drag-and-drop zone
   - File browser button
   - Google Drive link input (alternative)
   - File type validation
   - Size validation
   - Upload progress bar
   - Preview thumbnails
   - Remove file option
   - Props:
     * maxSize (default: 10MB)
     * acceptedTypes (array)
     * onUpload (callback with file URL)
     * multiple (boolean)
     * storage Path (where to upload in Firebase Storage)

2. /src/services/fileService.js
   Functions:
   - uploadToStorage(file, path)
     * Upload to Firebase Storage
     * Generate download URL
     * Return: { url, fileName, size, type }
   
   - handleGoogleDriveLink(link)
     * Validate Google Drive link format
     * Extract file ID
     * Store link in Firestore
     * Return: { url, type: 'google_drive' }
   
   - deleteFile(fileUrl)
     * Delete from Firebase Storage
     * Handle errors gracefully
   
   - getFileMetadata(fileUrl)
     * Get file size, type, upload date
     * Return metadata object

3. /src/components/projects/FileGallery.jsx
   - Grid display of uploaded files
   - Thumbnail previews (for images)
   - File name and size
   - Download button
   - Delete button (conditional - owner only)
   - Lightbox view for images
   - Support for Google Drive links (external icon)

4. /src/components/projects/DeliverableUploader.jsx
   - Specialized for creative uploads
   - Version management (v1, v2, v3...)
   - Mark as "latest version"
   - Add version notes
   - Upload multiple files at once
   - Organize by revision round

FIREBASE STORAGE STRUCTURE:
/clients/{clientId}/projects/{projectId}/
  ├── brief/ (reference files)
  ├── wip/ (work-in-progress)
  ├── revisions/ (revision versions)
  └── final/ (approved deliverables)

/brand-assets/{clientId}/
  ├── logos/
  ├── fonts/
  └── guidelines/

/portfolios/{creativeId}/
  └── {portfolioItemId}/

/templates/{templateId}/

STORAGE RULES:
- Clients can upload to their own folders
- Creatives can upload to assigned projects
- Admin can access all folders
- Max file size: 50MB (enforced in rules)

Include:
- Complete FileUploader component with drag-drop
- File validation logic
- Upload progress tracking
- Error handling (network issues, size limits)
- Integration with project creation/update
```

---

## PROMPT 11: NOTIFICATION SYSTEM

### Prompt

```
Create notification system for SanaaDeck:

NOTIFICATION TYPES:
- project_update (status changes)
- payment_reminder (renewal due)
- credit_low (credits <20% remaining)
- performance_alert (CPS warnings)
- system (platform announcements)

CHANNELS:
- In-app (always)
- Email (SendGrid)
- SMS (Africa's Talking) - optional

CREATE FILES:

1. /src/components/notifications/NotificationCenter.jsx
   - Dropdown bell icon in header
   - Badge showing unread count
   - List of recent notifications (last 30 days)
   - Mark as read on click
   - "Mark all as read" button
   - Filter by type
   - Real-time updates (Firestore listener)

2. /src/services/notificationService.js
   Functions:
   - createNotification(userId, type, title, message, relatedIds)
     * Create document in notifications/ collection
     * Set channels (in-app always true)
     * Trigger email/SMS if configured
   
   - markAsRead(notificationId)
     * Update read: true, readAt: now
   
   - markAllAsRead(userId)
     * Batch update all unread notifications
   
   - getUnreadCount(userId)
     * Count unread notifications
     * Used for badge

3. CLOUD FUNCTION: /functions/notifications/sendNotifications.js
   - Firestore trigger on notifications/ create
   - If channels.email === true:
     * Send via SendGrid
     * Update emailSent: true, emailSentAt: now
   - If channels.sms === true:
     * Send via Africa's Talking
     * Update smsSent: true, smsSentAt: now

4. /src/hooks/useNotifications.js
   - Custom hook for notifications
   - Returns: { notifications, unreadCount, markAsRead, markAllAsRead }
   - Real-time listener on notifications collection
   - Filter by userId
   - Sort by createdAt DESC

NOTIFICATION TEMPLATES:

Project Update:
- Title: "Project Update: {projectTitle}"
- Message: "Your project '{projectTitle}' status changed to {newStatus}"
- Link to project

Payment Reminder:
- Title: "Subscription Renewal Due"
- Message: "Your {tier} subscription renews in {days} days. Amount: {amount}"
- Link to billing

Credit Low:
- Title: "Low Credit Balance"
- Message: "You have {creditsRemaining} credits left ({percentage}% of monthly allocation)"
- CTA: "Buy Extra Credits"

Performance Alert:
- Title: "Performance Review Alert"
- Message: "Your CPS score is {score}. {actionRequired}"
- Link to performance page

REAL-TIME BEHAVIOR:
- Use Firestore onSnapshot in NotificationCenter
- Auto-update badge count
- Play sound/show toast for new notifications (optional)
- Desktop notifications (if permission granted)

SENDGRID INTEGRATION:
- API key in Cloud Functions config
- HTML email templates
- Track open/click rates
- Unsubscribe link required

AFRICA'S TALKING SMS:
- API key in Cloud Functions config
- SMS templates (160 chars max)
- Cost tracking

Include:
- Complete NotificationCenter component
- Real-time listener setup
- Email/SMS sending logic
- Notification preferences UI (allow users to toggle channels)
```

---

## PROMPT 12: FINAL INTEGRATION & TESTING

### Prompt

```
Integrate all components and prepare SanaaDeck for production:

TASKS:

1. ROUTE CONFIGURATION
   - Define all routes in App.jsx
   - Protected routes with role checking
   - 404 page
   - Routes:
     * / (redirect to /dashboard or /login based on auth)
     * /login
     * /signup
     * /dashboard (role-based: client, creative, or admin dashboard)
     * /projects
     * /projects/:projectId
     * /credits
     * /billing
     * /profile
     * /admin (admin only)
     * /admin/clients
     * /admin/creatives
     * /admin/projects

2. STATE MANAGEMENT
   - Set up Zustand stores:
     * authStore (user, profile, login/logout)
     * creditsStore (balance, transactions)
     * projectsStore (active projects)
   - Persist auth state to localStorage
   - Clear stores on logout

3. ERROR HANDLING
   - Global error boundary component
   - Toast notifications for errors
   - Retry logic for failed API calls
   - Fallback UI for broken components

4. LOADING STATES
   - Skeleton loaders for data fetching
   - Spinner for button actions
   - Progress bars for file uploads
   - Suspense for lazy-loaded routes

5. RESPONSIVE DESIGN
   - Mobile-first approach
   - Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
   - Hamburger menu for mobile
   - Touch-friendly buttons
   - Responsive tables (horizontal scroll on mobile)

6. PERFORMANCE OPTIMIZATION
   - Code splitting (React.lazy)
   - Image optimization (lazy loading, WebP format)
   - Debounce search inputs
   - Virtualize long lists
   - Memoize expensive calculations

7. SECURITY
   - Validate all inputs (Zod or Yup)
   - Sanitize user content
   - CSRF protection
   - Rate limiting (via Cloud Functions)
   - Firestore security rules enforcement

8. TESTING
   - Unit tests for services (Jest)
   - Integration tests for key flows:
     * User signup → dashboard
     * Project creation → credit deduction
     * Payment → credit allocation
   - E2E tests (Cypress or Playwright)

9. DEPLOYMENT PREPARATION
   - Environment variables check
   - Build optimization
   - Firebase deployment script
   - Smoke tests on staging
   - Rollback plan

10. DOCUMENTATION
    - README with setup instructions
    - API documentation
    - Component library (Storybook optional)
    - Deployment guide

CREATE:
- Complete App.jsx with all routes
- Global error boundary
- Loading component library
- Test suite setup
- Deployment script (deploy.sh)
- Production checklist

FINAL CHECKS:
✅ All forms have validation
✅ All API calls have error handling
✅ All images have alt text (accessibility)
✅ No console errors in production build
✅ Lighthouse score >90 (performance, accessibility)
✅ Works on Chrome, Firefox, Safari
✅ Works on iOS and Android mobile browsers
✅ Firebase security rules tested
✅ Payment flows tested end-to-end (sandbox)
✅ Real-time updates working
✅ Notifications sending correctly
```

---

## SUMMARY

This AI Development Prompts document provides **12 comprehensive prompts** to build SanaaDeck using no-code AI tools.

**Prompt Sequence:**
1. Project initialization
2. Firebase configuration
3. Authentication system
4. Credit tracking engine ⭐
5. Client dashboard
6. Creative dashboard
7. Admin dashboard
8. M-Pesa payment integration
9. Performance tracking system
10. File upload & management
11. Notification system
12. Final integration & testing

**How to Use:**
- Copy each prompt in order
- Paste into Cursor AI, Bolt.new, or Claude Code
- Review and test generated code
- Deploy incrementally to Firebase

**Tip:** Always include the context section from Prompt 1 with subsequent prompts for better results.

---

**Document Version:** 2.0 (Revised)  
**Last Updated:** February 2026  
**Compatible With:** Cursor AI, Bolt.new, Claude Code, GitHub Copilot
