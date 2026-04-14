import { NextRequest, NextResponse } from 'next/server';

interface ChatRequest {
  message: string;
  financialContext: {
    transactions: Array<{
      type: 'income' | 'expense';
      amount: number; // Amount in base currency
      originalAmount: number; // Original amount
      originalCurrency: string; // Original currency
      categoryName: string;
      date: string;
      description: string;
    }>;
    categories: Array<{
      name: string;
      type: 'income' | 'expense';
    }>;
    accounts: Array<{
      name: string;
      balance: number;
      currency: string;
    }>;
    totalBalance: number;
    baseCurrency: string;
    currentDate: string;
  };
  chatHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

const SYSTEM_PROMPT = `You are a financial assistant for the personal finance manager app TineX.
Your role is to analyze the user's financial data and provide helpful advice.

Core capabilities:
1. Expense analysis by periods (week, month, year)
2. Comparison of expenses between periods
3. Identifying categories with the highest spending
4. Savings and budget optimization tips
5. Simple financial status reports

IMPORTANT about categories:
- "Transfer In" and "Transfer Out" are SYSTEM categories for transfers between the user's own accounts
- Transfers are NOT real income or expenses - they are just movement of money between own accounts
- When calculating real income/expenses, EXCLUDE transactions with "Transfer In" and "Transfer Out" categories
- Example: a transfer from a card to a savings account is Transfer Out from the card and Transfer In to savings

Rules:
- ALWAYS respond in the same language the user writes in (detect language from their message)
- Be CONCISE - keep responses short and to the point, avoid unnecessary words
- Use bullet points and lists instead of long paragraphs
- Be specific and use real numbers from the user's data
- Format responses for easy reading (use markdown: **bold**, *italic*, lists, ### headings)
- If there is insufficient data, say so
- Do not make up data that doesn't exist
- Be positive and motivating
- When analyzing expenses, always exclude transfers between accounts`;

/**
 * POST /api/chat
 * Sends a message to Gemini AI with financial context
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body: ChatRequest = await request.json();
    const { message, financialContext, chatHistory } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build context message with financial data
    const contextMessage = buildContextMessage(financialContext);

    // Build conversation history for Gemini
    const contents = [
      {
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: 'model',
        parts: [{ text: 'Understood! I am ready to help analyze your finances. I will respond in the same language you use.' }],
      },
      {
        role: 'user',
        parts: [{ text: `Here is my current financial data:\n\n${contextMessage}` }],
      },
      {
        role: 'model',
        parts: [{ text: 'Thank you for the data! I can now analyze your finances. How can I help you?' }],
      },
    ];

    // Add chat history
    for (const msg of chatHistory.slice(-10)) { // Last 10 messages for context
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // Call Gemini API with retry logic for rate limits
    // Using current Gemini models (2025)
    const models = [
      { version: 'v1beta', name: 'gemini-2.5-flash-lite' },  // Smallest, best free tier limits
      { version: 'v1beta', name: 'gemini-2.5-flash' },       // Fast with 1M context
      { version: 'v1beta', name: 'gemini-2.5-pro' },         // Most capable
    ];
    let lastError: unknown = null;
    let aiResponseText: string | null = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/${model.version}/models/${model.name}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiResponseText) {
            console.log(`Success with model: ${model.name} (${model.version})`);
            break; // Success!
          }
        } else {
          const errorData = await response.json();
          console.error(`Gemini API error (${model.version}/${model.name}):`, errorData);
          lastError = errorData;

          // If rate limited, wait and try same model again
          if (response.status === 429) {
            const retryAfter = errorData.error?.details?.find(
              (d: { retryDelay?: string }) => d.retryDelay
            )?.retryDelay;
            if (retryAfter) {
              const waitMs = parseFloat(retryAfter) * 1000 || 5000;
              if (waitMs <= 20000) { // Only wait up to 20 seconds
                console.log(`Rate limited, waiting ${waitMs}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
                // Retry same model once
                const retryResponse = await fetch(
                  `https://generativelanguage.googleapis.com/${model.version}/models/${model.name}:generateContent?key=${apiKey}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } }),
                  }
                );
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  aiResponseText = retryData.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (aiResponseText) {
                    console.log(`Success with model after retry: ${model.name}`);
                    break;
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error calling ${model.version}/${model.name}:`, err);
        lastError = err;
      }
    }

    if (!aiResponseText) {
      console.error('All Gemini models failed. Last error:', lastError);
      return NextResponse.json(
        { success: false, error: 'AI service temporarily unavailable. Please try again in a few seconds.' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      response: aiResponseText,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Build a context message with financial data for the AI
 */
function buildContextMessage(context: ChatRequest['financialContext']): string {
  const { transactions, accounts, totalBalance, baseCurrency, currentDate } = context;

  let message = `📅 Current date: ${currentDate}\n`;
  message += `💰 Total balance: ${totalBalance.toFixed(2)} ${baseCurrency}\n\n`;

  // Accounts summary
  if (accounts.length > 0) {
    message += '🏦 Accounts:\n';
    for (const acc of accounts) {
      message += `  - ${acc.name}: ${acc.balance.toFixed(2)} ${acc.currency}\n`;
    }
    message += '\n';
  }

  // Helper to detect transfer categories
  const isTransfer = (categoryName: string) =>
    categoryName.toLowerCase().includes('transfer in') ||
    categoryName.toLowerCase().includes('transfer out');

  // Recent transactions summary (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentTransactions = transactions.filter(
    (t) => new Date(t.date) >= thirtyDaysAgo
  );

