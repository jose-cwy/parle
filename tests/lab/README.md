Lab-only Playwright harnesses. Not part of `npx playwright test`.

Run explicitly, one worker, against a healthy local server:

```
npx playwright test tests/lab/cpu4x-remeasure.spec.js --workers=1 --project=chromium
```

4× CPU 60-message rematch (22 Oct 2026, isolated Chromium): avg **10.21 ms**, p95 **15 ms**, 688 nodes, 83 buttons. Audit before: avg **28.1 ms**, p95 **34 ms**, ~170 buttons.
