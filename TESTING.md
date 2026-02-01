# Testing Checklist

This document provides a comprehensive testing checklist for the FRC Work Order System MVP.

## Pre-Testing Setup

- [ ] All environment variables configured in `.env` files
- [ ] Supabase migrations applied successfully
- [ ] Discord bot added to test server with proper permissions
- [ ] Discord OAuth configured with correct redirect URLs
- [ ] Both bot and dashboard running in development mode

## Manual Testing Checklist

### Authentication & Login

- [ ] User can click "Login with Discord" on `/login` page
- [ ] User is redirected to Discord authorization screen
- [ ] User returns to dashboard after authorization
- [ ] User can logout and is redirected to login page
- [ ] Unauthenticated users are redirected to `/login`

### Work Order List Page

- [ ] `/workorders` page loads with list of open work orders
- [ ] Work orders display: Title, Category, Status, Priority, Created By, Claimed By
- [ ] User can click "View" button to go to detail page
- [ ] Page shows "No open work orders" when empty
- [ ] Timestamps display in correct format
- [ ] Navigation to Usage Stats and Admin pages works

### Work Order Detail Page

- [ ] `/workorders/[id]` loads correct work order data
- [ ] All work order fields display correctly
- [ ] Audit log history shows in reverse chronological order
- [ ] Audit log actions are labeled correctly (CREATE, CLAIM, STATUS_CHANGE, etc.)
- [ ] User can navigate back to work orders list
- [ ] 404 error when work order doesn't exist

### Usage Statistics Page

- [ ] `/usage` page shows user statistics
- [ ] Statistics include: User ID, Completed Count, Claimed Count
- [ ] Users sorted by completed count (descending)
- [ ] "No usage data available" when empty
- [ ] Navigation back to work orders works

### Admin Settings Page

- [ ] `/admin` page loads (admin access only in final version)
- [ ] Admin can input role IDs and channel IDs
- [ ] Form submits without errors (save button exists)
- [ ] Navigation back to work orders works

### Discord Bot - Slash Commands

#### `/wo-create`
- [ ] Command autocompletes and shows options
- [ ] Create work order with all fields
- [ ] Create work order with minimal fields (title + category)
- [ ] User receives confirmation message with work order ID
- [ ] Work order appears in database
- [ ] Audit log entry created with action: CREATE
- [ ] Work order card posted to configured channel (if set)

#### `/wo-list`
- [ ] Returns ephemeral message with list of open work orders
- [ ] Shows up to 10 work orders
- [ ] Shows "... and N more" when >10 exist
- [ ] Displays work order title, ID, status, priority, and claimant

#### `/wo-claim`
- [ ] User can claim unclaimed work order
- [ ] User cannot claim already-claimed work order (error message)
- [ ] Work order `claimed_by_user_id` updates in database
- [ ] Audit log entry created with action: CLAIM
- [ ] Confirmation message sent
- [ ] Message buttons update to show UNCLAIM instead of CLAIM

#### `/wo-unclaim`
- [ ] User can unclaim their own claim
- [ ] User cannot unclaim others' claims (non-admin)
- [ ] Admin can unclaim any claim
- [ ] Work order `claimed_by_user_id` set to null
- [ ] Audit log entry created with action: UNCLAIM
- [ ] Message buttons update

#### `/wo-edit` (Creator)
- [ ] Creator can edit title, description, category
- [ ] Non-creator gets permission error
- [ ] Audit log entry created with action: EDIT
- [ ] Changes reflected in database and message card

#### `/wo-assign` (Admin only)
- [ ] Admin can assign work order to user
- [ ] Non-admin gets permission error
- [ ] Assigned user is pinged in Discord
- [ ] `assigned_to_user_id` updated in database
- [ ] Audit log entry created with action: ASSIGN

#### `/wo-remove` (Admin only)
- [ ] Admin can soft-delete work order
- [ ] Non-admin gets permission error
- [ ] Work order `is_deleted` set to true
- [ ] Work order no longer appears in `/wo-list`
- [ ] Audit log entry created with action: REMOVE
- [ ] Message card still viewable but marked as removed

### Discord Bot - Button Interactions

#### Claim Button
- [ ] Claim button visible when work order unclaimed
- [ ] Clicking claim button claims work order
- [ ] Button updates to show UNCLAIM after claim
- [ ] User confirmed with message

#### Unclaim Button
- [ ] Unclaim button visible when user claimed work order
- [ ] Clicking unclaim button removes claim
- [ ] Button reverts to CLAIM
- [ ] User confirmed with message

#### Mark Done Button
- [ ] Mark Done button visible when user claimed work order
- [ ] Clicking marks work order as DONE
- [ ] Status changes from OPEN to DONE
- [ ] Audit log entry created with action: STATUS_CHANGE
- [ ] Work order no longer appears in open list
- [ ] Confirmation message sent

### Permissions & Access Control

#### Member Permissions
- [ ] Members can create work orders
- [ ] Members can claim/unclaim their own claims
- [ ] Members can edit work orders they created
- [ ] Members cannot remove work orders
- [ ] Members cannot assign work orders

#### Admin Permissions
- [ ] Admins can perform all member actions
- [ ] Admins can remove any work order
- [ ] Admins can assign work orders
- [ ] Admins can unclaim others' claims
- [ ] Admins can access admin settings page

### Audit Trail

- [ ] Every action creates audit log entry
- [ ] Audit log includes: action, actor, timestamp, metadata
- [ ] Audit logs are immutable (no updates/deletes)
- [ ] Audit logs visible in work order detail page
- [ ] Actions display with correct labels

### Error Handling

- [ ] Invalid work order ID returns error
- [ ] Network errors show user-friendly messages
- [ ] Database errors are logged without exposing details
- [ ] Button interaction errors don't crash app
- [ ] Page reload recovers from temporary errors

### Database & RLS

- [ ] Users can only read work orders (permission checked at app level)
- [ ] Members can insert work orders
- [ ] Members can update their own work orders
- [ ] Admins can update any work order in their guild
- [ ] Audit logs are insert-only
- [ ] Soft deletes show `is_deleted = true` in database

## Browser Testing

Test on multiple browsers:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if on macOS)
- [ ] Edge

Test on multiple screen sizes:
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

## Performance Testing

- [ ] Work order list loads in <2 seconds
- [ ] Button clicks respond within 500ms
- [ ] No memory leaks when navigating between pages
- [ ] Images load without errors
- [ ] Large audit logs don't cause lag

## Security Testing

- [ ] Cannot access admin page without admin role
- [ ] Cannot modify work orders you don't have permission for
- [ ] RLS prevents unauthorized database access
- [ ] Service role key not exposed in browser
- [ ] OAuth tokens properly secured

## Load Testing (Optional)

- [ ] Dashboard handles multiple concurrent users
- [ ] Bot can handle rapid command spam
- [ ] Database connection pooling works correctly
- [ ] No connection timeouts under load

## Bug Reporting

When bugs are found, document:
- [ ] Steps to reproduce
- [ ] Expected behavior
- [ ] Actual behavior
- [ ] Screenshots/videos if applicable
- [ ] Browser and OS version
- [ ] Error messages or logs

## Sign-Off

- [ ] All critical tests pass
- [ ] No blockers remaining
- [ ] Performance acceptable
- [ ] Ready for deployment

---

**Last Updated:** [Date]
**Tested By:** [Name]
**Status:** [ ] Pass / [ ] Fail
