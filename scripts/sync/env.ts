// Local runs keep secrets in .env (gitignored); variables already set, as in the workflow, win.
try {
	process.loadEnvFile();
} catch {}
