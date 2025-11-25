#!/usr/bin/env node
/**
 * Build script for AI Assistant front-end assets.
 * - Bundles and minifies JS from scripts/js → src/assets/js (single file)
 * - Bundles and minifies CSS from scripts/css → src/assets/css (with view-specific files)
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'resources');
const outputJsDir = path.join(projectRoot, 'src', 'assets', 'js');
const outputCssDir = path.join(projectRoot, 'src', 'assets', 'css');

// Single JS entry point - all functionality bundled into one file
const jsEntries = {
  'ai-assistant': path.join(sourceRoot, 'js', 'main.js'),
};

// Single CSS entry point - all styles bundled into one file
const cssEntries = {
  'ai-assistant': path.join(sourceRoot, 'css', 'ai-assistant.css'),
};

function ensureDirs() {
  fs.mkdirSync(outputJsDir, { recursive: true });
  fs.mkdirSync(outputCssDir, { recursive: true });
}

async function buildJs() {
  const options = {
    entryPoints: jsEntries,
    bundle: true,
    minify: true,
    sourcemap: false,
    outdir: outputJsDir,
    entryNames: '[name].min',
    format: 'iife',
    target: ['es2019'],
    platform: 'browser',
    logLevel: 'info',
    // Ensure global variables are available
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  };

  if (isWatch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('Watching JS assets…');
    return ctx;
  }

  await esbuild.build(options);
  console.log('✓ JS assets built (single file: ai-assistant.min.js)');
  return null;
}

async function buildCss() {
  const options = {
    entryPoints: cssEntries,
    bundle: true,
    minify: true,
    sourcemap: false,
    outdir: outputCssDir,
    entryNames: '[name].min',
    loader: {
      '.svg': 'dataurl',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
    },
    logLevel: 'info',
  };

  if (isWatch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('Watching CSS assets…');
    return ctx;
  }

  await esbuild.build(options);
  console.log('✓ CSS assets built (single file: ai-assistant.min.css)');
  return null;
}

async function run() {
  ensureDirs();

  try {
    if (isWatch) {
      const contexts = await Promise.all([buildJs(), buildCss()]);
      // Keep references so they are not garbage collected while watching.
      global.__AIAssistantEsbuildContexts = contexts;
      console.log('Asset pipeline ready. Press Ctrl+C to exit.');
    } else {
      await Promise.all([buildJs(), buildCss()]);
      console.log('✓ Asset build complete.');
    }
  } catch (error) {
    console.error('✗ Build failed:', error);
    process.exitCode = 1;
  }
}

run();

