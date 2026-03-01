# SanaaDeck - Quick Start Implementation Roadmap (Revised)
## 14-Week Build Timeline for Credit-Based Platform

---

## ROADMAP OVERVIEW

This document provides a **week-by-week implementation plan** for building SanaaDeck from scratch to launch-ready MVP.

**Total Timeline:** 14 weeks (3.5 months)  
**Development Approach:** No-code AI tools (Cursor, Bolt, Claude Code)  
**Deployment Target:** Firebase (Production-ready)

**Changes from Original:**
- Credit system implementation prioritized
- Dashboard-only workflow (no WhatsApp)
- Performance tracking system
- Extra credit pack management
- Removed AI brief enhancement
- 6-month commitment policy

---

## PREREQUISITES

Before starting, ensure you have:

✅ **Accounts Created:**
- Firebase project (Blaze plan for Cloud Functions)
- M-Pesa Daraja API (Safaricom developer account)
- Pesapal account (regional payments)
- SendGrid account (email notifications)
- Africa's Talking account (SMS - optional)
- Domain registered (sanaadeck.com)

✅ **Tools Installed:**
- Node.js 18+ and npm
- Firebase CLI (`npm install -g firebase-tools`)
- Git
- VS Code or Cursor AI
- Chrome (for testing)

✅ **Knowledge:**
- Basic React concepts
- Firebase basics (Firestore, Auth)
- Command line usage
- Git/GitHub

---

## PHASE 1: FOUNDATION (WEEKS 1-2)

### Week 1: Project Setup & Configuration

#### Day 1: Firebase Setup
**Goal:** Configure Firebase project and local environment

**Tasks:**
1. Create Firebase project at console.firebase.google.com
2. Enable services:
   - Authentication (Email/Password)
   - Cloud Firestore
   - Cloud Storage
   - Cloud Functions
   - Firebase Hosting
3. Set up billing (Blaze plan required for Functions)
4. Note down Firebase config credentials
5. Install Firebase CLI: `npm install -g firebase-tools`
6. Login: `firebase login`

**Deliverable:** Firebase project ready

---

#### Day 2-3: React Project Initialization
**Goal:** Set up React app with all dependencies

**AI Prompt to Use:** Prompt 1 (Project Initialization) from AI Development Prompts document

**Tasks:**
1. Create React + Vite project
2. Install dependencies:
   ```bash
   npm create vite@latest sanaadeck -- --template react
   cd sanaadeck
   npm install
   ```
3. Install TailwindCSS and Shadcn/ui
4. Install Firebase SDK: `npm install firebase`
5. Install other dependencies: `react-router-dom react-query zustand date-fns`
6. Configure TailwindCSS
7. Set up project structure (folders: components, services, hooks, stores, pages)
8. Create .env.local with Firebase config
9. Test development server: `npm run dev`

**Deliverable:** React app running with basic structure

---

#### Day 4-5: Firebase Configuration
**Goal:** Connect React app to Firebase

**AI Prompt to Use:** Prompt 2 (Firebase Configuration)

**Tasks:**
1. Create `/src/services/firebase.js`
2. Initialize Firebase app
3. Export auth, db, storage, functions instances
4. Test connection (simple Firestore write/read)
5. Set up .env.example file
6. Initialize Firebase in project: `firebase init`
   - Select: Firestore, Functions, Hosting, Storage
7. Configure `firebase.json` and `firestore.rules`

**Deliverable:** Firebase fully integrated

---

#### Weekend: Firestore Database Schema
**Goal:** Set up all Firestore collections and indexes

**Tasks:**
1. Create collections manually in Firebase Console:
   - users/
   - clients/
   - creatives/
   - projects/
   - creditTransactions/
   - payments/
   - subscriptions/
   - notifications/
   - templateLibrary/
   - performanceReviews/

2. Add sample documents for testing

3. Create composite indexes in Firestore:
   - clients: `subscription.tier` + `subscription.status`
   - projects: `clientId` + `status`
   - projects: `creativeId` + `status`
   - creditTransactions: `clientId` + `createdAt`

4. Document schema in notion/spreadsheet for reference

**Deliverable:** Database structure ready

---

### Week 2: Authentication System

#### Day 1-2: Auth Service
**Goal:** Build complete authentication service

**AI Prompt to Use:** Prompt 3 (Authentication System)

**Tasks:**
1. Create `/src/services/authService.js`
2. Implement functions:
   - `signUp()`
   - `signIn()`
   - `signOut()`
   - `createClientProfile()`
   - `createCreativeProfile()`
   - `getUserProfile()`
3. Create `/src/hooks/useAuth.js` custom hook
4. Create `/src/stores/authStore.js` Zustand store
5. Test auth flow:
   - Create test user (client role)
   - Verify user document created in users/
   - Verify client profile created in clients/
   - Test login and profile fetch

