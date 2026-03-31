# CLAUDE.md

Automatically use context7 for code generation and library documentation.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TineX is a personal finance management application built with Next.js 14 (App Router), TypeScript, Firebase, and TailwindCSS. It provides transaction tracking, budget management, analytics, and bank statement import capabilities with a dark-themed, mobile-first UI.

## Development Commands

```bash
npm run dev       # Start development server on http://localhost:3000
npm run build     # Build for production
npm run lint      # Run ESLint
npm run type-check
```

**Important**: Always run `npm run build` before considering work complete. The build must succeed without errors.

## Architecture Overview

### Core Design Patterns

1. **Repository Pattern**: All Firestore data access goes through repository classes in `core/repositories/`. Never use Firestore directly in components.

2. **Repository Method Signature**: Transaction creation follows a specific pattern:
   ```typescript
   // CORRECT: TransactionRepository.create takes 3 separate arguments
   transactionRepository.create(userId, createInput, currency);
   ```

3. **Model Layer**: All data models are in `core/models/` and exported through `core/models/index.ts`. Always import models from the index file.

4. **Firebase Integration**: All Firebase configuration is in `lib/firebase.ts`. Use the exported `auth`, `db`, and `storage` instances.

### Directory Structure

```
app/            # Next.js App Router pages (dashboard, transactions, accounts, analytics, import, settings, api)
core/           # models/, repositories/, services/
modules/        # Feature-specific components and business logic (transactions, accounts, analytics, parsers, ...)
shared/         # components/ui/, services/, utils/, config/
```

### Modular Architecture Principles

**IMPORTANT**: Always prefer modular architecture. Create reusable modules instead of implementing logic directly in pages.

**When to create a module:** business logic that could be reused, complex feature UI, related grouped functionality, or code that should be testable in isolation.

**Module structure:**
```
modules/feature-name/
  index.ts              # Public API exports
  FeatureComponent.tsx
  featureLogic.ts
  types.ts              # (if needed)
```

### Key Implementation Details

#### 1. Transaction Time Handling

Transactions store BOTH date AND time. Forms have separate date and time inputs that are combined on submission: `new Date(\`${dateStr}T${timeStr}\`)`.

#### 2. PWA Support

The app is a Progressive Web App with service worker (`public/sw.js`) and manifest (`public/manifest.json`).

**PWA Icon Requirements**: Chrome requires separate icon entries for `"purpose": "any"` and `"purpose": "maskable"` — do NOT combine them.

**Service Worker**: Only cache truly static assets (manifest.json, icons). Don't try to cache Next.js dynamic routes in the install event.

#### 3. Currency Conversion

- Uses `shared/services/currencyService.ts` for all currency operations
- Exchange rates cached for 1 hour; calls `/api/currency` (keeps API key server-side)
- Has fallback rates if API fails; all conversions go through USD

#### 4. Bank Statement Import System

**Two Parser Systems** (historical reasons):

1. **Legacy PDF Parser** (`shared/services/trusteeParser.ts`):
   - Server-side only (uses `pdf-parse` CommonJS module), API route at `/api/parse-pdf`
   - Specific to Trustee bank format; creates hash for duplicate detection

2. **Modular Parser System** (`modules/parsers/`):
   - Registry pattern; supports CSV (PapaParse), XLSX, PDF
   - See `modules/parsers/core/ParserInterface.ts` for interface

**Recommended for new parsers**: Use the modular system in `modules/parsers/`.

**Legacy Trustee PDF Flow** (`app/import/page.tsx`):
1. User selects account and uploads PDF
2. Client sends file to `/api/parse-pdf`; server returns transactions with dates as ISO strings
3. Client converts date strings back to Date objects, previews transactions
4. Import: skip duplicates, create transactions, track in `importedTransactions` collection via `ImportedTransactionRepository`

**Duplicate Prevention**:
- `ImportedTransactionRepository.getImportedHashes()` returns Set of hashes
- Check `existingHashes.has(parsed.hash)` before importing; store hash after successful import
- **IMPORTANT**: `TransactionRepository.delete()` automatically deletes the associated `importedTransactions` record to prevent false duplicate detection

#### 5. Analytics Charts

- Uses Recharts library (`AreaChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`)
- Custom tooltip component with TypeScript interface (not `any`)
- Dynamic coloring based on positive/negative values; week-based navigation

#### 6. Firebase Collections

All collection names defined in `shared/config/constants.ts` as `FIREBASE_COLLECTIONS`. Always use constants, never hardcode collection names.

#### 7. Component Patterns

**Repository Usage in Components**:
```typescript
if (!user) return;
try {
  await repository.create(...);
  await loadData(user.uid); // Reload after mutation
} catch (error) {
  console.error('Failed to...', error);
}
```

**Bulk Data Deletion**:
```typescript
await Promise.all([
  transactionRepository.deleteAllForUser(userId),
  accountRepository.deleteAllForUser(userId),
  // etc.
]);
```

### Common Pitfalls

1. **CommonJS modules**: Use `require()` for `pdf-parse` and other CommonJS modules:
   ```typescript
   // eslint-disable-next-line @typescript-eslint/no-var-requires
   const pdf = require('pdf-parse');
   ```

2. **Repository method signatures**: Check the actual implementation before calling. `TransactionRepository.create` takes 3 arguments, not 1.

3. **PWA manifest icons**: Don't combine purposes like `"purpose": "any maskable"` — Chrome rejects this.

4. **ESLint compliance**: Build fails on unused imports and `any` types. Always fix linting errors before finishing.

## Firebase Data Models

### Transaction
```typescript
{
  userId: string; accountId: string; type: 'income' | 'expense';
  amount: number; currency: string; description: string;
  date: Timestamp; categoryId: string; merchantName?: string;
  tags: string[]; createdAt: Timestamp; updatedAt: Timestamp;
}
```

### ImportedTransaction
```typescript
{
  userId: string; transactionId: string; hash: string;
  source: string; importDate: Timestamp; createdAt: Timestamp;
}
```

### Account
```typescript
{
  userId: string; name: string;
  type: 'cash' | 'bank_account' | 'credit_card' | 'investment' | 'other';
  currency: Currency; balance: number; isDefault: boolean;
  createdAt: Timestamp; updatedAt: Timestamp;
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

**Option 2: Legacy Parser** (simpler, less maintainable)

1. Create parser service in `shared/services/`
2. Export `ParsedTransaction` interface and `parseXXXPDF(buffer: Buffer)` function
3. Update import page and `ImportedTransactionRepository` calls

### Adding a New Page

1. Create `app/[pagename]/page.tsx` with `'use client'` directive
2. Check auth with `onAuthStateChanged`, include `<BottomNav />`, use `pb-20` for bottom nav space
3. Add navigation link in `BottomNav.tsx` or Settings page

## Environment Variables

Set Firebase vars in `.env.local`. Dev fallbacks exist in `lib/firebase.ts`.

## Testing Approach

No automated tests. Manual workflow: `npm run build` → `npm run lint` → test in browser → check Firebase Console.

## Styling Conventions

TailwindCSS dark theme. Use `cn()` from `shared/utils/cn.ts` for conditional classes. Lucide React for icons. Shared components in `shared/components/ui/`.

## Version & Changelog

See `shared/config/version.ts` for version number and `CHANGELOG` array. Update both when releasing. Use `window.__showWhatsNew?.()` in browser console to test the popup.
