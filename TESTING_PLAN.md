# Testing Plan - Multi-Tenant System & Critical Fixes

## Pre-Test Setup

### Users Needed
1. **Admin Account**: olavo@mazanga.digital (already set up with role: admin)
2. **Test User 1**: user1@test.com (role: user)
3. **Test User 2**: user2@test.com (role: user)

Create users via `/admin/users` if not already present.

---

## Test Suite 1: Data Isolation (Multi-Tenant)

### 1.1 Contact Isolation
**Setup**:
- Login as User1 → Create contact "Empresa A" with phone "+244912345678"
- Login as User2 → Try to create contact with SAME phone "+244912345678"
- **Expected**: User2 can successfully create contact (phone constraint is per-user)
- **Expected**: User1 only sees "Empresa A", User2 only sees their contact

**Verify**:
```
GET /api/contacts
- User1 response: should include "Empresa A"
- User2 response: should NOT include "Empresa A"
```

### 1.2 Task Isolation
**Setup**:
- User1 creates task for "Empresa A"
- User2 views tasks
- **Expected**: User2 cannot see User1's tasks

```
GET /api/tasks (User1): should see User1's tasks only
GET /api/tasks (User2): should NOT see User1's tasks
```

### 1.3 Finance Isolation
**Setup**:
- User1 creates transaction for 1000 KZ
- User2 views finances
- **Expected**: User2 sees 0 in revenue, User1 sees 1000 KZ

```
GET /api/finances/dashboard
- User1: revenue = 1000 KZ
- User2: revenue = 0 KZ
```

### 1.4 Form Isolation
**Setup**:
- User1 creates form "Contact Form"
- User2 lists forms
- **Expected**: User2 cannot see User1's form

```
GET /api/forms
- User1: should see "Contact Form"
- User2: should NOT see "Contact Form"
```

---

## Test Suite 2: Security Fixes

### 2.1 Profitability Data Leak Fixed
**Test**: Access another user's client profitability
```
GET /api/finances/profitability/{clientId}

Where clientId = user1's contact ID

User2 attempts request:
- BEFORE FIX: Would return User1's financial data ❌
- AFTER FIX: Returns 404 "Contact not found" ✅
```

### 2.2 Form Field Ownership
**Test**: Modify another user's form field
```
POST /api/forms/{form_id}/fields
- User1: Creates form "Form A"
- User2: Attempts POST /api/forms/{form_a_id}/fields
  - BEFORE FIX: Would add field to User1's form ❌
  - AFTER FIX: Returns 404 "Form not found" ✅
```

### 2.3 Form Submission - userId Assignment
**Test**: Form submission creates contact with correct userId
```
Submit form created by User1:
- POST /api/forms/{form_id}/submit
- Contact created should have userId = User1's ID
- User2 should NOT see this contact in GET /api/contacts
```

### 2.4 Form Submissions Ownership
**Test**: View another user's form submissions
```
GET /api/forms/{form_id}/submissions
- User1: Created form, can see submissions ✅
- User2: Cannot access User1's form, gets 404 ✅
```

---

## Test Suite 3: First-Time Password Change

### 3.1 First Login - Redirect to Change Password
**Setup**: Admin creates new user with temp password
```
1. Admin creates user: newuser@test.com
2. newuser logs in with temp password
3. Backend returns: { "mustChangePassword": true, "token": "..." }
4. Frontend redirects to /change-password
5. User enters new password (no current password required)
6. Backend accepts password change without current password validation
7. User redirected to /
```

### 3.2 Change Password from Profile Later
**Setup**: User already logged in, visits /profile
```
1. User at /profile
2. Clicks "Change Password"
3. Enters: currentPassword, newPassword, confirmPassword
4. Backend validates currentPassword matches existing
5. Password updated successfully
```

---

## Test Suite 4: Validation

### 4.1 Phone Format Validation
**Test**: Create contact with invalid phone
```
POST /api/contacts
- Phone: "invalid!!!" → Returns 400 "Phone format is invalid"
- Phone: "+244912345678" → Success ✅
- Phone: "(21) 9 1234-5678" → Success ✅
```

### 4.2 Task Priority Validation
**Test**: Create task with invalid priority
```
POST /api/tasks
- Priority: "URGENT" → Returns 400 "Priority must be one of: Baixa, Media, Alta"
- Priority: "Alta" → Success ✅
- Priority: "Media" → Success ✅
```

### 4.3 Automation Enum Validation
**Test**: Create automation with invalid trigger/action
```
POST /api/automations
- Trigger: "invalid_trigger" → Returns 400
- Trigger: "new_contact" → Success ✅
- Action: "invalid_action" → Returns 400
- Action: "send_email" → Success ✅
```

---

## Test Suite 5: Schema Migration

### 5.1 Composite Unique Constraint
**Test**: Phone uniqueness is now per-user
```
1. User1 creates contact: phone = "+244912345678"
2. User2 creates contact: phone = "+244912345678"
   - Should succeed (different userId)
3. User1 creates another contact: phone = "+244912345678"
   - Should fail with "Unique constraint failed on (userId, phone)"
```

---

## Test Execution Checklist

### Before Running Tests
- [ ] Backend running on port 3001
- [ ] Frontend running on port 3000
- [ ] Fresh login for all test accounts
- [ ] No browser cache (hard refresh with Cmd+Shift+R)

### Running Tests
- [ ] Suite 1: Data Isolation (5 minutes)
- [ ] Suite 2: Security Fixes (5 minutes)
- [ ] Suite 3: Password Change (3 minutes)
- [ ] Suite 4: Validation (3 minutes)
- [ ] Suite 5: Schema (2 minutes)

### Verification Commands
```bash
# Check database schema
npm run db:studio

# Check backend logs
tail -f backend.log

# API test (example)
curl -H "Authorization: Bearer {token}" \
  http://localhost:3001/api/contacts
```

---

## Expected Results
- ✅ All data properly isolated by userId
- ✅ All security vulnerabilities fixed
- ✅ All validation working
- ✅ No data leaks between users
- ✅ First-time password change works
- ✅ Phone constraint prevents duplicates per-user

---

## Rollback Plan
If issues discovered:
1. Revert schema: `git checkout backend/prisma/schema.prisma`
2. Run: `npm run db:push`
3. Revert route files: `git checkout backend/src/routes/`
4. Restart backend

---

## Sign-Off
- [ ] All tests passed
- [ ] No data leaks detected
- [ ] All validations working
- [ ] Performance acceptable
- [ ] Ready for production

