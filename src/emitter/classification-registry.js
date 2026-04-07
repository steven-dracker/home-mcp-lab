'use strict';

/**
 * Tool Classification Registry
 *
 * Loads config/tool-classifications.json at module init and provides
 * a lookup function for resolving a tool name to its risk level.
 *
 * Used by the emitter to attach risk_level to tool.invocation events
 * without requiring callers to know about the registry directly.
 *
 * Lookup failures are silent — if a tool is not in the registry,
 * risk_level is omitted from the event rather than causing an error.
 */

const path = require('path');

const REGISTRY_PATH = path.resolve(__dirname, '../../config/tool-classifications.json');

let _registry = null;

function loadRegistry() {
  if (_registry !== null) return _registry;
  try {
    const entries = require(REGISTRY_PATH);
    _registry = {};
    for (const entry of entries) {
      if (entry.tool_name && entry.risk_level) {
        _registry[entry.tool_name] = entry.risk_level;
      }
    }
  } catch (_) {
    // Registry file missing or unparseable — degrade gracefully.
    _registry = {};
  }
  return _registry;
}

/**
 * Returns the risk level for a given tool name, or null if not in registry.
 *
 * @param {string} toolName
 * @returns {string|null} — 'LOW' | 'MEDIUM' | 'HIGH' | 'DESTRUCTIVE' | null
 */
function lookupRiskLevel(toolName) {
  if (!toolName) return null;
  const registry = loadRegistry();
  return registry[toolName] || null;
}

module.exports = { lookupRiskLevel };
