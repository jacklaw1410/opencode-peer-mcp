# Glossary

## Server

A configured OpenCode instance. Identified by a user-supplied `server_id`. The peer MCP does not discover servers; it only uses those declared in config.

## Session

An OpenCode session. Addressed externally as `server_id/session_id`. OpenCode sessions do not natively communicate with each other.

## Peer bridge

The external MCP role of this project: list, read, compare, and optionally interact with sessions across configured servers. It is a bridge only, not an orchestrator.

## Config

The user-supplied registry of servers. Secrets are referenced by environment variable name, never stored directly.

## Auth mode

How the peer MCP authenticates to a server. Supports `basic`, `bearer`, and `none`; all three are implemented. Basic auth uses the fixed username `opencode`.

## Write gate

The condition that must hold before any write operation executes: global write enablement plus a per-session allowlist entry, `*` or `create` where applicable, or the caller's `allowed: true` argument.

## Allowlisted session

A session explicitly permitted for write operations by config or tool argument. Default empty.

## Audit log

Append-only local record of tool attempts, including denied writes.

## Read-only operation

An operation that lists or reads session state without mutating the target server.
