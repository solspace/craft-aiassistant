#!/usr/bin/env node
/**
 * Build script for AI Assistant front-end assets.
 * - JS: resources/js → src/assets/js (ai-assistant + solspaceai bundles)
 * - CSS: resources/css → src/assets/css
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'resources');
const outputJsDir = path.join(projectRoot, 'src', 'assets', 'js');
const outputCssDir = path.join(projectRoot, 'src', 'assets', 'css');

const jsEntries = {
  'ai-assistant': path.join(sourceRoot, 'js', 'main.js'),
  'solspaceai': path.join(sourceRoot, 'js', 'views', 'solspaceai', 'index.js'),
};

const cssEntries = {
  'ai-assistant': path.join(sourceRoot, 'css', 'ai-assistant.css'),
  'solspaceai': path.join(sourceRoot, 'css', 'views', 'solspaceai', 'solspaceai.css'),
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
  console.log('✓ JS assets built (ai-assistant.min.js, solspaceai.min.js)');
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
  console.log('✓ CSS assets built (ai-assistant.min.css, solspaceai.min.css)');
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

