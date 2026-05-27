## What this changes

<!-- One paragraph. What broke or what's new and why. -->

## How I verified it

<!-- The pipeline is hard to unit-test end-to-end. Tell me what you
actually ran. Job IDs, screenshots, before/after logs all welcome. -->

- [ ] Backend still imports cleanly: `docker exec phantom-backend-1 python -c "from main import app"`
- [ ] Frontend compiles: no errors in `docker logs phantom-frontend-1 --tail 60`
- [ ] At least one generation completed against a real repo
- [ ] No new secrets in `.env.example` or anywhere else under source control

## Notes for the reviewer

<!-- Anything subtle. A trade-off you made, a follow-up you'd file
yourself, etc. -->