  if (recentTransactions.length > 0) {
    // Calculate totals by category (excluding transfers)
    const expensesByCategory: Record<string, number> = {};
    const incomeByCategory: Record<string, number> = {};
    let totalExpenses = 0;
    let totalIncome = 0;
    let totalTransfers = 0;

    for (const t of recentTransactions) {
      if (isTransfer(t.categoryName)) {
        totalTransfers += t.amount;
        continue; // Skip transfers in income/expense calculations
      }

      if (t.type === 'expense') {
        totalExpenses += t.amount;
        expensesByCategory[t.categoryName] = (expensesByCategory[t.categoryName] || 0) + t.amount;
      } else {
        totalIncome += t.amount;
        incomeByCategory[t.categoryName] = (incomeByCategory[t.categoryName] || 0) + t.amount;
      }
    }

    message += `📊 Last 30 days (excluding transfers between accounts):\n`;
    message += `  💵 Real income: ${totalIncome.toFixed(2)} ${baseCurrency}\n`;
    message += `  💸 Real expenses: ${totalExpenses.toFixed(2)} ${baseCurrency}\n`;
    message += `  📈 Difference: ${(totalIncome - totalExpenses).toFixed(2)} ${baseCurrency}\n`;
    if (totalTransfers > 0) {
      message += `  🔄 Transfers between accounts: ${totalTransfers.toFixed(2)} ${baseCurrency}\n`;
    }
    message += '\n';

    // Top expense categories (excluding transfers)
    const sortedExpenses = Object.entries(expensesByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (sortedExpenses.length > 0) {
      message += '🔝 Top expense categories:\n';
      for (const [category, amount] of sortedExpenses) {
        const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : '0';
        message += `  - ${category}: ${amount.toFixed(2)} ${baseCurrency} (${percentage}%)\n`;
      }
      message += '\n';
    }

    // Top income categories (excluding transfers)
    const sortedIncome = Object.entries(incomeByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    if (sortedIncome.length > 0) {
      message += '💰 Top income categories:\n';
      for (const [category, amount] of sortedIncome) {
        message += `  - ${category}: ${amount.toFixed(2)} ${baseCurrency}\n`;
      }
      message += '\n';
    }
  } else {
    message += '📊 No transactions in the last 30 days\n\n';
  }

  // All-time statistics
  if (transactions.length > 0) {
    const allTimeExpensesByCategory: Record<string, { total: number; count: number }> = {};
    const allTimeIncomeByCategory: Record<string, { total: number; count: number }> = {};
    let allTimeExpenses = 0;
    let allTimeIncome = 0;

    // Find date range
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;

    for (const t of transactions) {
      const transactionDate = new Date(t.date);
      if (!oldestDate || transactionDate < oldestDate) oldestDate = transactionDate;
      if (!newestDate || transactionDate > newestDate) newestDate = transactionDate;

      if (isTransfer(t.categoryName)) continue;

      if (t.type === 'expense') {
        allTimeExpenses += t.amount;
        if (!allTimeExpensesByCategory[t.categoryName]) {
          allTimeExpensesByCategory[t.categoryName] = { total: 0, count: 0 };
        }
        allTimeExpensesByCategory[t.categoryName].total += t.amount;
        allTimeExpensesByCategory[t.categoryName].count += 1;
      } else {
        allTimeIncome += t.amount;
        if (!allTimeIncomeByCategory[t.categoryName]) {
          allTimeIncomeByCategory[t.categoryName] = { total: 0, count: 0 };
        }
        allTimeIncomeByCategory[t.categoryName].total += t.amount;
        allTimeIncomeByCategory[t.categoryName].count += 1;
      }
    }

    // Calculate period in days and weeks
    const periodDays = oldestDate && newestDate
      ? Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 1;
    const periodWeeks = Math.max(1, periodDays / 7);

    message += `📊 ALL-TIME STATISTICS (${periodDays} days of data):\n`;
    message += `  💵 Total income: ${allTimeIncome.toFixed(2)} ${baseCurrency}\n`;
    message += `  💸 Total expenses: ${allTimeExpenses.toFixed(2)} ${baseCurrency}\n`;
    message += `  📅 Period: ${oldestDate?.toLocaleDateString()} - ${newestDate?.toLocaleDateString()}\n\n`;

    // All-time expense categories with weekly averages
    const allTimeSortedExpenses = Object.entries(allTimeExpensesByCategory)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        weeklyAvg: data.total / periodWeeks,
        percentage: allTimeExpenses > 0 ? (data.total / allTimeExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    if (allTimeSortedExpenses.length > 0) {
      message += '📈 ALL-TIME EXPENSES BY CATEGORY (with weekly averages):\n';
      for (const { category, total, count, weeklyAvg, percentage } of allTimeSortedExpenses) {
        message += `  - ${category}: ${total.toFixed(2)} ${baseCurrency} (${percentage.toFixed(1)}%) | ${count} transactions | ~${weeklyAvg.toFixed(2)} ${baseCurrency}/week\n`;
      }
      message += '\n';
    }

    // All-time income categories
    const allTimeSortedIncome = Object.entries(allTimeIncomeByCategory)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
      }))
      .sort((a, b) => b.total - a.total);

    if (allTimeSortedIncome.length > 0) {
      message += '💰 ALL-TIME INCOME BY CATEGORY:\n';
      for (const { category, total, count } of allTimeSortedIncome) {
        message += `  - ${category}: ${total.toFixed(2)} ${baseCurrency} | ${count} transactions\n`;
      }
      message += '\n';
    }
  }

  message += `📝 Total transactions: ${transactions.length}\n`;

  return message;
}
