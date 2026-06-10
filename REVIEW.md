# Review Guidelines for Cypress Real World App

## Architecture

- All state management uses XState machines in `src/machines/`
- API routes follow RESTful conventions in `backend/`
- Database access goes through `backend/database.ts`

## Security Requirements

- Transaction amounts must be sanitized (XSS prevention)
- All API endpoints must validate input with express-validator
- User-generated content (transaction descriptions, comments) must be escaped

## Testing Requirements

- All new components must have unit tests
- XState machines must have test coverage for all states/transitions
- No direct DOM manipulation — use React patterns

## Code Style

- TypeScript strict mode — no `any` types
- Follow existing patterns in the codebase
- Use functional components with hooks
