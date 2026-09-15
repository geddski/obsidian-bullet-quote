# Bullet Quote

Render blockquotes inside list items in Live Preview and Reading view

<!-- screenshot: docs/<id>.png, captured from the vault in dark theme -->

## Usage

## Install

Not yet in the community plugin list. Until then:

- **BRAT**: install [BRAT](https://github.com/TfTHacker/obsidian42-brat), then *Add beta plugin* with `geddski/obsidian-bullet-quote`.
- **Manual**: download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/geddski/obsidian-bullet-quote/releases/latest) into `<vault>/.obsidian/plugins/bullet-quote/`, then enable it under *Community plugins*.

## Development

```
bun install
bun run dev      # watch build → main.js
bun run build    # typecheck + minified build
bun run lint
```

Symlink the repo into a vault's `.obsidian/plugins/bullet-quote` to run it live. With the [Hot Reload](https://github.com/pjeby/hot-reload) plugin installed, the `.hotreload` marker reloads the plugin on every rebuild.

Releases: bump with `npm version patch|minor|major`, then push the tag. The release workflow builds and attaches the artifacts.
