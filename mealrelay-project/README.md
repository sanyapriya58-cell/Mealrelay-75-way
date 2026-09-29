# MealRelay

MealRelay is a full-stack prototype for coordinating surplus-food pickups. Donors publish food listings with a pickup location, portions, and use-by time. Volunteers can claim a listing and mark the pickup complete. The dashboard shows availability and rescue activity.

## Run locally

Requires Node.js 20 or newer. No package installation or API key is needed.

```bash
npm start
```

Open <http://localhost:3004>. Run tests with `npm test`.

## Stack and features

- Frontend: HTML, CSS, browser JavaScript
- Backend: Node.js HTTP server and REST API
- Storage: local JSON file (`data/posts.json`, excluded from Git)
- Donation form, status filters, claim and pickup workflow, expiry checks, dashboard counts
- Responsive layout for desktop and mobile
- Three locally bundled, generated illustrative photos showing volunteers and food; these are not photos of actual listings

The initial listings in `data/demo.json` are fictional examples and are clearly labelled in the app. They have far-future dates to keep the demo usable; replace them before a real deployment. This prototype has no accounts, identity verification, notifications, or food-safety certification. Do not use it to coordinate real pickups without those safeguards.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/posts` | List donations with current expiry status |
| POST | `/api/posts` | Create a donation |
| PATCH | `/api/posts/:id/status` | Claim or mark picked up |

## License

MIT
