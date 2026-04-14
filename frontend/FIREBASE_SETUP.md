# Firebase Setup Guide

Your Firebase project is configured, but you need to enable authentication methods.

## Current Firebase Config

```
Project ID: tinex-fd2b6
Auth Domain: tinex-fd2b6.firebaseapp.com
```

## Step 1: Enable Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/project/tinex-fd2b6)
2. Click **Authentication** in the left sidebar
3. Click **Get Started** (if first time)
4. Go to **Sign-in method** tab

### Enable Email/Password Authentication

1. Click on **Email/Password**
2. Toggle **Enable** switch
3. Click **Save**

### Enable Google Sign-In

1. Click on **Google**
2. Toggle **Enable** switch
3. Add your project support email
4. Click **Save**

## Step 2: Set Up Firestore Database

1. Go to **Firestore Database** in the sidebar
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Select your region (closest to your users)
5. Click **Enable**

### Add Security Rules (Production)

Once you're ready for production, update Firestore rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /transactions/{transactionId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }

    match /categories/{categoryId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }

    match /budgets/{budgetId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }

    match /importSources/{sourceId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }

    match /importJobs/{jobId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }
  }
}
```

## Step 3: Set Up Storage

1. Go to **Storage** in the sidebar
2. Click **Get started**
3. Start in **test mode** (for development)
4. Click **Done**

### Storage Rules (Production)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/imports/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Step 4: Verify Configuration

Your app is already configured with these credentials:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCJ9ZQAvHYtKs-37fA6jXtCah2bBrhBPS8",
  authDomain: "tinex-fd2b6.firebaseapp.com",
  projectId: "tinex-fd2b6",
  storageBucket: "tinex-fd2b6.firebasestorage.app",
  messagingSenderId: "417161639080",
  appId: "1:417161639080:web:3ea342c4f102d814703e9d",
  measurementId: "G-BYMWSYMH8Z"
};
```

## Step 5: Test Authentication

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to http://localhost:3000/auth

3. Try signing up with email/password

4. Try signing in with Google

## Troubleshooting

### "auth/operation-not-allowed" Error
- Make sure Email/Password and Google sign-in are enabled in Firebase Console
- Check Authentication > Sign-in method tab

### "Unauthorized domain" Error
- Go to Authentication > Settings > Authorized domains
- Add `localhost` for development
- Add your production domain when deploying

### Firestore Permission Denied
- Make sure you started in **test mode**
- Or update security rules to allow authenticated access

## Environment Variables (Optional)

For security best practices, you can also use environment variables:

Create `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCJ9ZQAvHYtKs-37fA6jXtCah2bBrhBPS8
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tinex-fd2b6.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tinex-fd2b6
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tinex-fd2b6.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=417161639080
NEXT_PUBLIC_FIREBASE_APP_ID=1:417161639080:web:3ea342c4f102d814703e9d
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-BYMWSYMH8Z
```

The app will use these environment variables if present, or fall back to the hardcoded values.

## Firestore Indexes

Compound indexes are required for certain queries. The indexes are defined in `firestore.indexes.json`.

### Option 1: Automatic (Recommended)
When you run the app and it attempts a compound query, Firebase will display an error message in the console with a direct link to create the index. Click the link to automatically create the required index.

### Option 2: Firebase CLI
```bash
firebase deploy --only firestore:indexes
```

### Option 3: Manual Creation via Console
Go to Firestore Database → Indexes and create the following composite indexes:

#### Transactions Collection
1. **Account Transactions Query** (Required for account detail page)
   - Collection: `transactions`
   - Fields:
     - `userId` (Ascending)
     - `accountId` (Ascending)
     - `date` (Descending)
   - Query scope: Collection

2. **User Transactions by Date**
   - Collection: `transactions`
   - Fields:
     - `userId` (Ascending)
     - `date` (Descending)
   - Query scope: Collection

3. **User Transactions by Category**
   - Collection: `transactions`
   - Fields:
     - `userId` (Ascending)
     - `categoryId` (Ascending)
     - `date` (Descending)
   - Query scope: Collection

## Troubleshooting Common Issues

### "The query requires an index" error
- Click the link in the error message to create the index
- Or deploy the indexes using `firebase deploy --only firestore:indexes`
- Indexes may take a few minutes to build
- The app has fallback logic to query without indexes if needed

### Transactions not showing in account detail page
- Check browser console for errors
- Verify the Firestore indexes are created (see above)
- Make sure transactions have the `accountId` field populated

### Total Balance showing NaN
- This was caused by UAH currency not being in the previous API
- The app now uses CurrencyFreaks API which includes UAH
- Set `CURRENCY_API_KEY` in your `.env.local` for production use (see Currency API Setup below)
- Clear your browser cache if the issue persists

### Currency API Setup
The app uses [CurrencyFreaks API](https://currencyfreaks.com/) for exchange rates:

1. Sign up for a free account at https://currencyfreaks.com/
2. Get your API key from the dashboard
3. Add to `.env.local` (server-side only, NOT exposed to client):
   ```
   CURRENCY_API_KEY=your_api_key_here
   ```

**Important Security Note:**
- The API key is stored as `CURRENCY_API_KEY` (without `NEXT_PUBLIC_` prefix)
- This keeps the key server-side only and not exposed to the browser
- The Next.js API route at `/api/currency` handles all external API calls
- Free tier includes 1,000 requests per month
- If no API key is set, the app falls back to approximate exchange rates

## Next Steps

Once Firebase is configured:
1. Test authentication at /auth
2. Access the dashboard at /dashboard
3. Start implementing transaction features
4. Add CSV import functionality
5. Build charts and analytics

## Resources

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Storage](https://firebase.google.com/docs/storage)
- [Firestore Indexes Guide](https://firebase.google.com/docs/firestore/query-data/indexing)
