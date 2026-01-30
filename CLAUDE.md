# CLAUDE.md

Automatically use context7 for code generation and library documentation.

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
   transactionRepository.create(userId, createInput, currency);

   // WRONG: Don't pass everything in one object
   transactionRepository.create({ userId, ...data });
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

modules/              # Feature-specific components and business logic
├── transactions/     # AddTransactionForm, etc.
├── accounts/         # AddAccountForm, etc.
├── analytics/        # SpendingInsights, SpendingTrendAnalyzer, etc.
└── (others)/

shared/
├── components/       # Reusable UI components (Card, Button, Modal, etc.)
├── services/         # Utility services (currencyService, parsers)
├── utils/            # Helper functions (cn for className merging)
└── config/           # Constants (FIREBASE_COLLECTIONS, etc.)
```

### Modular Architecture Principles

**IMPORTANT**: Always prefer modular architecture. Create reusable modules instead of implementing logic directly in pages.

**When to create a module:**

1. Business logic that could be reused (calculations, analysis, transformations)
2. Complex UI components specific to a feature
3. Related functionality that should be grouped together
4. Code that should be testable in isolation

**Module structure:**

```
modules/
└── feature-name/
    ├── index.ts              # Public API exports
    ├── FeatureComponent.tsx  # React components
    ├── featureLogic.ts       # Business logic functions
    └── types.ts              # TypeScript interfaces (if needed)
```

**Example - Analytics Module:**

```typescript
// modules/analytics/index.ts
export { default as SpendingInsights } from "./SpendingInsights";
export { analyzeSpendingTrend } from "./SpendingTrendAnalyzer";

// Usage in pages
import { SpendingInsights } from "@/modules/analytics";
```

**Benefits:**

- Easy to test business logic separately from UI
- Clear separation of concerns
- Reusable across different pages
- Better code organization
- Easier to maintain and refactor

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

#### 2. PWA Support

The app is a Progressive Web App with:

- **Service Worker** (`public/sw.js`): Network-first caching strategy for offline support
- **Manifest** (`public/manifest.json`): App metadata, icons, shortcuts
- **Installation**: Handled via `beforeinstallprompt` event in components
- **Viewport metadata**: Separated from Next.js metadata export (Next.js 14 requirement)

```typescript
// Next.js 14 pattern - viewport is separate export
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export const metadata: Metadata = { ... };
```

**PWA Icon Requirements**:

- Chrome requires separate icon entries for "purpose: any" and "purpose: maskable" (not combined)
- SVG favicons supported for modern browsers

#### 3. Currency Conversion

- Uses `shared/services/currencyService.ts` for all currency operations
- Exchange rates cached for 1 hour
- Calls `/api/currency` endpoint (keeps API key server-side)
- Has fallback rates if API fails
- All conversions go through USD as intermediate currency

#### 4. Bank Statement Import System

**Two Parser Systems** (historical reasons):

1. **Legacy PDF Parser** (`shared/services/trusteeParser.ts`):

   - Server-side only (uses `pdf-parse` CommonJS module)
   - API route at `/api/parse-pdf`
   - Specific to Trustee bank format
   - Creates hash for duplicate detection

2. **Modular Parser System** (`modules/parsers/`):
   - Newer, more extensible architecture
   - Registry pattern for dynamic parser registration
   - Supports CSV (PapaParse), XLSX, PDF
   - See `modules/parsers/core/ParserInterface.ts` for interface

**Recommended for new parsers**: Use the modular system in `modules/parsers/`.

**Legacy Trustee PDF Flow** (`app/import/page.tsx`):

1. User selects account
2. Uploads PDF file
3. Client sends file to `/api/parse-pdf` endpoint
4. Server parses PDF and returns transactions (dates serialized as ISO strings)
5. Client converts date strings back to Date objects
6. Preview transactions
7. Import → Skip duplicates, create transactions
8. Track in `importedTransactions` collection via `ImportedTransactionRepository`

**Duplicate Prevention**:

- `ImportedTransactionRepository.getImportedHashes()` returns Set of hashes
- Check `existingHashes.has(parsed.hash)` before importing
- Store hash after successful import
- **IMPORTANT**: When deleting a transaction, the associated `importedTransactions` record is automatically deleted via `TransactionRepository.delete()` to prevent false duplicate detection

**CSV Parsing** (easiest to implement):

- Use PapaParse library (already installed)
- Client-side parsing, no API needed
- Standardized format most banks export

#### 5. Analytics Charts

- Uses Recharts library (not custom SVG)
- Components: `AreaChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`
- Custom tooltip component with TypeScript interface (not `any`)
- Dynamic coloring based on positive/negative values
- Week-based navigation with custom date picker

#### 6. Firebase Collections

All collection names defined in `shared/config/constants.ts`:

```typescript
export const FIREBASE_COLLECTIONS = {
  TRANSACTIONS: "transactions",
  CATEGORIES: "categories",
  ACCOUNTS: "accounts",
  TAGS: "tags",
  // ... etc
};
```

Always use constants, never hardcode collection names.

#### 7. Component Patterns

**Form Handling**:

- Uses `react-hook-form` with TypeScript
- Zod for validation (when needed)
- Forms in `modules/` directory, named like `AddTransactionForm.tsx`

**Modal Pattern**:

```typescript
const [showModal, setShowModal] = useState(false);