**Deliverable:** Working authentication service

---

#### Day 3-4: Auth UI Components
**Goal:** Build login and signup forms

**Tasks:**
1. Create `/src/components/auth/LoginForm.jsx`
   - Email and password inputs
   - Submit handler
   - Error display
   - "Forgot password" link
   
2. Create `/src/components/auth/SignupForm.jsx`
   - Multi-step form:
     * Step 1: Email, password, role selection
     * Step 2: Profile info (conditional based on role)
   - Validation (email format, password strength)
   - Terms & conditions checkbox
   
3. Create `/src/pages/Login.jsx` and `/src/pages/Signup.jsx`
4. Style with TailwindCSS
5. Add logo and branding

**Deliverable:** Login and signup pages working

---

#### Day 5: Protected Routes
**Goal:** Implement role-based routing

**Tasks:**
1. Create `/src/components/ProtectedRoute.jsx`
   - Check authentication state
   - Redirect to /login if not authenticated
   - Support `allowedRoles` prop for role-based access
2. Set up routes in App.jsx:
   ```javascript
   / → redirect based on role
   /login → LoginPage
   /signup → SignupPage
   /dashboard → ProtectedRoute → role-based dashboard
   /admin → ProtectedRoute (admin only)
   ```
3. Test route protection
4. Add loading state while checking auth

**Deliverable:** Protected routing working

---

#### Weekend: Testing & Bug Fixes
**Goal:** Ensure auth system is solid

**Test Scenarios:**
- ✅ Sign up as client → creates user + client profile
- ✅ Sign up as creative → creates user + creative profile
- ✅ Login with correct credentials → redirects to dashboard
- ✅ Login with wrong credentials → shows error
- ✅ Logout → redirects to login
- ✅ Try to access /dashboard without auth → redirects to /login
- ✅ Try to access /admin as client → access denied

**Bug Fixes:**
- Fix any auth errors
- Improve error messages
- Add loading spinners

**Deliverable:** Stable authentication system

---

## PHASE 2: CORE FEATURES (WEEKS 3-6)

### Week 3: Credit Tracking Engine

#### Day 1-3: Credit Service Implementation
**Goal:** Build the core credit tracking system

**AI Prompt to Use:** Prompt 4 (Credit Tracking Engine)

**Tasks:**
1. Create `/src/services/creditService.js`
2. Implement all credit functions:
   - `getCreditBalance()` ⭐
   - `estimateCredits()`
   - `reserveCredits()` ⭐
   - `deductFromExtraPacks()`
   - `logCreditTransaction()`
   - `purchaseExtraPack()`
   - `allocateMonthlyCredits()`
   
3. Test each function thoroughly:
   - Create test client with 15 starter credits
   - Estimate credits for various deliverables
   - Reserve 5 credits → verify deduction
   - Check balance → should show 10 remaining
   - Purchase extra pack → verify new pack added
   - Reserve 20 credits → should use subscription + extra pack

**Deliverable:** Working credit service

---

#### Day 4-5: Credit UI Components
**Goal:** Build credit display and management UI

**Tasks:**
1. Create `/src/components/credits/CreditBalanceCard.jsx`
   - Large credit balance display
   - Breakdown: subscription + extra
   - Progress bar (used/total)
   - Expiry warnings
   
2. Create `/src/components/credits/CreditEstimator.jsx`
   - Deliverable type dropdown
   - Complexity selector
   - Real-time estimate
   - Time estimate (credits * 45 min)
   
3. Create `/src/components/credits/CreditHistoryTable.jsx`
   - List all credit transactions
   - Filter by type
   - Sort by date
   - Show balance after each transaction

4. Test in dev environment

**Deliverable:** Credit UI components ready

---

#### Weekend: Credit System Integration Testing
**Goal:** Comprehensive credit flow testing

**Test Scenarios:**
- ✅ Client starts with correct credit allocation based on tier
- ✅ Credit estimation shows correct amounts
- ✅ Project confirmation deducts credits correctly
- ✅ Extra pack purchase adds credits with expiry
- ✅ FIFO deduction from extra packs works
- ✅ Cannot purchase if would exceed 20 stacked credits
- ✅ Credit history shows all transactions
- ✅ Balance updates in real-time

**Deliverable:** Battle-tested credit system

---

### Week 4: Client Dashboard

#### Day 1-2: Dashboard Layout
**Goal:** Build client dashboard structure

**AI Prompt to Use:** Prompt 5 (Client Dashboard)

**Tasks:**
1. Create `/src/components/dashboard/ClientDashboard.jsx`
2. Layout sections:
   - Header with welcome + stats
   - Credit balance card (prominent)
   - Active requests counter
   - Project tabs (Active, Pending, Completed)
   - Project cards grid
3. Fetch client data from Firestore
4. Set up real-time listeners for:
   - Client document (credit updates)
   - Projects collection (new projects, status changes)

