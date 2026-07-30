# Deployment

The production build uses `/TideVR/` as its asset base for GitHub Pages.
Development and CI support Node.js 22, pinned in `.nvmrc` and `package.json`.

```bash
npm ci
npm run build
```

The Pages workflow validates, builds, and deploys automatically whenever
`main` is pushed. It can also be run manually from the Actions tab.

The hosted WebXR build is available at:

**https://boxwrench.github.io/TideVR/**

GitHub Pages must use **GitHub Actions** as its publishing source. The deployed
site uses HTTPS, satisfying WebXR's secure-context requirement.

If the final repository or hosting path is not `TideVR`, update `base` in
`vite.config.ts` before deployment.
