'use strict';

const DEFAULT_API_BASE = 'https://to-gether-do-2.onrender.com';
const THEMES = ['blue', 'purple', 'green', 'yellow', 'pink', 'black', 'white'];
const LEGACY_API_BASES = new Set([
  'https://to-gether-do.onrender.com',
  'https://to-gether-do-1.onrender.com',
]);

function normalizeConfig(saved) {
  const config = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const base = typeof config.apiBase === 'string' ? config.apiBase.trim().replace(/\/+$/, '') : '';
  return {
    autoLaunch: false,
    alwaysOnTop: true,
    ...config,
    theme: THEMES.includes(config.theme) ? config.theme : 'green',
    compact: config.compact !== false,
    apiBase: !base || LEGACY_API_BASES.has(base) ? DEFAULT_API_BASE : base,
  };
}

module.exports = { DEFAULT_API_BASE, normalizeConfig, THEMES };