**Deliverable:** Dashboard skeleton

---

#### Day 3-4: Project Creation Flow
**Goal:** Build new project request flow with credit confirmation

**Tasks:**
1. Create `/src/components/projects/NewProjectModal.jsx`
2. Multi-step form:
   - **Step 1:** Deliverable type selection (shows credit estimates)
   - **Step 2:** Project details (title, description, brief fields)
   - **Step 3:** Reference files upload
   - **Step 4:** Review & confirm (shows exact credit cost)
3. Before confirmation:
   - Call `creditService.estimateCredits()`
   - Display estimate prominently
   - Show confirmation dialog: "This will use X credits. Confirm?"
4. On confirmation:
   - Call `creditService.reserveCredits()` ⭐
   - Create project document in Firestore (status: 'confirmed')
   - Show success message
   - Redirect to project page
5. Handle insufficient credits:
   - Show error: "Insufficient credits"
   - Offer: "Buy Extra Credits" or "Upgrade Subscription"

**Deliverable:** Project creation with credit deduction working

---

#### Day 5: Project Cards & Details
**Goal:** Display projects and details

**Tasks:**
1. Create `/src/components/projects/ProjectCard.jsx`
   - Compact card design
   - Show: title, type, status, credits, deadline
   - Click to expand/navigate
   
2. Create `/src/components/projects/ProjectDetails.jsx`
   - Full project view
   - Brief display
   - Reference files gallery
   - Deliverables section
   - Comment thread
   - Actions: Request Revision, Approve, Download
   
3. Implement project status color coding
4. Real-time project updates (onSnapshot)

**Deliverable:** Full project display

---

#### Weekend: Client Dashboard Polish
**Goal:** Refine UI and add missing pieces

**Tasks:**
- Add empty states ("No projects yet")
- Add loading skeletons
- Improve responsive design (mobile)
- Add tooltips and help text
- Test all user flows
- Fix UI bugs

**Deliverable:** Polished client dashboard

---

### Week 5: Creative Dashboard

#### Day 1-2: Creative Dashboard Layout
**Goal:** Build creative dashboard

**AI Prompt to Use:** Prompt 6 (Creative Dashboard)

**Tasks:**
1. Create `/src/components/dashboard/CreativeDashboard.jsx`
2. Sections:
   - Earnings card ⭐
   - Performance score card (CPS)
   - Workload tracker
   - Assigned projects list
3. Fetch creative data
4. Calculate earnings: `creditsCompleted * payoutRate`

**Deliverable:** Creative dashboard skeleton

---

#### Day 3-4: Project Workspace
**Goal:** Build creative's project workspace

**Tasks:**
1. Create `/src/components/creative/ProjectWorkspace.jsx`
2. Features:
   - Full brief display
   - Reference files gallery (with lightbox)
   - File uploader for deliverables
   - Credit logger (input actual credits used)
   - Submit to QC button
   - Comment thread
3. Implement file upload flow:
   - Upload to Firebase Storage
   - Or save Google Drive link
   - Create deliverable record in project
4. Credit logging:
   - Input field: "Credits used"
   - Justification text (if different from estimate)
   - Update project: `actualCreditsUsed`

**Deliverable:** Working project workspace

---

#### Day 5: Performance Display
**Goal:** Show CPS score and metrics

**Tasks:**
1. Create `/src/components/creative/PerformanceScoreCard.jsx`
2. Display (mock data for now - real calculation in Week 9):
   - CPS score (gauge chart)
   - Rating (stars)
   - On-time rate (%)
   - Revision rate (%)
   - Missed deadlines count
3. Color code based on score:
   - 90-100: green (Excellent)
   - 70-89: blue (Good)
   - 50-69: yellow (Needs Improvement)
   - <50: red (Warning)
4. Show bonus eligibility indicators

**Deliverable:** Performance display (mock data)

---

#### Weekend: Creative Dashboard Testing
**Goal:** Test creative workflows

**Test Scenarios:**
- ✅ Creative sees assigned projects
- ✅ Can open project workspace
- ✅ Can upload deliverables
- ✅ Can log credits used
- ✅ Can submit for QC
- ✅ Earnings calculate correctly
- ✅ Performance metrics display

**Deliverable:** Tested creative dashboard

---

### Week 6: Admin Dashboard

#### Day 1-3: Admin Dashboard Core
**Goal:** Build admin oversight tools

**AI Prompt to Use:** Prompt 7 (Admin Dashboard)

**Tasks:**
1. Create `/src/components/dashboard/AdminDashboard.jsx`
2. Implement sections:
   - Platform KPIs (MRR, ARR, active subscriptions)
   - Revenue analytics (chart)
   - Credit analytics (utilization %)
   - Client management table
   - Creative management table
3. Calculate metrics:
   - MRR = Sum of all active subscription prices
   - ARR = MRR * 12
   - Utilization = Credits consumed / Credits issued
