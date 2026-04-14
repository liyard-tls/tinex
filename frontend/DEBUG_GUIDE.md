# Debug Guide for PDF Parser in Browser

## Current Status

✅ **Tests Pass**: All 14 tests pass (parser works in test environment)
❌ **Browser Fails**: Parser fails when called via API in browser

## The Problem

The error occurs in Next.js runtime (webpack) when the API route tries to parse the PDF:
```
Error parsing Trustee PDF: Failed to parse PDF file
```

## Recent Fix Applied

Updated `next.config.js` to exclude `pdf-parse` from webpack bundling:

```javascript
webpack: (config, { isServer }) => {
  if (isServer) {
    config.externals = config.externals || [];
    config.externals.push('pdf-parse', 'canvas');
  }
  return config;
}
```

## Step-by-Step Debugging

### Step 1: Start Fresh Dev Server

```bash
# Kill any existing dev server
pkill -f "next dev"

# Start dev server
npm run dev
```

**Important**: The server MUST be restarted after changing `next.config.js`

### Step 2: Check Server Console

When you upload a PDF, watch the **terminal where dev server is running**. You should see console.log output:

```
PDF parse function type: function
Buffer type: true
Buffer length: 68456
PDF parsed successfully
Text length: 1726
```

If you see errors instead, note the exact error message.

### Step 3: Test in Browser

1. Navigate to http://localhost:3000/import
2. Select an account
3. Upload `trustee_statement.pdf`
4. Click "Parse File"
5. Watch BOTH:
   - Browser console (F12 → Console)
   - Server terminal console

### Step 4: Check What Failed

Look for console output:

**If you see**:
```
PDF parse function type: object
```
→ The module is not loading correctly. The externals config didn't work.

**If you see**:
```
PDF parse function type: function
Buffer type: false
```
→ The File object isn't being converted to Buffer properly.

**If you see**:
```
Error parsing Trustee PDF: InvalidPDFException
```
→ The PDF structure isn't recognized by pdf-parse.

### Step 5: Alternative Test Methods

#### Method A: Direct Node Test
```bash
node -e "const pdf = require('pdf-parse'); const fs = require('fs'); const buf = fs.readFileSync('trustee_statement.pdf'); pdf(buf).then(d => console.log('SUCCESS:', d.text.length)).catch(e => console.log('ERROR:', e.message));"
```

Expected: `SUCCESS: 1726`

#### Method B: Run Jest Tests
```bash
npm test -- trusteeParser.test.ts
```

Expected: All 10 tests pass

#### Method C: API Test (requires dev server running)
```bash
# Install dependencies first
npm install form-data node-fetch

# Run test
node test-api.js
```

## Common Issues & Solutions

### Issue 1: "pdf is not a function"

**Cause**: Webpack is bundling pdf-parse incorrectly
**Solution**: Verify `next.config.js` has the webpack externals configuration
**Verify**: Restart dev server after changing config

### Issue 2: "Invalid PDF structure"

**Cause**: Buffer conversion problem or corrupted PDF
**Solution**:
1. Check console logs show `Buffer type: true`
2. Verify PDF file isn't corrupted: `file trustee_statement.pdf` should show "PDF document"

### Issue 3: Module resolution errors

**Cause**: Next.js can't find pdf-parse module
**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### Issue 4: Different error in production vs development

**Cause**: Next.js handles modules differently in dev vs production
**Test production build**:
```bash
npm run build
npm run start
# Then test on http://localhost:3000
```

## Quick Verification Checklist

- [ ] `pdf-parse@1.1.1` in package.json
- [ ] Webpack externals in next.config.js
- [ ] Dev server restarted after config change
- [ ] Tests pass: `npm test`
- [ ] Direct node test works
- [ ] Server console shows detailed logs
- [ ] PDF file exists and is valid

## If Still Failing

### Get Detailed Error Info

The parser now throws the original error with full details. Check the server console for:

```
Error name: InvalidPDFException
Error message: Invalid PDF structure
Error stack: <full stack trace>
```

### Try Alternative PDF Library

If pdf-parse@1.1.1 still doesn't work in Next.js, we can try:

**Option 1**: Use pdf-lib (different library)
```bash
npm install pdf-lib
```

**Option 2**: Use external service (upload to cloud function)

**Option 3**: Process PDFs before upload (client-side with pdf.js)

## Expected Working Flow

1. User uploads PDF → FormData created
2. Fetch POST to `/api/parse-pdf` → FormData sent
3. API route receives File object
4. Convert to Buffer: `Buffer.from(await file.arrayBuffer())`
5. Call `parseTrusteePDF(buffer)`
6. pdf-parse extracts text
7. Regex parses transactions
8. Return JSON to client
9. Client displays transactions

## Next Steps

1. **Restart dev server** (critical!)
2. **Upload PDF and check server console**
3. **Report exact error message** from server console
4. **Verify file upload** works (check FormData in Network tab)

## Debug Logs Added

The parser now has detailed console.log statements at each step:

```typescript
// In trusteeParser.ts
console.log('PDF parse function type:', typeof pdf);  // Should be 'function'
console.log('Buffer type:', fileBuffer instanceof Buffer);  // Should be true
console.log('Buffer length:', fileBuffer?.length);  // Should be ~68000
console.log('PDF parsed successfully');  // Confirms parsing worked
console.log('Text length:', data.text?.length);  // Should be 1726
```

Watch for these in the server terminal!

## Files to Check

- [shared/services/trusteeParser.ts](shared/services/trusteeParser.ts) - Parser with debug logs
- [app/api/parse-pdf/route.ts](app/api/parse-pdf/route.ts) - API endpoint
- [next.config.js](next.config.js) - Webpack configuration
- [package.json](package.json) - Verify pdf-parse@1.1.1

## Success Criteria

When working, you should see in server console:
```
PDF parse function type: function
Buffer type: true
Buffer length: 68456
PDF parsed successfully
Text length: 1726
```

And in browser: Preview showing 15 transactions.
