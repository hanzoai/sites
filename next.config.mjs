/**
 * @hanzo/gui is consumed at runtime (Next's own `transpilePackages` + the
 * provider's runtime CSS injection) — the same arrangement the console uses and
 * for the same reason: the published gui next-plugin has a broken dependency,
 * and the optimizing compiler is an optimization, not a requirement.
 */
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Every installed `@hanzogui/*`, discovered rather than hardcoded. */
function guiPackages() {
  try {
    return readdirSync(join(__dirname, 'node_modules', '@hanzogui')).map((n) => `@hanzogui/${n}`)
  } catch {
    return []
  }
}

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // The dev overlay badge floats over the UI and would sit in every screenshot.
  devIndicators: false,
  transpilePackages: ['@hanzo/gui', '@hanzo/ui', '@hanzo/data', '@hanzo/iam', 'react-native-web', ...guiPackages()],
  experimental: { esmExternals: true },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, 'react-native$': 'react-native-web' }
    // `.web.*` FIRST is what makes the react-native ecosystem resolve its web
    // variants. Without it, a package like react-native-svg resolves its native
    // entry and webpack chokes on React Native's Flow source.
    config.resolve.extensions = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', ...config.resolve.extensions]
    return config
  },
}