4. Use Shadcn/ui data tables
5. Add search and filter functionality

**Deliverable:** Admin dashboard with tables

---

#### Day 4-5: Admin Actions
**Goal:** Add admin control features

**Tasks:**
1. Create `/src/components/admin/ProjectAssignmentTool.jsx`
   - Manually assign projects to creatives
   - Override automatic assignment
   
2. Create `/src/components/admin/CreditAdjustmentModal.jsx`
   - Add or deduct credits for a client
   - Reason input (required for audit)
   - Logs as 'admin_adjustment' transaction
   
3. Create `/src/components/admin/PerformanceAlerts.jsx`
   - List creatives with CPS <70
   - List clients hitting credit limits frequently
   - Expired credit packs (lost value alert)
   
4. Implement actions in tables:
   - View client/creative details
   - Edit profiles
   - Pause/resume subscriptions
   - Issue warnings

**Deliverable:** Admin tools functional

---

#### Weekend: Admin Dashboard Refinement
**Goal:** Polish and optimize

**Tasks:**
- Add data visualization (charts for revenue trends)
- Implement export to CSV functionality
- Add bulk actions
- Optimize table performance (pagination, virtual scrolling)
- Test all admin actions

**Deliverable:** Production-ready admin dashboard

---

## PHASE 3: PAYMENTS & AUTOMATION (WEEKS 7-10)

### Week 7: M-Pesa Integration

#### Day 1-2: M-Pesa Cloud Function
**Goal:** Implement M-Pesa STK Push

**AI Prompt to Use:** Prompt 8 (M-Pesa Payment Integration)

**Tasks:**
1. Set up Cloud Functions:
   ```bash
   cd functions
   npm install axios
   ```
2. Create `/functions/payments/mpesa.js`
3. Implement functions:
   - `initiateMpesaPayment` (callable)
   - `mpesaCallback` (HTTP)
   - `handleSubscriptionPayment`
   - `handleExtraCreditsPayment`
4. Configure Firebase Functions with M-Pesa credentials:
   ```bash
   firebase functions:config:set \
     mpesa.consumer_key="YOUR_KEY" \
     mpesa.consumer_secret="YOUR_SECRET" \
     mpesa.passkey="YOUR_PASSKEY"
   ```
5. Deploy functions:
   ```bash
   firebase deploy --only functions
   ```

**Deliverable:** M-Pesa functions deployed

---

#### Day 3-4: M-Pesa Frontend
**Goal:** Build payment UI

**Tasks:**
1. Create `/src/components/payments/MpesaPayment.jsx`
2. Features:
   - Phone number input (Kenyan format validation)
   - Amount display
   - "Pay with M-Pesa" button
   - Payment status polling (check Firestore every 5s)
   - Success/failure feedback
   - Retry option
3. Integrate into:
   - Subscription renewal flow
   - Extra credit pack purchase
4. Test in M-Pesa sandbox mode

**Deliverable:** Working M-Pesa payments

---

#### Day 5: Pesapal Integration
**Goal:** Add card payment option

**Tasks:**
1. Create `/functions/payments/pesapal.js`
2. Implement Pesapal order submission
3. Implement IPN callback handling
4. Create `/src/components/payments/PesapalPayment.jsx`
5. Test with Pesapal sandbox

**Deliverable:** Multi-payment support (M-Pesa + Pesapal)

---

#### Weekend: Payment Testing
**Goal:** Thorough payment flow testing

**Test Scenarios (Sandbox):**
- ✅ M-Pesa STK push received on phone
- ✅ Successful payment → subscription renewed
- ✅ Failed payment → error message shown
- ✅ Extra credit pack purchase → credits added
- ✅ Payment record created in Firestore
- ✅ Notification sent to client
- ✅ Pesapal card payment works

**Deliverable:** Reliable payment system

---

### Week 8: Subscription Management

#### Day 1-2: Subscription Renewal Automation
**Goal:** Automate monthly renewals

**Tasks:**
1. Create Cloud Function: `/functions/subscriptions/renewalScheduler.js`
2. Scheduled function (runs daily at midnight EAT):
   ```javascript
   exports.checkRenewals = functions.pubsub
     .schedule('0 0 * * *')
     .timeZone('Africa/Nairobi')
     .onRun(async () => {
       // Query subscriptions with renewalDate = today
       // Initiate payment for each
     });
   ```
3. Logic:
   - Find subscriptions renewing today
   - Initiate M-Pesa payment
   - If payment succeeds:
     * Extend subscription period
     * Allocate monthly credits
     * Update renewalDate
   - If payment fails:
     * Set status to 'past_due'
     * Send reminder notification
     * Retry in 24hrs (up to 3 times)
     * After 3 failures: Pause subscription (grace period: 5 days)

**Deliverable:** Automated renewal system

---

