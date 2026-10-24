# API Reference: Rate Limits

All API requests are authenticated with a bearer token in the `Authorization` header.

## Limits by plan
| Plan       | Requests per minute | Burst |
|------------|---------------------|-------|
| Starter    | 60                  | 10    |
| Pro        | 600                 | 100   |
| Enterprise | 6,000               | 1,000 |

## When you exceed a limit
The API returns HTTP **429 Too Many Requests** with a `Retry-After` header (in seconds).
Clients should back off exponentially. Repeated abuse can lead to a temporary 1-hour block.

## Error codes
- `401` - missing or invalid token.
- `403` - token lacks permission for this project.
- `404` - resource not found.
- `409` - conflicting deployment already in progress.
- `429` - rate limit exceeded.
- `503` - region temporarily unavailable; retry after the time in `Retry-After`.
