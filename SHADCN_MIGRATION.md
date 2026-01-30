# shadcn/ui Migration Guide

## 📋 Огляд

Міграція TineX UI на shadcn/ui - сучасну, доступну та кастомізовану бібліотеку компонентів на базі Radix UI та Tailwind CSS.

## ✅ Встановлено

### Залежності
```bash
npm install clsx tailwind-merge class-variance-authority lucide-react
npm install @radix-ui/react-slot @radix-ui/react-separator @radix-ui/react-scroll-area @radix-ui/react-dialog
```

### Створені shadcn компоненти

#### `components/ui/button.tsx`
- Повна підтримка варіантів: default, destructive, outline, secondary, ghost, link
- Розміри: sm, default, lg, icon
- Accessibility з focus-visible rings
- Підтримка `asChild` для композиції

#### `components/ui/card.tsx`
- Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- Модульні sub-компоненти для гнучкості
- Закруглені кути (rounded-xl) для сучасного вигляду

#### `components/ui/badge.tsx`
- Варіанти: default, secondary, destructive, outline
- Компактні теги/labels

#### `components/ui/separator.tsx`
- Горизонтальні та вертикальні роздільники
- Використовує Radix UI для accessibility

#### `components/ui/sheet.tsx`
- Бічна панель (side sheet/drawer)
- Варіанти позиції: top, bottom, left, right
- Backdrop overlay
- Плавні анімації slide-in/slide-out
- Автоматичне закриття на overlay click

### Utility файли

#### `lib/utils.ts`
- `cn()` функція для умовного об'єднання className
- Використовує `clsx` + `tailwind-merge` для оптимального об'єднання

## 🎨 Міграція сторінки /transactions

### Що змінилось

**До (старі компоненти):**
```tsx
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/utils/cn';

// Custom side panel з backdrop
<div className="fixed inset-0 bg-black/50 z-50" onClick={...} />
<div className="fixed right-0 top-0 bottom-0 w-80 bg-background ...">
```

**Після (shadcn/ui):**
```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

// Radix Sheet component
<Sheet open={showCategorySheet} onOpenChange={setShowCategorySheet}>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Change Category</SheetTitle>
      <SheetDescription>{selectedTransaction.description}</SheetDescription>
    </SheetHeader>
    {/* content */}
  </SheetContent>
</Sheet>
```

### Ключові покращення

1. **Accessibility ✅**
   - Всі компоненти Radix UI мають вбудовану accessibility
   - Proper ARIA labels, keyboard navigation, focus management

2. **Consistency 🎯**
   - Уніфікований design language
   - Передбачувані варіанти компонентів

3. **Loading States 🔄**
   - Використання `Loader2` з lucide-react з анімацією spin
   - Краща UX під час завантаження

4. **Better Layout 📐**
   - Container з max-width для великих екранів
   - Responsive padding та spacing
   - Separator для візуального розділення групів

5. **Enhanced Badges 🏷️**
   - Використання `<Badge>` для фільтрів, статусів
   - Outline варіант для "Current" indicator

## 🎨 Міграція сторінки /dashboard

### Що змінилось

**До (старі компоненти):**
```tsx
import { Button } from '@/shared/components/ui';
import { Card, CardContent } from '@/shared/components/ui/Card';
import Modal from '@/shared/components/ui/Modal';
import HorizontalScrollContainer from '@/shared/components/ui/HorizontalScrollContainer';

// Custom modal
<Modal isOpen={showAddTransaction} onClose={...} title="Add Transaction">
  <AddTransactionForm ... />
</Modal>

// Custom horizontal scroll
<HorizontalScrollContainer>
  <div className="flex gap-3 min-w-min">
    {accounts.map(...)}
  </div>
</HorizontalScrollContainer>
```

**Після (shadcn/ui):**
```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// Radix Dialog component
<Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Add Transaction</DialogTitle>
    </DialogHeader>
    <AddTransactionForm ... />
  </DialogContent>
</Dialog>

// Radix ScrollArea component
<ScrollArea className="w-full whitespace-nowrap">
  <div className="flex gap-3 pb-4">
    {accounts.map(...)}
  </div>
</ScrollArea>
```

### Ключові покращення

1. **Dialog замість Modal 📱**
   - Radix Dialog з accessibility
   - Auto focus management
   - Escape key handling
   - Backdrop click to close

2. **ScrollArea для горизонтального скролу 📜**
   - Native-like scrollbar styling
   - Touch-friendly
   - Автоматичне приховування scrollbar