#### Day 3-4: Extra Credit Pack Expiry Handling
**Goal:** Handle expired credit packs

**Tasks:**
1. Create Cloud Function: `/functions/credits/expiryHandler.js`
2. Scheduled function (runs daily):
   ```javascript
   exports.handleExpiredPacks = functions.pubsub
     .schedule('0 1 * * *')
     .timeZone('Africa/Nairobi')
     .onRun(async () => {
       // Query all clients
       // Check extraCredits array
       // Remove expired packs
       // Log expiry transactions
     });
   ```
3. Logic:
   - For each client with extra packs:
     * Check expiryDate < now
     * If expired and creditsRemaining > 0:
       - Log transaction (type: 'expiry')
       - Send notification (lost credits alert)
       - Remove pack from array
4. Deploy and test (set test pack with expiry = now + 1 minute)

**Deliverable:** Automatic expiry handling

---

#### Day 5: Billing History & Invoices
**Goal:** Build billing page

**Tasks:**
1. Create `/src/pages/Billing.jsx`
2. Sections:
   - Current subscription details
   - Payment method
   - Billing history table (all payments)
   - Download invoice button (generates PDF)
3. Invoice generation:
   - Use library like `jsPDF` or `react-pdf`
   - Include: SanaaDeck logo, client details, amount, date, payment method
   - Save to Firebase Storage
   - Return download link

**Deliverable:** Billing management page

---

#### Weekend: Subscription Testing
**Goal:** Test all subscription scenarios

**Test Scenarios:**
- ✅ Subscription renews automatically on due date
- ✅ Failed payment triggers retry logic
- ✅ After 3 failed attempts, subscription paused
- ✅ Expired credit packs removed correctly
- ✅ Client receives notifications for all events
- ✅ Billing history shows all transactions
- ✅ Invoice downloads successfully

**Deliverable:** Robust subscription management

---

### Week 9: Performance Tracking System

#### Day 1-3: CPS Calculation Function
**Goal:** Implement Creative Performance Score calculation

**AI Prompt to Use:** Prompt 9 (Performance Tracking System)

**Tasks:**
1. Create `/functions/performance/cpsCalculator.js`
2. Implement `calculateMonthlyCPS()` scheduled function:
   - Runs on 1st of each month at 2 AM EAT
   - For each creative:
     * Query last month's completed projects
     * Calculate: avgRating, onTimeRate, revisionRate, missedDeadlines
     * Calculate CPS score (formula from doc)
     * Determine status (Excellent/Good/Warning/Probation)
     * Create performanceReview document
     * Update creative performance object
     * Issue warnings if needed
     * Check tier promotion eligibility
3. Deploy function
4. Test with mock data (manually trigger function)

**Deliverable:** Working CPS calculator

---

#### Day 4-5: Performance UI Updates
**Goal:** Connect real CPS data to UI

**Tasks:**
1. Update `/src/components/creative/PerformanceScoreCard.jsx`
   - Fetch real performance data from creatives/ document
   - Display actual CPS score (not mock)
   - Show trend (compared to last month)
2. Create `/src/components/creative/PerformanceHistory.jsx`
   - List past performance reviews
   - Chart showing CPS trend over time
3. Update admin dashboard:
   - Show real CPS scores in creative table
   - Add filter by performance status
4. Test with real projects:
   - Complete test projects
   - Run CPS calculation manually
   - Verify scores update in UI

**Deliverable:** Live performance tracking

---

#### Weekend: Performance System Testing
**Goal:** Validate CPS accuracy

**Test Scenarios:**
- ✅ Complete 5 projects with 5-star ratings → CPS = ~100
- ✅ Complete projects late → on-time rate decreases, CPS drops
- ✅ High revision requests → revision rate increases, CPS drops
- ✅ 3 months of CPS ≥90 → tier promotion triggered
- ✅ CPS <50 → warning issued, notification sent
- ✅ Performance history displays correctly
- ✅ Admin can see all creative performance

**Deliverable:** Accurate performance system

---

### Week 10: File Management System

#### Day 1-3: File Upload Components
**Goal:** Robust file upload functionality

**AI Prompt to Use:** Prompt 10 (File Upload & Management)

**Tasks:**
1. Create `/src/components/common/FileUploader.jsx`
   - Drag-and-drop zone (use react-dropzone)
   - File browser button
   - Google Drive link input (alternative for large files)
   - File type validation
   - Size validation (10MB for direct upload)
   - Upload progress bar
   - Preview thumbnails (for images)
   - Remove file option
2. Create `/src/services/fileService.js`
   - `uploadToStorage(file, path)` - Firebase Storage upload
   - `handleGoogleDriveLink(link)` - validate and store link
   - `deleteFile(fileUrl)` - remove from Storage
3. Implement storage structure:
   ```
   /clients/{clientId}/projects/{projectId}/
     ├── brief/
     ├── wip/
     ├── revisions/
     └── final/
   ```
