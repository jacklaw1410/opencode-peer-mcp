# Examples

- `servers.yaml`: minimal two-server config showing `none` and `bearer` auth with narrow write allowlists. Secrets are referenced by environment variable name.
- `opencode-mcp.json`: MCP client registration snippet.

`servers.yaml` references `OPENCODE_REMOTE_TOKEN`. Set that variable in the process that launches the MCP server; do not put secret values in either file.
