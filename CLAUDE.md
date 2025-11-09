# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TineX is a personal finance management application built with Next.js 14 (App Router), TypeScript, Firebase, and TailwindCSS. It provides transaction tracking, budget management, analytics, and bank statement import capabilities with a dark-themed, mobile-first UI.

## Development Commands

```bash
# Development
npm run dev              # Start development server on http://localhost:3000
npm run build           # Build for production (must pass before deploying)
npm run start           # Start production server
npm run lint            # Run ESLint
npm run type-check      # Run TypeScript type checking without building
```

**Important**: Always run `npm run build` before considering work complete. The build must succeed without errors.

## Architecture Overview

### Core Design Patterns

1. **Repository Pattern**: All Firestore data access goes through repository classes in `core/repositories/`. Never use Firestore directly in components.

2. **Repository Method Signature**: Transaction creation follows a specific pattern:
   ```typescript
   // CORRECT: TransactionRepository.create takes 3 separate arguments
   transactionRepository.create(userId, createInput, currency)

   // WRONG: Don't pass everything in one object
   transactionRepository.create({ userId, ...data })
   ```

3. **Model Layer**: All data models are in `core/models/` and exported through `core/models/index.ts`. Always import models from the index file.

4. **Firebase Integration**: All Firebase configuration is in `lib/firebase.ts`. Use the exported `auth`, `db`, and `storage` instances.

### Directory Structure

```
app/                    # Next.js App Router pages
├── dashboard/         # Main dashboard
├── transactions/      # Transaction list and management
├── accounts/          # Account management
├── analytics/         # Financial analytics with charts
├── import/            # Bank statement import UI
├── settings/          # Settings and configuration
└── api/              # API routes (e.g., currency conversion)

core/
├── models/           # TypeScript interfaces and types
├── repositories/     # Firebase data access layer
└── services/         # (Reserved for future business logic)

modules/              # Feature-specific components
├── transactions/     # AddTransactionForm, etc.
├── accounts/         # AddAccountForm, etc.
└── (others)/

shared/
├── components/       # Reusable UI components (Card, Button, Modal, etc.)
├── services/         # Utility services (currencyService, parsers)
├── utils/            # Helper functions (cn for className merging)
└── config/           # Constants (FIREBASE_COLLECTIONS, etc.)
```

### Key Implementation Details

#### 1. Transaction Time Handling
Transactions store BOTH date AND time. The form has separate date and time inputs:
```typescript
// Form has two fields:
<Input type="date" {...register('date')} />
<Input type="time" {...register('time')} />

// Combined in submission:
const dateTime = new Date(`${dateStr}T${timeStr}`);
```

#### 2. Currency Conversion
- Uses `shared/services/currencyService.ts` for all currency operations
- Exchange rates cached for 1 hour
- Calls `/api/currency` endpoint (keeps API key server-side)
- Has fallback rates if API fails
- All conversions go through USD as intermediate currency

#### 3. Bank Statement Import System

**Trustee PDF Parser** (`shared/services/trusteeParser.ts`):
- Uses `pdf-parse` library with dynamic import: `const pdf = await import('pdf-parse')`
- Parses date, time, description, amount (with sign), and currency
- Creates unique hash for duplicate detection: `hash(date + description + amount + currency)`
- Returns transactions with type already determined (negative amount = expense)

**Import Flow** (`app/import/page.tsx`):
1. User selects account
2. Uploads PDF file
3. Parse → Preview transactions
4. Import → Skip duplicates, create transactions
5. Track in `importedTransactions` collection via `ImportedTransactionRepository`

**Duplicate Prevention**:
- `ImportedTransactionRepository.getImportedHashes()` returns Set of hashes
- Check `existingHashes.has(parsed.hash)` before importing
- Store hash after successful import

#### 4. Analytics Charts
- Uses Recharts library (not custom SVG)
- Components: `AreaChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`
- Custom tooltip component with TypeScript interface (not `any`)
- Dynamic coloring based on positive/negative values

#### 5. Firebase Collections
All collection names defined in `shared/config/constants.ts`:
```typescript
export const FIREBASE_COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  CATEGORIES: 'categories',
  ACCOUNTS: 'accounts',
  TAGS: 'tags',
  // ... etc
};
```