4. Test upload flow

**Deliverable:** Working file uploads

---

#### Day 4-5: File Gallery & Management
**Goal:** Display and manage uploaded files

**Tasks:**
1. Create `/src/components/projects/FileGallery.jsx`
   - Grid display of files
   - Thumbnail previews (images)
   - File name, size, upload date
   - Download button (individual files)
   - Bulk download (ZIP all files)
   - Delete button (conditional permissions)
   - Lightbox view for images
2. Create `/src/components/projects/DeliverableUploader.jsx`
   - Specialized for creative uploads
   - Version management (v1, v2, v3)
   - Mark as "latest version"
   - Add version notes
   - Upload multiple files
3. Integrate into project workspace

**Deliverable:** Full file management

---

#### Weekend: File System Testing
**Goal:** Test file handling thoroughly

**Test Scenarios:**
- ✅ Upload image (PNG, JPG) → displays thumbnail
- ✅ Upload design file (AI, PSD) → stores correctly
- ✅ Upload large file (>10MB) → prompts for Google Drive
- ✅ Google Drive link → stores link, fetches metadata
- ✅ Download file → downloads correctly
- ✅ Delete file → removes from Storage and Firestore
- ✅ Version control → v1, v2, v3 tracked properly
- ✅ Lightbox view → opens full image

**Deliverable:** Reliable file system

---

## PHASE 4: POLISH & LAUNCH (WEEKS 11-14)

### Week 11: Notification System

#### Day 1-2: Notification Service
**Goal:** Build notification infrastructure

**AI Prompt to Use:** Prompt 11 (Notification System)

**Tasks:**
1. Create `/src/services/notificationService.js`
2. Create `/src/components/notifications/NotificationCenter.jsx`
   - Bell icon in header
   - Badge showing unread count
   - Dropdown list of notifications
   - Mark as read on click
   - Real-time updates (Firestore listener)
3. Create Cloud Function: `/functions/notifications/sendNotifications.js`
   - Triggered on notification create
   - Send email via SendGrid
   - Send SMS via Africa's Talking (optional)

**Deliverable:** Notification system

---

#### Day 3-4: Notification Templates
**Goal:** Create all notification types

**Notification Types to Implement:**
1. **Project Update**
   - Trigger: Project status changes
   - Recipients: Client + assigned creative
   - Content: "Your project '{title}' is now {status}"

2. **Payment Reminder**
   - Trigger: Subscription renews in 7 days
   - Recipient: Client
   - Content: "Your subscription renews on {date}. Amount: {amount}"

3. **Credit Low**
   - Trigger: Credits <20% remaining
   - Recipient: Client
   - Content: "You have {creditsRemaining} credits left"

4. **Performance Alert**
   - Trigger: CPS review completed
   - Recipient: Creative
   - Content: "Your CPS score is {score}. Status: {status}"

5. **Payment Success/Failure**
   - Trigger: Payment callback received
   - Recipient: Client
   - Content: Success or failure message

**Deliverable:** All notification types working

---

#### Day 5: Email Templates
**Goal:** Design professional email templates

**Tasks:**
1. Create HTML email templates in SendGrid
2. Templates needed:
   - Welcome email (signup)
   - Payment receipt
   - Subscription renewal reminder
   - Low credit alert
   - Performance review
   - Project status update
3. Include SanaaDeck branding
4. Add unsubscribe link (required)
5. Test email delivery

**Deliverable:** Professional email notifications

---

#### Weekend: Notification Testing
**Goal:** Test all notification flows

**Test Scenarios:**
- ✅ Project status change → notification sent
- ✅ Payment success → email + in-app notification
- ✅ Credit low → alert shows in dashboard
- ✅ Performance review → creative receives notification
- ✅ Unread badge count updates in real-time
- ✅ Mark as read → badge decreases
- ✅ Emails deliver correctly (check spam)

**Deliverable:** Reliable notifications

---

### Week 12: Testing & Bug Fixes

#### Day 1-2: End-to-End Testing
**Goal:** Test complete user journeys

**User Journeys to Test:**

**Client Journey:**
1. Sign up → Email verification
2. See dashboard with credit balance
3. Create new project → Credit confirmation
4. Credits deducted correctly
5. Project assigned to creative
6. Receive deliverables
7. Request revision
8. Approve project
9. Rate creative
10. Renew subscription → Payment flow

**Creative Journey:**
1. Sign up → Profile creation
2. Get assigned project
3. View brief and references
4. Upload deliverables
5. Submit for QC
6. Project approved
7. See earnings update
8. Check performance score
9. View payment history

**Admin Journey:**
1. View platform KPIs
2. Assign project manually
3. Adjust credits for client
4. Review creative performance
5. Issue warning
6. Export reports

**Deliverable:** Identified bugs list

---