<Modal isOpen={showModal} onClose={() => setShowModal(false)}>
  <FormComponent onSubmit={handleSubmit} />
</Modal>;
```

**Inline Editing Pattern**:

```typescript
const [editing, setEditing] = useState(false);
const [newValue, setNewValue] = useState("");

{
  editing ? (
    <div className="flex items-center gap-2">
      <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} />
      <Button onClick={handleSave}>
        <Check />
      </Button>
      <Button onClick={() => setEditing(false)}>
        <X />
      </Button>
    </div>
  ) : (
    <div onClick={() => setEditing(true)}>
      <span>{currentValue}</span>
      <Pencil className="h-4 w-4" />
    </div>
  );
}
```

**Side Panel Pattern** (for quick actions without full-page navigation):

```typescript
const [showPanel, setShowPanel] = useState(false);

// Backdrop
{
  showPanel && (
    <div
      className="fixed inset-0 bg-black/50 z-40"
      onClick={() => setShowPanel(false)}
    />
  );
}

// Sliding panel
<div
  className={cn(
    "fixed top-0 right-0 h-full w-80 bg-background z-50 transform transition-transform",
    showPanel ? "translate-x-0" : "translate-x-full"
  )}
>
  {/* Panel content */}
</div>;
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

**Bulk Data Deletion**:

```typescript
// All repositories support deleteAllForUser
await Promise.all([
  transactionRepository.deleteAllForUser(userId),
  accountRepository.deleteAllForUser(userId),
  categoryRepository.deleteAllForUser(userId),
  // etc.
]);
```

### Common Pitfalls

1. **Don't use `any` type**: Always define proper TypeScript interfaces, especially for chart tooltips and API responses.

2. **Module imports for external libraries**: Some libraries (like `pdf-parse`) are CommonJS modules and need special import handling:

   ```typescript
   // Use require() for CommonJS modules like pdf-parse
   // eslint-disable-next-line @typescript-eslint/no-var-requires
   const pdf = require("pdf-parse");
   ```

3. **Date handling**: Always preserve time information. Don't use just `Date` type - combine date and time inputs.

4. **Repository method signatures**: Check the actual implementation before calling. TransactionRepository.create takes 3 arguments, not 1.

5. **ESLint compliance**: Build fails on unused imports and `any` types. Always fix linting errors.

6. **Default exports vs named exports**: Check how components are exported before importing:

   ```typescript
   // If component uses: export default Button
   import Button from "./Button"; // CORRECT
   import { Button } from "./Button"; // WRONG

   // If component uses: export const Button = ...
   import { Button } from "./Button"; // CORRECT
   ```

7. **PWA manifest icons**: Don't combine purposes like `"purpose": "any maskable"` - Chrome rejects this. Use separate entries for each purpose.

8. **Service Worker caching**: Only cache truly static assets (manifest.json, icons). Don't try to cache Next.js dynamic routes in the install event.

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
  userId: string;
  transactionId: string; // Reference to created transaction
  hash: string; // Unique hash for duplicate detection
  source: string; // e.g., 'trustee', 'monobank'
  importDate: Timestamp;
  createdAt: Timestamp;
}
```

### Account

```typescript
{
  userId: string;
  name: string;
  type: "cash" | "bank_account" | "credit_card" | "investment" | "other";
  currency: Currency;
  balance: number;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Adding New Features

### Adding a New Bank Parser

**Option 1: Modular Parser System** (Recommended)

1. Create parser in `modules/parsers/implementations/csv/` (or pdf/xlsx)
2. Implement `BankParser` interface from `modules/parsers/core/ParserInterface.ts`:

   ```typescript
   export class MyBankParser implements BankParser {
     readonly id = 'mybank-csv';
     readonly name = 'My Bank CSV Parser';
     readonly bankName = 'My Bank';
     readonly supportedFormats = ['csv'];

     async supports(file: File): Promise<boolean> { ... }
     async parse(file: File): Promise<ParsedTransaction[]> { ... }
     validate(transactions: ParsedTransaction[]): ValidationResult { ... }
     getFormatDescription(): string { ... }
   }
   ```

3. Register in `modules/parsers/index.ts`

**Option 2: Legacy Parser** (simpler, but less maintainable)

1. Create parser service in `shared/services/` (e.g., `monobankParser.ts`)
2. Export interface matching:

   ```typescript
   export interface ParsedTransaction {
     date: Date;
     description: string;
     amount: number; // absolute value
     currency: string;
     type: "income" | "expense";
     hash: string;
   }

   export async function parseXXXPDF(buffer: Buffer): Promise<{
     period: string;
     transactions: ParsedTransaction[];
   }>;
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
