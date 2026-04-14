# TineX Architecture Documentation

## Overview

TineX is built with a **modular, scalable architecture** that separates concerns and enables easy feature additions, especially for bank statement parsers.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│                    (Next.js App Router)                      │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │Dashboard │Transactions│ Budgets │Categories│ Settings │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                      Feature Modules                         │
│  ┌──────────────┬──────────────┬────────────────────────┐  │
│  │ Transactions │   Budgets    │  Import/Export Module  │  │
│  └──────────────┴──────────────┴────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Parser Module (Plug & Play)                │    │
│  │  ┌─────────────┬──────────────┬─────────────────┐  │    │
│  │  │ CSV Parsers │ PDF Parsers  │  API Parsers    │  │    │
│  │  │ - Generic   │ - Statement  │  - Plaid        │  │    │
│  │  │ - Chase     │ - Invoice    │  - Yodlee       │  │    │
│  │  │ - Wells     │              │                 │  │    │
│  │  └─────────────┴──────────────┴─────────────────┘  │    │
│  │         Registry → Factory → Interface             │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
│                      (Core Services)                         │
│  ┌──────────────┬──────────────┬───────────────────────┐   │
│  │ Transaction  │   Budget     │    Import Service     │   │
│  │   Service    │   Service    │   Category Service    │   │
│  └──────────────┴──────────────┴───────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   Data Access Layer                          │
│                   (Repositories)                             │
│  ┌──────────────┬──────────────┬───────────────────────┐   │
│  │ Transaction  │   Budget     │    Category Repo      │   │
│  │    Repo      │    Repo      │    User Repo          │   │
│  └──────────────┴──────────────┴───────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│         Firebase (Firestore, Auth, Storage)                 │
└─────────────────────────────────────────────────────────────┘
```

## Module Structure

### 1. Core (`/core`)

Contains business logic and data models independent of UI or frameworks.

```
core/
├── models/              # Data models (TypeScript interfaces)
│   ├── transaction.ts   # Transaction model
│   ├── category.ts      # Category model
│   ├── budget.ts        # Budget model
│   ├── import-source.ts # Import configuration
│   └── user.ts          # User model
├── services/            # Business logic
│   └── [to be implemented]
└── repositories/        # Data access abstractions
    └── [to be implemented]
```

**Key Principle**: No dependencies on UI frameworks or external services.

### 2. Modules (`/modules`)

Feature-specific modules that combine UI, logic, and utilities.

```
modules/
├── transactions/        # Transaction management
├── dashboard/           # Analytics & overview
├── budgets/            # Budget tracking
├── categories/         # Category management
├── import/             # Import/Export features
└── parsers/            # ⭐ Parser System
    ├── core/           # Parser infrastructure
    │   ├── ParserInterface.ts    # Contract for all parsers
    │   ├── ParserRegistry.ts     # Dynamic registration
    │   └── ParserFactory.ts      # Parser instantiation
    ├── implementations/
    │   ├── csv/        # CSV parsers
    │   ├── pdf/        # PDF parsers
    │   └── api/        # API-based parsers
    └── utils/          # Shared parser utilities
        ├── dateNormalizer.ts     # Date parsing
        ├── amountParser.ts       # Amount parsing
        └── categoryDetector.ts   # Auto-categorization
```

### 3. Parser System Architecture

The parser system uses **Registry + Factory + Interface** pattern:

```typescript
// 1. Define Interface (Contract)
interface BankParser {
  id: string;
  name: string;
  supports(file: File): Promise<boolean>;
  parse(file: File): Promise<Transaction[]>;
  validate(transactions: Transaction[]): ValidationResult;
}

// 2. Implement Parser
class ChaseCSVParser implements BankParser {
  // Implementation specific to Chase Bank format
}

// 3. Register Parser
parserRegistry.register(new ChaseCSVParser());

