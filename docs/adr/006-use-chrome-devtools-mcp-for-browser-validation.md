# 006. Use chrome-devtools-mcp for Browser Validation

Date: 2026-05-19

## Status

Accepted

## Context

The software factory's `/verify` skill needs a way to validate UI changes by running the app in a real browser and observing its behavior. The chosen tool must give the coding agent access to console output, network activity, and visual state of a locally running dev server.

## Decision

Use `chrome-devtools-mcp` as the browser validation layer. It connects to a live running Chrome instance via the native Chrome DevTools Protocol, giving the coding agent full console, network, and visual access to the running dev server — exactly the local validation use case.

## Consequences

The coding agent gains direct, low-latency access to Chrome's DevTools data (console logs, network requests, screenshots) without intermediary abstraction. This is optimal for local dev-server validation. The trade-off is that `chrome-devtools-mcp` is scoped to a single live local Chrome instance and is not suited for CI pipelines or cross-browser testing scenarios.

## Alternatives Considered

Playwright MCP was considered. It offers stronger support for CI pipelines and cross-browser testing, but provides weaker native DevTools access for live local development. It was rejected for this use case in favor of the deeper DevTools integration that `chrome-devtools-mcp` provides.
