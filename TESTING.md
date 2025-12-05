# Testing Guide for TineX

## 📊 Поточний стан тестування

**Статистика:**
- ✅ **84 тести проходять** (100%)
- ❌ **0 тестів провалюються**
- 📦 **5 тестових файлів**
- ⏱️ **~1.5 секунди** час виконання

---

## 🧪 Що покрито тестами

### ✅ Currency Service (15 тестів)
**Файл:** `__tests__/services/currencyService.test.ts`

Тестує форматування валют:
- USD, EUR, GBP, UAH, CAD, AUD, SGD, CHF, JPY, CNY
- Спеціальна логіка для JPY (без копійок)
- Edge cases (zero, negative, великі суми)

```bash
npm test currencyService
```

---

### ✅ Budget Utils (30 тестів)
**Файл:** `__tests__/modules/budgets/budgetUtils.test.ts`

Тестує:
- `getCurrentPeriodDates()` - розрахунок дат (день/тиждень/місяць/рік)
- `getPeriodLabel()` - мітки періодів
- `calculateBudgetProgress()` - прогрес у відсотках
- `getProgressColor()` - колір (зелений→жовтий→помаранчевий→червоний)
- `formatPeriodRange()` - форматування діапазону дат
- `getDaysRemaining()` - залишок днів

```bash
npm test budgetUtils
```

---

### ✅ Spending Trend Analyzer (26 тестів)
**Файл:** `__tests__/modules/analytics/SpendingTrendAnalyzer.test.ts`

Тестує аналіз витрат:
- `analyzeSpendingTrend()` - тренди (зростаючий/спадаючий/стабільний)
- `findPeakWeek()` - пік витрат
- `calculateRecentTrend()` - порівняння останніх 4 тижнів

```bash
npm test SpendingTrendAnalyzer
```

---

### ✅ Trustee Bank Parser (11 тестів)
**Файл:** `__tests__/services/trusteeParser.test.ts`

Тестує парсинг PDF виписок Trustee Bank:
- Витягування періоду та номера картки
- Парсинг транзакцій
- Правильність дат та сум
- Генерація унікальних хешів

```bash
npm test trusteeParser
```

---

### ✅ Privat Bank Parser (11 тестів)
**Файл:** `__tests__/services/privatParser.test.ts`

Тестує парсинг PDF виписок ПриватБанку (те саме, що Trustee Parser).

```bash
npm test privatParser
```

---

## 🚀 Команди

### Основні команди
```bash
# Запустити всі тести
npm test

# Запустити конкретний тест
npm test currencyService
npm test budgetUtils

# З coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

---

## 🤖 GitHub Actions CI/CD

**Файл:** `.github/workflows/test.yml`

Автоматично запускається при push/PR до `main` або `develop`:

1. ✅ Lint (ESLint)
2. ✅ Type check (TypeScript)
3. ✅ Tests (Jest)
4. ✅ Build (Next.js)

**Результат в GitHub:**
```
✅ All checks passed
   ├─ lint: passed
   ├─ type-check: passed
   ├─ test: passed (84/84)
   └─ build: passed
```

---

## 📝 Додавання нових тестів

```typescript
// __tests__/path/myFunction.test.ts
import { describe, test, expect } from '@jest/globals';
import { myFunction } from '@/path/to/function';

describe('My Function', () => {
  test('does something correctly', () => {
    const result = myFunction(100);
    expect(result).toBe(200);
  });
});
```

---

## ❌ Що НЕ покрито

1. **Monobank Parser** - немає тестів
2. **Currency API** - async функції складно тестувати
3. **Repositories** - потребують Firebase моків
4. **React Components** - не критично для unit тестів

---

## 📊 Coverage

Після `npm test -- --coverage` відкрийте:

```
coverage/lcov-report/index.html
```

**Поточне покриття:**
- Statements: ~45%
- Functions: ~35%

**Мета:** 70%+ для критичної логіки

---

## ✅ Best Practices

1. **Один test = один сценарій**
2. **Описові назви тестів**
3. **Тестуйте edge cases** (zero, null, empty, великі числа)
4. **Arrange-Act-Assert** pattern

```typescript
test('example', () => {
  // Arrange
  const input = 100;

  // Act
  const result = myFunction(input);

  // Assert
  expect(result).toBe(200);
});
```

---

**Оновлено:** 2025-12-05
