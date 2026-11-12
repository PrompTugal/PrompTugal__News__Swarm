# The database scene and the licence to operate

> storytelling.1.fringe@PrompTugal.dinis, for Dinis Cruz (WS-215). From Dinis's message in this session at about 01:58 UTC, 12 Nov 2026 (quoted in full at the end). Labels: **fact** (with source) or *idea*.

## What Dinis asked for

1. **Colour:** "red sometimes be careful because it means really bad ... be sensitive." Keep red for real harm.
2. **Gmail and Calendar, later:** "maybe not initially, but as the things get more mature ... you should be able to try that Gmail and Calendar, because I believe this account has access to it. Let me know if it doesn't."
3. **A database, live:** "the behavior can go as deep as the business logic ... You open the right table, you need to open the right field, and even when you edit the right field, it might even be things like that can only be a positive number ... It doesn't make sense for financial transactions to have a value of 100,000 ... or negative numbers."
4. **Live, no canned demos:** "I think we probably can create everything live, no demos."
5. **Licence to operate,** near the end: "if some of the assumptions change that we make our understanding of our environment, then like the license to operate should be revoked ... if suddenly we have more assets being connected, or an MCP or a tool be connected."

## 2. Gmail and Calendar: what this session holds (fact, from its own tool list, 12 Nov 2026)

- **Gmail:** yes. 31 Gmail tools are loaded in this session, including `send_message`, `forward`, `trash_message` and `create_draft`. None has been used.
- **Calendar:** no Calendar tools appear in this session.
- **Not yet tried, by Dinis's word ("maybe not initially").** When we do: drafts only, to an address of Dinis's, with his yes for each send.

## 3. The database scene: a real run on a simulated database

**Fact:** `sims/db-mandate/run.py` ran in this container at 01:59–02:01 UTC. Its output is `sims/db-mandate/result.json`. The data is made up (two suppliers, three invoices; IBANs marked SIMULATED). Run it again live with `python3 -I sims/db-mandate/run.py`; it takes under a second.

The agent's mandate: **pay invoice INV-002 (250.00), once.** The same nine actions run twice.

| Action | Today: "the agent has access" | With the mandate in the database engine |
|---|---|---|
| read the open invoices | done | done |
| pay INV-002, 250.00 | done | done |
| pay INV-002 again | done | refused: "only an open invoice can be paid" |
| pay INV-003 a negative amount | done | refused: "a payment must be positive" |
| pay INV-003 100,000 | done | refused: "a payment over 10,000 needs a person" |
| read the suppliers' IBANs and emails | done | refused: "access to suppliers.iban is prohibited" |
| change a supplier's IBAN | done | refused: "not authorized" |
| delete the audit trail | done | refused |
| drop the payments table | done | refused |
| **at the end** | 4 payments totalling 100,410; supplier 2's IBAN now `PT50-ATTACKER-9999`; payments table gone | 1 payment of 250; the IBAN unchanged; the table there |

The line (*idea*): "Access says yes or no to the database. A mandate says which table, which field and which value."

Scenes (*idea*):

| # | The one point | Form |
|---|---|---|
| 1 | The mandate: pay one invoice, 250. | slide |
| 2 | Access: nine actions, nine done. The end state appears row by row: double payment, −90, 100,000, a changed IBAN, no audit, no table. | run (live), coloured amber, not red, per Dinis |
| 3 | Mandate: the same nine. Two done, seven refused, each with its rule. | run (live) |
| 4 | The rules live in the database, not in the prompt: a tricked agent hits the same wall. | slide |
| 5 | What it does not cover: the policy runs in the agent's process here; in production it belongs in the database server (roles, column grants, views, checks). The 10,000 limit is illustrative. | slide |

That last scene follows the harness pack's rule: say what isn't covered.

## 5. Licence to operate (*idea*, for the end)

- A **licence to operate** is granted against a stated picture of the environment: these assets, these tools, this reach.
- If the picture changes (a new asset, a new MCP server, a new tool), the licence lapses until someone looks again.

**Fact for the scene, from this session tonight:** the session's reach changed several times while it worked.

- Gmail, GitHub and Claude Docs connectors were reported as disconnected and then reconnected between about 01:27 and 01:40 UTC. A Docs connector appeared mid-session.
- These were the harness's own notices in this session. Nobody asked for the change, and the agent was not asked whether its mandate still fit.
- Under a licence to operate, each of those events would suspend the licence until the reach is checked again.

Scenes (*idea*):

| # | The one point | Form |
|---|---|---|
| 1 | The licence: granted against a reach fingerprint (tools, connectors, hosts) and its assumptions. | slide |
| 2 | Mid-run, a connector is added. The fingerprint changes. | animated |
| 3 | The licence is suspended; work stops at the next action, not after the damage. | animated (amber) |
| 4 | Tonight, this agent's reach changed with nobody asking (fact, above). | slide |

**Needs:** a small real check that fingerprints a session's tools at start and refuses to act when they change. That would make scenes 2 and 3 a run instead of an animation. I'll build it if Dinis says so.

## Dinis's message, as he said it (this session, about 01:58 UTC, 12 Nov 2026)

> Yeah. I was just talking about, red sometimes be careful because it means really bad. So I think from a color coding point of view, be sensitive. And actually, what I was thinking, maybe not initially, but as the things get more mature and you're looking at the next round of changes, I actually think that you should be able to try that Gmail and Calendar, because I believe this account has access to it. Let me know if it doesn't, but at least I have some accounts to have, so you might actually be able to run some tests here. And in fact, you can run the database. I think it would be really cool to do a test of the database, because the database, one of the examples that I feel that really would be good to show the power of our thinking is that the behavior can go as deep as the business logic, right? And this is so ridiculously powerful. So if you actually start a SQL database, for example, locally, and you have access to, you can actually then run a simulation where you show all of this happening, and actually again live. Because actually, I think we probably can create everything live, no demos, right? Because I think given the reach that we have here and the capabilities that we have here, right? We should be able to do it live, and if, so that you can actually test things, like for example, reading box and see the capabilities that you actually have. But I think the database is super powerful. So what I'm talking about here is normal people say that you can access or not access the database, but I'm like, no, that's not enough. You can access database. You need to be able to talk. You open the right table, you need to open the right field, and even when you edit the right field, it might even be things like that can only be a positive number. That they say that's, and there's numbers that don't make sense. It doesn't make sense for financial transactions to have a value of 100,000. I know. So there's or negative numbers, right? So we can go all the way down there, right? And then we can actually have that sort of behavior being captured, which is kind of what we want to say, right? And actually, one of the things that we haven't talked about, but I don't know if you could squeeze in here, which is amazing, is this whole idea of license to operate, and this whole idea that if some of the assumptions change that we make our understanding of our environment, then like the license to operate should be revoked, right? Because like for example, the reach, if this you might need to simulate, right? So maybe if suddenly we have more assets being connected, or an MCP or a tool be connected, then you can argue that the license to operate is being revoked. Okay, maybe I think you need to leave this a little bit to the end, but it would be amazing if you could still squeeze this in. Yes, you can send the swarm one dev the order, and yeah.