#### Day 3-5: Bug Fixing Sprint
**Goal:** Fix all critical and high-priority bugs

**Common Issues to Check:**
- Loading states missing
- Error handling gaps
- Real-time updates not working
- Mobile responsiveness issues
- Form validation errors
- Payment failures
- File upload issues
- Notification delays

**Deliverable:** Bug-free MVP

---

#### Weekend: Performance Optimization
**Goal:** Optimize app performance

**Tasks:**
- Run Lighthouse audit (target: >90 score)
- Optimize images (convert to WebP, lazy load)
- Code splitting (lazy load routes)
- Minimize bundle size
- Add service worker for offline support (optional)
- Optimize Firestore queries (use indexes)
- Implement query pagination
- Add caching (React Query)

**Deliverable:** Fast, optimized app

---

### Week 13: Documentation & Deployment Prep

#### Day 1-2: User Documentation
**Goal:** Create user guides

**Documents to Create:**
1. **Client Guide**
   - How to create projects
   - Understanding credits
   - Payment methods
   - Requesting revisions
   - Upgrading subscription

2. **Creative Guide**
   - Accepting projects
   - Uploading deliverables
   - Understanding CPS
   - Earning bonuses
   - Payment schedule

3. **Admin Guide**
   - Platform management
   - Assigning projects
   - Monitoring performance
   - Generating reports

**Format:** Google Docs or Notion (easy to update)

**Deliverable:** Complete user documentation

---

#### Day 3-4: Deployment Setup
**Goal:** Prepare for production deployment

**Tasks:**
1. Set up production Firebase project (separate from dev)
2. Configure production environment variables
3. Set up custom domain (sanaadeck.com)
   - Add domain in Firebase Hosting
   - Update DNS records
   - Enable SSL (automatic via Firebase)
4. Configure M-Pesa production credentials
5. Configure Pesapal production credentials
6. Set up error monitoring (Sentry or Firebase Crashlytics)
7. Set up analytics (Google Analytics 4)
8. Create deployment script:
   ```bash
   #!/bin/bash
   # deploy.sh
   npm run build
   firebase use production
   firebase deploy --only hosting,functions,firestore:rules,storage
   ```

**Deliverable:** Production environment ready

---

#### Day 5: Security Audit
**Goal:** Ensure security best practices

**Security Checklist:**
- ✅ Firestore security rules restrict access properly
- ✅ Storage rules prevent unauthorized uploads
- ✅ API keys stored in environment variables (not in code)
- ✅ Cloud Functions validate all inputs
- ✅ Payment callbacks verify signatures
- ✅ XSS protection (sanitize user inputs)
- ✅ CSRF protection
- ✅ Rate limiting on Cloud Functions
- ✅ Password requirements enforced
- ✅ No sensitive data logged

**Tools:**
- Firebase Security Rules unit tests
- Manual penetration testing
- Code review for security issues

**Deliverable:** Security audit report

---

#### Weekend: Staging Deployment
**Goal:** Deploy to staging environment

**Tasks:**
1. Create Firebase staging project
2. Deploy app to staging: `firebase deploy --project staging`
3. Run smoke tests on staging:
   - Sign up and login
   - Create project
   - Make payment (sandbox)
   - Upload files
   - All dashboards load
4. Share staging URL with beta testers
5. Collect feedback

**Deliverable:** Staging environment live

---

### Week 14: Beta Testing & Launch

#### Day 1-3: Beta Testing
**Goal:** Get real user feedback

**Beta Testers:**
- 3-5 pilot clients (existing relationships)
- 2-3 creatives (vetted beforehand)
- 1 admin (yourself or co-founder)

**Beta Testing Checklist:**
- ✅ Testers can sign up successfully
- ✅ Dashboard loads correctly
- ✅ Projects can be created
- ✅ Payments work (use small test amounts)
- ✅ File uploads work
- ✅ Notifications received
- ✅ Mobile experience acceptable

**Collect Feedback:**
- Usability issues
- Confusing UI elements
- Missing features
- Performance problems
- Bug reports

**Deliverable:** Beta testing feedback report

---

#### Day 4: Final Fixes
**Goal:** Address critical feedback

**Tasks:**
- Fix any critical bugs found in beta
- Improve confusing UI elements
- Add missing tooltips/help text
- Final polish

**Deliverable:** Production-ready app

---

#### Day 5: LAUNCH! 🚀
**Goal:** Deploy to production and go live

**Launch Checklist:**
- ✅ All tests passing
- ✅ Documentation complete
- ✅ Payment processing tested
- ✅ Monitoring and analytics set up
- ✅ Support email/system ready (support@sanaadeck.com)
- ✅ Marketing materials ready
- ✅ Social media accounts created
- ✅ Domain pointing to production

