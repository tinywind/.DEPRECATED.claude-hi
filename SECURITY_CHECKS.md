# CLI command security

Messages are passed to the `claude` executable as one literal argument after `-p`. No shell interprets quotes, command substitutions, redirections, or other message content. The connection check also uses a separate `--version` argument. Child-process failures still update the existing failure metrics and retry flow.

The `claude` executable must be available on PATH. Windows requires the native executable; `.cmd` and `.bat` shell wrappers are not launched. This avoids reintroducing shell interpretation for npm command wrappers.

Run `npm test` for the existing console-mode service checks. On a POSIX host, run `npm run test:security` for the child-process regression. It places an isolated executable fixture first on PATH, verifies exact argument bytes and process failures, and checks a harmless command-substitution marker stays absent. The same test creates that marker against the vulnerable implementation. All temporary files stay under `.tmp/` and are removed afterward. No real Claude CLI, model request, account, or payment is used by this regression.

Validation covers local Linux process execution on Node.js 24 and 26. Native Windows CLI execution and a real Claude service session were not performed.
