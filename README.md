# Forge IDE

A browser-native, privacy-oriented developer IDE. Forge stores projects and settings locally in browser storage and executes HTML/CSS/JavaScript previews only inside a sandboxed iframe.

## Run

```bash
npm run dev
# visit http://localhost:5173
```

## Test and build

```bash
npm test
npm run build
```

## Shortcuts

- `Ctrl/Cmd + S` save
- `Ctrl/Cmd + P` command palette
- `Ctrl/Cmd + B` toggle explorer
- `Ctrl/Cmd + Enter` run project
- `Ctrl/Cmd + W` close editor tab

## Limitations

The static MVP does not bundle Monaco because it has no third-party runtime dependencies. The integrated editor provides a dependable plain-text code surface. Python, Kotlin, TypeScript, and React templates are authored but deliberately cannot execute locally; a future remote sandbox provider can execute them. Project archive export uses the documented `.forge-project.json` portable format rather than ZIP.
