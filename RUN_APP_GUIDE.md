# Quick Start Guide - Running the LENR Academy App

## 🚀 How to Run the Application

### ⚠️ Important: Directory Structure

Your project structure:
```
C:\Users\brand\LENR Academy(CE Branch)\
└── lenr.academy\          ← The actual project directory
    ├── package.json       ← npm commands run from here!
    ├── src\
    ├── dist\
    └── ... (other files)
```

### ✅ Correct Way to Run Commands

**ALWAYS navigate to the `lenr.academy` subdirectory first!**

```powershell
# Navigate to the correct directory
cd "C:\Users\brand\LENR Academy(CE Branch)\lenr.academy"

# Then run npm commands
npm run dev
```

### ❌ Common Mistake

```powershell
# DON'T run from parent directory
cd "C:\Users\brand\LENR Academy(CE Branch)"
npm run dev  # ❌ ERROR: Cannot find package.json
```

**Error you'll see:**
```
npm ERR! enoent Could not read package.json: Error: ENOENT: no such file or directory
```

---

## 📋 Available Commands

### Development Server

```powershell
cd "C:\Users\brand\LENR Academy(CE Branch)\lenr.academy"
npm run dev
```

**Expected Output:**
```
  VITE v5.4.20  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Access the app at:** http://localhost:5173/

---

### Production Build

```powershell
cd "C:\Users\brand\LENR Academy(CE Branch)\lenr.academy"
npm run build
```

**Generates:** Production-ready files in `dist/` directory

---

### Run Tests

```powershell
cd "C:\Users\brand\LENR Academy(CE Branch)\lenr.academy"

# Run all tests
npm test

# Run specific test files
npm test -- fuelProportions.test.ts cascadeEngine.test.ts

# Run tests in CI mode (no watch)
npm test -- --run
```

---

### Linting

```powershell
cd "C:\Users\brand\LENR Academy(CE Branch)\lenr.academy"
npm run lint
```

---

### Preview Production Build

```powershell
cd "C:\Users\brand\LENR Academy(CE Branch)\lenr.academy"
npm run preview
```

**Access preview at:** http://localhost:4173/

---

## 🛠️ Troubleshooting

### Issue: "Cannot find package.json"

**Solution:** You're in the wrong directory!

```powershell
# Check current directory
pwd

# Should show: C:\Users\brand\LENR Academy(CE Branch)\lenr.academy
# If not, navigate there:
cd "C:\Users\brand\LENR Academy(CE Branch)\lenr.academy"
```

---

### Issue: Port Already in Use

**Solution:** Kill the existing process or use a different port

```powershell
# Kill process on port 5173 (dev server)
npx kill-port 5173

# Or run on different port
npm run dev -- --port 5174
```

---

### Issue: Node Modules Missing

**Solution:** Install dependencies

```powershell
cd "C:\Users\brand\LENR Academy(CE Branch)\lenr.academy"
npm install
```

---

## 📦 Verify Installation

```powershell
cd "C:\Users\brand\LENR Academy(CE Branch)\lenr.academy"

# Check Node version
node --version
# Should be: v18.x or higher

# Check npm version
npm --version
# Should be: 9.x or higher

# Verify package.json exists
ls package.json
```

---

## 🎯 Current Project Status

### ✅ All Systems Ready

- ✅ **Tests:** 33/33 passing (100%)
- ✅ **Build:** Successful (production artifacts generated)
- ✅ **Linting:** No new errors introduced
- ✅ **Features:** Weighted fuel proportions fully functional

### Ready to Run

```powershell
# Quick start (copy-paste ready):
cd "C:\Users\brand\LENR Academy(CE Branch)\lenr.academy"; npm run dev
```

---

## 📚 Additional Resources

- **Main Documentation:** `README.md`
- **Development Guide:** `docs/DEVELOPMENT.md`
- **Test Fixes Summary:** `TEST_FIXES_SUMMARY.md`
- **CI Validation:** `CI_VALIDATION_REPORT.md`
- **Quick Start:** `QUICKSTART.md`

---

## 🆘 Still Having Issues?

1. **Verify directory:**
   ```powershell
   cd "C:\Users\brand\LENR Academy(CE Branch)\lenr.academy"
   pwd
   ```

2. **Check package.json exists:**
   ```powershell
   ls package.json
   ```

3. **Reinstall dependencies:**
   ```powershell
   rm -rf node_modules
   rm package-lock.json
   npm install
   ```

4. **Clear cache:**
   ```powershell
   npm cache clean --force
   npm install
   ```

---

**Happy Coding! 🚀**

