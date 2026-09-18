# Cloudflare Connector Specification

## Purpose

Provide a GPT-accessible interface for Cloudflare resources, similar to GitHub repository access.

## Tool Interface (planned)

### query_d1

Query structured business data stored in Cloudflare D1.

Input:
- database
- sql

Output:
- rows
- metadata

### get_kv_state

Read current state values from Cloudflare KV.

Input:
- namespace
- key

Output:
- value

### read_r2_file

Read archived files from Cloudflare R2.

Input:
- bucket
- object_key

Output:
- file content

## Security

- Read-only first
- Secrets stored outside Git
- API tokens managed by Cloudflare environment variables

## Status

Architecture initialized. Runtime implementation pending.
