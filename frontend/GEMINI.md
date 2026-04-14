# GEMINI.md - TineX Personal Finance Manager

This document provides a development context for the TineX project, a personal finance manager built with Next.js and Firebase.

## Project Overview

TineX is a modern, cross-platform finance application designed for tracking transactions, managing budgets, and analyzing spending habits. It features a modular architecture, particularly for importing bank statements from various sources. The application is built with a mobile-first dark UI and is a Progressive Web App (PWA).

**Key Technologies:**

*   **Frontend:** Next.js 14 (App Router), React 18, TypeScript
*   **Styling:** TailwindCSS
*   **Database:** Firebase Firestore
*   **Authentication:** Firebase Auth
*   **Storage:** Firebase Storage
*   **Data Fetching & State Management:** React Hook Form, Zod for validation
*   **Charts:** Recharts
*   **CSV Parsing:** PapaParse
*   **PDF Parsing:** pdf-parse

**Architecture:**

*   **Monorepo-like structure:** with code organized into `app`, `core`, `modules`, and `shared` directories.
*   **Modular Parser Architecture:** A key feature is the plug-and-play system for bank statement parsers, located in `modules/parsers`. This allows for easy extension to support new banks and formats. There is also a legacy PDF parser system.
*   **Repository Pattern:** Data access is abstracted through repositories in `core/repositories`, which handle interactions with Firebase. Direct access to Firestore from components is discouraged.
*   **Clean Separation of Concerns:** Business logic is separated from UI components, with core logic in the `core` directory and feature-specific modules in the `modules` directory.

## Building and Running

### Prerequisites

*   Node.js v18+
*   npm or yarn
*   A Firebase project

### Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Configure environment variables:**
    *   Copy the example environment file: `cp .env.example .env.local`
    *   Populate `.env.local` with your Firebase project credentials.

### Development

*   **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at [http://localhost:3000](http://localhost:3000).

### Key Scripts

*   `npm run dev`: Starts the development server.
*   `npm run build`: Creates a production build.
*   `npm run start`: Starts the production server.
*   `npm run lint`: Lints the codebase using ESLint.
*   `npm run type-check`: Runs the TypeScript compiler to check for type errors.
*   `npm test`: Runs tests using Jest.

## Development Conventions

*   **TypeScript:** The project is written entirely in TypeScript. Avoid using the `any` type.
*   **ESLint:** Code is formatted and linted according to the rules in `.eslintrc.json`.
*   **Testing:** Jest is used for unit and integration tests. Test files are located in the `__tests__` directory. Currently, there are no automated tests, and the project relies on manual testing.
*   **Modular Design:** New features should be developed as self-contained modules.
*   **Parser Development:** To add a new bank parser, create a class that implements the `BankParser` interface (from `modules/parsers/core/ParserInterface.ts`) and register it in `modules/parsers/index.ts`.
*   **Firebase Collections**: All collection names are defined in `shared/config/constants.ts`. Always use these constants.
*   **Form Handling**: Use `react-hook-form` with Zod for validation.
*   **Component Patterns**: The project uses several established patterns for modals, inline editing, and side panels.

### Common Pitfalls

*   **`any` type:** Avoid using `any`. Define proper TypeScript interfaces.
*   **CJS Modules:** Some libraries like `pdf-parse` are CommonJS modules and require `require()` instead of `import`.
*   **Date Handling:** Transactions store both date and time. Ensure both are handled correctly.
*   **Repository Method Signatures:** Check the implementation of repository methods before using them. For example, `TransactionRepository.create` takes three arguments.
*   **PWA Manifest Icons**: Do not combine `"purpose": "any maskable"`. Use separate entries for each purpose.

## Key Files & Directories

*   `README.md`: The main project documentation.
*   `CLAUDE.md`: A detailed guide for AI assistants working on this project.
*   `package.json`: Defines project dependencies and scripts.
*   `next.config.js`: Next.js configuration, including webpack customizations for handling `pdf-parse`.
*   `lib/firebase.ts`: Firebase initialization and configuration.
*   `app/`: The Next.js application, with pages and API routes.
*   `core/`: Core business logic, including models and repositories.
*   `modules/`: Feature-specific components and logic.
*   `shared/`: Reusable components, services, and utilities.
*   `modules/parsers/`: The core of the bank statement import feature. Contains the parser interface, implementations, and utilities.
*   `__tests__/`: Contains the tests for the project.

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
