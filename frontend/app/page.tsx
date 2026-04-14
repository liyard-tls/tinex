import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          TineX
        </h1>
        <p className="text-xl text-muted-foreground">
          Your Personal Finance Manager
        </p>
        <p className="text-sm text-muted-foreground">
          Track transactions, manage budgets, and gain insights into your spending habits
        </p>

        <div className="flex gap-4 justify-center mt-8">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
          <Link
            href="/auth"
            className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <FeatureCard
            title="Track Transactions"
            description="Import from multiple banks and track all your expenses in one place"
          />
          <FeatureCard
            title="Smart Analytics"
            description="Visualize spending patterns with interactive charts and insights"
          />
          <FeatureCard
            title="Budget Management"
            description="Set budgets by category and stay on track with real-time alerts"
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-lg bg-card border border-border">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