3. **Краща Balance Card 💰**
   - Gradient backgrounds з border
   - Badge для currency indicator
   - Responsive grid для stats

4. **Quick Actions покращено 🚀**
   - Backdrop для quick actions menu
   - Button variants замість custom styled buttons
   - Shadow та hover effects

5. **Improved Account Cards 🏦**
   - ScrollArea замість custom HorizontalScrollContainer
   - Hover effects з transition
   - Cleaner spacing

## 📊 Статистика Build

**До міграції:**
- `/transactions`: ~235 kB First Load JS
- `/dashboard`: ~249 kB First Load JS

**Після міграції:**
- `/transactions`: 248 kB First Load JS (+13kB)
- `/dashboard`: 266 kB First Load JS (+17kB)
- Трохи більше через Radix UI, але набагато більше функцій та accessibility

## 🗺️ План подальшої міграції

### Пріоритет 1: Core Pages
- [x] `/transactions` - ✅ Завершено
- [x] `/dashboard` - ✅ Завершено
- [ ] `/accounts` - список рахунків
- [ ] `/analytics` - графіки та аналітика

### Пріоритет 2: Forms & Modals
- [ ] AddTransactionForm
- [ ] AddAccountForm
- [ ] AddCategoryForm
- [ ] Settings forms

### Пріоритет 3: Lists & Details
- [ ] TransactionListItem (оновити стилі)
- [ ] `/transactions/[id]` - деталі транзакції
- [ ] `/accounts/[id]` - деталі рахунку

### Додаткові shadcn компоненти для встановлення

```bash
# Forms
npx shadcn@latest add form input textarea checkbox radio-group switch label

# Data Display
npx shadcn@latest add table avatar progress tooltip

# Navigation
npx shadcn@latest add dropdown-menu tabs

# Feedback
npx shadcn@latest add alert dialog toast

# Overlays
npx shadcn@latest add popover

# Date/Time
npx shadcn@latest add calendar
```

## 🎨 Theme Customization

Shadcn використовує CSS variables для тем. Наші кольори в `app/globals.css`:

```css
@layer base {
  :root {
    --background: 222.2 84% 4.9%; /* Dark background */
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --primary: 217.2 91.2% 59.8%; /* Blue */
    --secondary: 217.2 32.6% 17.5%;
    /* ... etc */
  }
}
```

## 📝 Best Practices

1. **Імпорти компонентів**
   ```tsx
   // ✅ Good - з shadcn
   import { Button } from '@/components/ui/button';

   // ❌ Old - зі старих компонентів
   import { Button } from '@/shared/components/ui';
   ```

2. **Використання варіантів**
   ```tsx
   // Button variants
   <Button variant="default">Primary</Button>
   <Button variant="outline">Secondary</Button>
   <Button variant="ghost">Subtle</Button>
   <Button variant="destructive">Delete</Button>

   // Button sizes
   <Button size="sm">Small</Button>
   <Button size="default">Default</Button>
   <Button size="lg">Large</Button>
   <Button size="icon"><Icon /></Button>
   ```

3. **Композиція з Card**
   ```tsx
   <Card>
     <CardHeader>
       <CardTitle>Title</CardTitle>
       <CardDescription>Description</CardDescription>
     </CardHeader>
     <CardContent>
       {/* Main content */}
     </CardContent>
     <CardFooter>
       {/* Actions */}
     </CardFooter>
   </Card>
   ```

4. **Sheet для side panels**
   ```tsx
   const [open, setOpen] = useState(false);

   <Sheet open={open} onOpenChange={setOpen}>
     <SheetTrigger asChild>
       <Button>Open</Button>
     </SheetTrigger>
     <SheetContent side="right">
       <SheetHeader>
         <SheetTitle>Panel Title</SheetTitle>
         <SheetDescription>Description</SheetDescription>
       </SheetHeader>
       {/* Content */}
     </SheetContent>
   </Sheet>
   ```

## 🚀 Наступні кроки

1. **Оновити Dashboard** - головна сторінка з картками статистики
2. **Додати Form компоненти** - react-hook-form + zod + shadcn/ui forms
3. **Створити загальні Layout компоненти** - PageHeader, PageContent
4. **Додати Dialog** для модальних вікон
5. **Додати Toast** для notifications

## 📚 Ресурси

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [Tailwind CSS](https://tailwindcss.com)
- [Class Variance Authority](https://cva.style)

---

**Створено:** 2025-12-14
**Оновлено:** 2025-12-14
**Статус:** 🟢 В процесі (2/15 сторінок)