// 4. Use via Factory
const transactions = await ParserFactory.parse(file);
```

**Benefits**:
- **Plug & Play**: Add new banks without touching core code
- **Testable**: Each parser is independently testable
- **Discoverable**: Registry lists all available parsers
- **Flexible**: Supports multiple file formats per bank

### 4. Shared (`/shared`)

Reusable components and utilities used across the app.

```
shared/
├── components/
│   ├── ui/            # Base UI components (Button, Card, Input)
│   ├── layout/        # Layout components (Header, Sidebar)
│   ├── forms/         # Form components
│   └── charts/        # Chart components
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
│   └── cn.ts         # Class name merger
├── config/
│   └── constants.ts  # App-wide constants
└── styles/           # Global styles
```

### 5. App Router (`/app`)

Next.js 14 App Router structure:

```
app/
├── layout.tsx         # Root layout
├── page.tsx          # Home page
├── globals.css       # Global styles
├── auth/             # Authentication
├── dashboard/        # Dashboard page
├── transactions/     # Transactions page
├── budgets/          # Budgets page
├── categories/       # Categories page
├── settings/         # Settings page
└── api/              # API routes
```

## Data Flow

### Transaction Import Flow

```
1. User uploads CSV file
   ↓
2. ParserFactory.parse(file)
   ↓
3. Registry finds compatible parser
   ↓
4. Parser.parse() extracts transactions
   ↓
5. Parser.validate() checks data quality
   ↓
6. CategoryDetector suggests categories
   ↓
7. User reviews & confirms
   ↓
8. TransactionService.createBatch()
   ↓
9. TransactionRepository.save()
   ↓
10. Firebase Firestore
```

### Budget Tracking Flow

```
1. User creates budget for category
   ↓
2. BudgetService validates & saves
   ↓
3. On new transaction:
   ↓
4. BudgetService.checkBudgetProgress()
   ↓
5. If threshold exceeded:
   ↓
6. Notify user (alert/notification)
```

## Design Patterns

### 1. Repository Pattern
Abstracts data access from business logic:
```typescript
interface TransactionRepository {
  findById(id: string): Promise<Transaction>;
  findByUserId(userId: string): Promise<Transaction[]>;
  create(transaction: Transaction): Promise<void>;
  update(transaction: Transaction): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### 2. Factory Pattern
Creates parsers without tight coupling:
```typescript
ParserFactory.parse(file) // Automatically selects parser
ParserFactory.parseWithParser(file, 'chase-csv') // Explicit parser
```

### 3. Registry Pattern
Dynamic registration of parsers:
```typescript
parserRegistry.register(new ChaseParser());
parserRegistry.register(new WellsParser());
const allParsers = parserRegistry.getAllParsers();
```

### 4. Strategy Pattern
Different parsing strategies for different formats:
```typescript
interface ParsingStrategy {
  parse(data: string): Transaction[];
}
```

## Key Technologies

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI | Next.js 14 | Server & Client rendering |
| Styling | TailwindCSS | Utility-first CSS |
| State | React Context | Global state management |
| Forms | React Hook Form | Form handling |
| Validation | Zod | Runtime type validation |
| Database | Firestore | Real-time NoSQL DB |
| Auth | Firebase Auth | Authentication |
| Storage | Firebase Storage | File storage |
| Charts | Recharts | Data visualization |
| Dates | date-fns | Date manipulation |
| CSV | PapaParse | CSV parsing |

## Security Considerations

1. **Authentication**: Firebase Auth with secure token management
2. **Authorization**: Row-level security with Firestore rules
3. **Data Validation**: Zod schemas on client & server
4. **File Upload**: Size limits, type validation, virus scanning
5. **Secrets**: Environment variables, never in code

## Scalability

1. **Code Splitting**: Next.js automatic code splitting
2. **Lazy Loading**: Dynamic imports for heavy modules
3. **Caching**: Firebase built-in caching
4. **CDN**: Vercel Edge Network
5. **Modular Design**: Easy to extract into microservices

## Testing Strategy

```
Unit Tests:
- Parsers (each independently)
- Utilities (date, amount parsing)
- Services (business logic)

Integration Tests:
- Repository → Firebase
- Parser → File processing
- API routes

E2E Tests:
- User workflows (Playwright)
- Import flow
- Budget alerts
```

## Next Steps

1. Implement repositories for Firebase access
2. Build transaction service
3. Create authentication flow
4. Develop dashboard with charts
5. Add more bank-specific parsers
6. Implement budget alerts
7. Add export functionality
8. PWA configuration
