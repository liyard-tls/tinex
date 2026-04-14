# TineX - Personal Finance Manager

A modern, cross-platform finance application built with Next.js and Firebase. Track transactions, manage budgets, and gain insights into your spending habits with ease.

## Features

- **Transaction Management**: Import and track transactions from multiple sources
- **Budget Tracking**: Set and monitor budgets by category
- **Smart Analytics**: Visualize spending patterns with interactive charts
- **Multi-Bank Import**: Modular parser system for importing statements from different banks
- **Dark UI**: Minimalistic, mobile-first dark interface
- **Real-time Sync**: Firebase integration for cross-device synchronization

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: TailwindCSS (Dark theme by default)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **Date Handling**: date-fns
- **CSV Parsing**: PapaParse

## Project Structure

```
tinex/
├── app/                    # Next.js App Router
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard
│   ├── transactions/      # Transaction management
│   ├── budgets/           # Budget management
│   ├── categories/        # Category management
│   ├── settings/          # User settings
│   └── api/               # API routes
├── core/                  # Core business logic
│   ├── models/           # Data models & types
│   ├── services/         # Business logic services
│   └── repositories/     # Firebase data access layer
├── modules/              # Feature modules
│   ├── transactions/     # Transaction module
│   ├── dashboard/        # Dashboard module
│   ├── budgets/          # Budget module
│   ├── categories/       # Category module
│   ├── import/           # Import/export module
│   └── parsers/          # Bank statement parsers ⭐
│       ├── core/         # Parser infrastructure
│       ├── implementations/ # Bank-specific parsers
│       └── utils/        # Parser utilities
├── shared/               # Shared utilities
│   ├── components/       # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Helper functions
│   └── config/           # App configuration
└── lib/                  # External integrations
    └── firebase.ts       # Firebase configuration
```

## Modular Parser Architecture

The app features a **plug-and-play parser system** for importing bank statements:

### Adding a New Bank Parser

1. Create a new parser in `modules/parsers/implementations/csv/`
2. Implement the `BankParser` interface
3. Register it in `modules/parsers/index.ts`

Example:
```typescript
import { BankParser } from '../../core/ParserInterface';

export class MyBankParser implements BankParser {
  readonly id = 'mybank-csv';
  readonly name = 'My Bank CSV Parser';
  readonly bankName = 'My Bank';
  readonly supportedFormats = ['csv'];

  async supports(file: File): Promise<boolean> {
    // Check if file is compatible
  }

  async parse(file: File): Promise<ParsedTransaction[]> {
    // Parse the file
  }

  validate(transactions: ParsedTransaction[]): ValidationResult {
    // Validate transactions
  }

  getFormatDescription(): string {
    return 'My Bank CSV format: Date, Amount, Description';
  }
}
```

## Getting Started

### Prerequisites

- Node.js 18+ (currently using 18.19.1)
- npm or yarn
- Firebase project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tinex
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication, Firestore, and Storage
   - Copy your Firebase config

4. Configure environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Firebase credentials:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Key Design Patterns

- **Modular Architecture**: Each feature is self-contained
- **Registry Pattern**: Dynamic parser registration
- **Factory Pattern**: Parser instantiation
- **Repository Pattern**: Data access abstraction
- **Composition**: Reusable UI components

## Core Models

- **Transaction**: Individual financial transactions
- **Category**: Expense/income categories
- **Budget**: Budget tracking by category
- **ImportSource**: Import source configuration
- **ImportJob**: Import job tracking
- **User**: User profile and preferences

## Roadmap

- [ ] Complete authentication flow
- [ ] Implement dashboard with charts
- [ ] Add transaction CRUD operations
- [ ] Build budget management
- [ ] Create category management
- [ ] Implement CSV import flow
- [ ] Add PDF parser support
- [ ] API integration (Plaid, etc.)
- [ ] Export functionality
- [ ] PWA support
- [ ] Mobile app (React Native)

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.