**Deployment Steps:**
1. Final code review
2. Build production bundle: `npm run build`
3. Deploy: `./deploy.sh` or `firebase deploy --project production`
4. Verify deployment: Visit https://sanaadeck.com
5. Smoke test all critical flows
6. Announce launch (social media, email)
7. Monitor for errors (check logs every hour for first day)

**Deliverable:** SanaaDeck live in production! 🎉

---

## POST-LAUNCH (Week 15+)

### Immediate Post-Launch Tasks

**Week 15-16: Monitoring & Support**
- Monitor error logs daily
- Respond to user support requests
- Fix any critical bugs within 24hrs
- Collect user feedback
- Track key metrics:
  * Sign-ups per day
  * Active users
  * Revenue
  * Churn rate
  * Credit utilization

**Week 17-18: Iteration**
- Analyze user feedback
- Prioritize feature requests
- Plan next sprint
- Implement quick wins
- Improve onboarding flow

---

## SUCCESS METRICS

### MVP Success Criteria (First 3 Months)

**User Acquisition:**
- ✅ 10-15 paying clients
- ✅ 6-8 active creatives
- ✅ 50+ projects completed

**Technical:**
- ✅ 99%+ uptime
- ✅ <2s page load time
- ✅ Zero critical bugs
- ✅ <5% payment failure rate

**Financial:**
- ✅ $4,000-5,000 MRR
- ✅ Break-even on variable costs
- ✅ 50%+ gross margin

**Operational:**
- ✅ 70-85% credit utilization
- ✅ 24-48hr average turnaround
- ✅ 4.5+ average client rating
- ✅ <10% client churn

---

## TOOLS & RESOURCES

### Development Tools
- **Cursor AI / VS Code** - Code editor with AI assistance
- **Firebase Console** - Backend management
- **Postman** - API testing
- **React DevTools** - React debugging
- **Firebase Emulator Suite** - Local testing

### Design Tools
- **Figma** - UI design (if needed)
- **TailwindCSS Docs** - Styling reference
- **Shadcn/ui** - Component library

### Testing Tools
- **Jest** - Unit testing
- **React Testing Library** - Component testing
- **Cypress** - E2E testing (optional)
- **Lighthouse** - Performance audit

### Monitoring Tools
- **Firebase Analytics** - User analytics
- **Google Analytics 4** - Web analytics
- **Sentry** - Error tracking
- **Firebase Performance Monitoring** - Performance tracking

---

## TROUBLESHOOTING COMMON ISSUES

### Issue: Firebase Functions Deploy Fails
**Solution:**
```bash
# Ensure Node.js version is 18+
node -v

# Clear cache
npm cache clean --force

# Reinstall dependencies
cd functions
rm -rf node_modules package-lock.json
npm install

# Deploy specific function
firebase deploy --only functions:functionName
```

---

### Issue: Firestore Permission Denied
**Solution:**
- Check Firestore security rules
- Verify user is authenticated
- Check user role matches required role
- Test rules in Firebase Console Rules Playground

---

### Issue: Real-time Updates Not Working
**Solution:**
- Verify onSnapshot listener is set up correctly
- Check Firestore collection/document path
- Ensure cleanup function is called on unmount
- Check browser console for errors

---

### Issue: Payment Callback Not Received
**Solution:**
- Verify callback URL is publicly accessible (not localhost)
- Check M-Pesa/Pesapal logs for errors
- Ensure Cloud Function is deployed
- Test callback with sandbox environment first
- Check Firebase Functions logs: `firebase functions:log`

---

## FINAL NOTES

**Remember:**
- ✅ Start small, iterate quickly
- ✅ Test every feature thoroughly
- ✅ Deploy incrementally (don't wait for perfection)
- ✅ Monitor errors and user feedback
- ✅ Stay disciplined (no scope creep)
- ✅ Focus on credit system accuracy above all

**Week 14 Launch = MVP Only**
- Not all features need to be perfect
- Some features can be added post-launch
- Focus on core flows working reliably

**Continuous Improvement:**
- Plan 2-week sprints post-launch
- Prioritize based on user feedback
- Add features incrementally
- Maintain clean code and documentation

---

## CONGRATULATIONS! 🎉

If you've followed this roadmap, you now have a **production-ready, credit-based creative platform** for East Africa!

**What You've Built:**
✅ Credit tracking system  
✅ Role-based dashboards (Client, Creative, Admin)  
✅ Payment integration (M-Pesa + Pesapal)  
✅ Performance tracking (CPS)  
✅ File management  
✅ Notification system  
✅ Subscription automation  

**Next Steps:**
1. Onboard first pilot clients
2. Recruit quality creatives
3. Start marketing (social media, partnerships)
4. Collect testimonials
5. Scale gradually (20-25 clients by Month 6)

**Good luck with SanaaDeck! 🚀**

---

**Document Version:** 2.0 (Revised)  
**Last Updated:** February 2026  
**Total Timeline:** 14 weeks to launch-ready MVP
