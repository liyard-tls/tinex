# Deploy Firebase Security Rules

## Problem
You're getting "Missing or insufficient permissions" error because the `importedTransactions` collection rules are missing from Firebase.

## Solution
Deploy the updated security rules to Firebase.

## Option 1: Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Rules** tab
4. Copy the contents of `firestore.rules` file
5. Paste into the rules editor
6. Click **Publish**

## Option 2: Firebase CLI (Recommended for Future)

### First Time Setup

1. Install Firebase CLI if you haven't:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase in your project (if not done):
```bash
firebase init
```
- Select: Firestore
- Use existing project: Select your TineX project
- Use default file: `firestore.rules`
- Don't overwrite existing rules file

### Deploy Rules

```bash
firebase deploy --only firestore:rules
```

Expected output:
```
✔ Deploy complete!

Project Console: https://console.firebase.google.com/project/your-project/overview
```

## Verify Deployment

After deploying, test the import again:

1. Go to http://localhost:3000/import
2. Select account
3. Upload `trustee_statement.pdf`
4. Click "Parse File" → Should show 15 transactions
5. Click "Import X Transactions" → Should succeed!

## What Was Added

The new rule allows authenticated users to read/write their own imported transaction records:

```javascript
// Imported Transactions collection (for duplicate detection)
match /importedTransactions/{importId} {
  allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
  allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
  allow update, delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
}
```

This allows the duplicate detection system to:
- ✅ Check which transactions have already been imported (read)
- ✅ Record new imports to prevent duplicates (create)
- ✅ Users can only see their own import records (security)

## Troubleshooting

### Error: "Firebase CLI not found"
```bash
npm install -g firebase-tools
```

### Error: "No project active"
```bash
firebase use --add
# Select your project from the list
```

### Error: "Permission denied"
Make sure you're logged into the correct Google account:
```bash
firebase logout
firebase login
```

### Still getting permission errors?
1. Verify rules deployed: Check Firebase Console → Firestore → Rules tab
2. Check your auth: Make sure you're logged in to the app
3. Clear browser cache and reload

## Quick Deploy Script

You can add this to `package.json`:

```json
{
  "scripts": {
    "deploy:rules": "firebase deploy --only firestore:rules"
  }
}
```

Then run:
```bash
npm run deploy:rules
```

## After Deployment

The import flow should work:
1. Parse PDF → ✅ Shows 15 transactions
2. Import → ✅ Creates transactions in Firestore
3. Duplicate detection → ✅ Prevents re-importing same transactions
4. Success message → ✅ Shows import summary