Always use constants, never hardcode collection names.

#### 6. Component Patterns

**Form Handling**:
- Uses `react-hook-form` with TypeScript
- Zod for validation (when needed)
- Forms in `modules/` directory, named like `AddTransactionForm.tsx`

**Modal Pattern**:
```typescript
const [showModal, setShowModal] = useState(false);

<Modal isOpen={showModal} onClose={() => setShowModal(false)}>
  <FormComponent onSubmit={handleSubmit} />
</Modal>
```

**Repository Usage in Components**:
```typescript
// Always check for user before repository calls
if (!user) return;

// Repository calls in try-catch
try {
  await repository.create(...);
  await loadData(user.uid); // Reload data after mutation
} catch (error) {
  console.error('Failed to...', error);
  // Optionally show error to user
}
```

### Common Pitfalls

1. **Don't use `any` type**: Always define proper TypeScript interfaces, especially for chart tooltips and API responses.

2. **Module imports for external libraries**: Some libraries (like `pdf-parse`) need special import handling:
   ```typescript
   // Use dynamic import with type assertion
   const pdf = (await import('pdf-parse')) as any;
   ```

3. **Date handling**: Always preserve time information. Don't use just `Date` type - combine date and time inputs.

4. **Repository method signatures**: Check the actual implementation before calling. TransactionRepository.create takes 3 arguments, not 1.

5. **ESLint compliance**: Build fails on unused imports and `any` types. Always fix linting errors.

## Firebase Data Models

### Transaction
```typescript
{
  userId: string
  accountId: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  description: string
  date: Timestamp  // Firestore Timestamp (includes time!)
  categoryId: string
  merchantName?: string
  tags: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### ImportedTransaction
```typescript
{
  userId: string
  transactionId: string  // Reference to created transaction
  hash: string          // Unique hash for duplicate detection
  source: string        // e.g., 'trustee', 'monobank'
  importDate: Timestamp
  createdAt: Timestamp
}
```

### Account
```typescript
{
  userId: string
  name: string
  type: 'cash' | 'bank_account' | 'credit_card' | 'investment' | 'other'
  currency: Currency
  balance: number
  isDefault: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

## Adding New Features

### Adding a New Bank Parser

1. Create parser service in `shared/services/` (e.g., `monobankParser.ts`)
2. Export interface matching:
   ```typescript
   export interface ParsedTransaction {
     date: Date
     description: string
     amount: number  // absolute value
     currency: string
     type: 'income' | 'expense'
     hash: string
   }

   export async function parseXXXPDF(buffer: Buffer): Promise<{
     period: string
     transactions: ParsedTransaction[]
   }>
   ```
3. Update import page to support new source type
4. Add source type to `ImportedTransactionRepository` calls

### Adding a New Page

1. Create page in `app/[pagename]/page.tsx`
2. Follow existing patterns:
   - Use `'use client'` directive
   - Check authentication with `onAuthStateChanged`
   - Include `<BottomNav />` at bottom
   - Use semantic HTML with proper padding (`pb-20` for bottom nav space)
3. Add navigation link in `BottomNav.tsx` or `Settings` page

## Environment Variables

Required in `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Note: `lib/firebase.ts` has fallback values for development, but production should use proper environment variables.

## Testing Approach

Currently no automated tests. Manual testing workflow:
1. Run `npm run build` to check for type errors
2. Run `npm run lint` to check code quality
3. Test in browser at http://localhost:3000
4. Check Firebase Console for data integrity

## Navigation Structure

Bottom Navigation (mobile-first):
- Home → `/dashboard`
- Accounts → `/accounts`
- Budgets → `/budgets`
- Analytics → `/analytics`
- Settings → `/settings`

Settings submenu links:
- Categories → `/categories`
- Tags → `/tags`
- Import Transactions → `/import`

## Styling Conventions

- TailwindCSS with dark theme by default
- Use `cn()` utility from `shared/utils/cn.ts` for conditional classes
- Mobile-first responsive design
- Lucide React for icons
- Shared components in `shared/components/ui/`
