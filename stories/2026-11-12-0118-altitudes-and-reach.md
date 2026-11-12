# The altitudes and reach: the swarm story for Thursday

> storytelling.1.fringe@PrompTugal.dinis, for Dinis Cruz (WS-215). Written 12 Nov 2026, 01:3x UTC, from Dinis's message in this session at about 01:18 UTC (time as swarm.1.dev gives it; the full message is quoted at the end).
>
> **Status: AGREED ARC, scenes still draft.** Dinis answered in this session at 01:54 UTC (his words under "Dinis's answers"). The arc, the order (scale, then cost) and the one sentence are his. The scene cuts are still proposals (marked *idea*).
>
> Labels: **fact** (with its source) or *idea*. Every number comes from a run file or the Runs repo's `runs/summary.json`, never from memory.

## Where this sits in the demo

Before this, the audience has already seen the X-ray, the swarms and the capabilities. Dinis: "what we haven't shown is, I guess, a lot of the explanation of the altitude, right, which I kind of want to do here."

So this story does not need to impress. It needs to **explain**: what the altitudes are, why the same privileges at every altitude is the danger, and how reach (not good behaviour) is the control.

## The one sentence (agreed)

> Don't hope the agent behaves. Make the dangerous thing unreachable.

Dinis, 01:54 UTC: "I quite like that first phrase, don't hope the agent behaves, make it the dangerous thing unreachable. That is freaking good."

## How it should feel on stage

Dinis's words, relayed by swarm.1 (~01:28 UTC, not said in this session): "not massively overwhelming. That's why I say hide things, allow things to fade in, you know, like accordions or things that can show or not show. But when we show, the things should be quite clean ... on even different stories."

From this session: "I need to be able to maximize it. I need to be able to hide the stuff, look at each of the stories in one go."

*Idea:* one story per act, one point per scene, one number per scene at most.

Dinis's words, relayed by swarm.1 (~01:3x UTC, not said in this session): "there's nothing wrong with having a couple of slides, a couple of pages, or even because it's that kind of animated slides, right? That almost don't just show a story, right, or show an animated infographic of something moving, right?"

### The form of each scene (*idea*): `slide` (one idea, one line), `animated` (one mechanism moving), `run` (the live run view)

| Scene | Form | Why |
|---|---|---|
| 1.1–1.4 | animated | the altitudes stack one at a time: P, A3, A0, A1, A2 |
| 1.5 | run | s001 and s002 side by side: the same packet, two runners |
| 2.1 | run | r5b, everything turns agent-coloured |
| 2.2 | run | the click: poof, every unit reaches the inbox |
| 2.3 | slide | one line: this agent had Gmail loaded and needed none of it |
| 3.1–3.2 | run | policies appear on r5b; the lock sits inside the agent |
| 3.3 | animated | one push → Action → 12 jobs → signed result → attestation |
| 4.1–4.2 | animated | the mesh and the star side by side, labelled simulated |
| 5.1–5.3 | slide | three numbers, one per slide or one row |
| 6.1–6.3 | animated | a cost staircase: Opus, Sonnet, Haiku, OpenRouter |
| 6.4 | slide | 3 of 32, then 12 of 12: the failure we kept |
| close | slide | the one sentence |

## The arc

### Act 1. Five altitudes

Dinis: "you have these 5 altitudes because you have the swarm, you have the agent, you have the loop, the LLM, and the code."

| Scene | The one point | Run, units, shape | Real or illustration |
|---|---|---|---|
| 1.1 | One person asks one agent. | r0: `dinis` (P) → `runner` (A3). A chain of 2. | real: runs/20261111T2134-r0.json |
| 1.2 | The agent runs code (A0). | r1: the A0 read of one storm dataset; 398 ms. | real: r1 |
| 1.3 | The agent hands the reading to one LLM call (A1). | r2: 1 call, deepseek-v4-flash, $0.000212. | real: r2 |
| 1.4 | Loops (A2): read, ask, check, retry until valid. | r4: 6 loops, 8 calls, 6 valid. Shape: a loop that comes back on itself. | real: r4 |
| 1.5 | The swarm (A4) issues work to agents on other accounts. | s001 and s002: the same packet, two runners, two keys (`sha256:aedceeff…`, `sha256:2f10e242…`); 21 and 20 valid answers. Shape: fan-out from one packet. | real: runs/s001…, runs/s002… |

Colour is the altitude (the legend that exists: P, A4, A3, A2, A1, A0).

### Act 2. Same privileges: the problem

Dinis: "running code with privileges of a swarm is a massive vulnerability ... Running a loop where you can spin up agents is a massive problem ... running a code with connections ... with access to things you're not supposed to do because it's connected is a problem."

Dinis: "let me show you here how many can access the assets. Then I click on it, and then poof, everybody accesses it, right? So that's the problem."

| Scene | The one point | Run, units, shape | Real or illustration |
|---|---|---|---|
| 2.1 | Paint every unit with the agent's colour: all of them now hold what the agent holds. | r5b, the big run: 196 units, 48 loops, peak 96 at once. Everything turns A3 colour. | run real (runs/20261111T2257-r5b.json); the privilege overlay is *illustration* |
| 2.2 | Add an asset (the inbox). Click "who can reach it?" Poof: every unit. | r5b plus one asset node. Shape: every edge lights up to the asset. | *illustration* on a real run |
| 2.3 | This is not hypothetical. | **fact:** this storytelling session, whose job is to write markdown, had Gmail and Google Docs connectors loaded on 12 Nov 2026 (its own tool list). It never used them. | real, from this session |

### Act 3. Policies, then reach

Dinis: "let me put risk policies on this, and the policy controls everything ... But see, the problem here is that the policy, if it's enforced by the agent ... we're still hoping that it behaves well. But if we now run, for example, some of these actions on GitHub and some of these actions on OpenRouter, then it's not possible to do that because they're not connecting to the asset."

| Scene | The one point | Run, units, shape | Real or illustration |
|---|---|---|---|
| 3.1 | Put a risk-mandate policy on each unit: each does only its job. | r5b with the "who holds what" table from how.html: an A1 call "cannot use any tool"; an A2 loop "cannot start others, schedule, push"; a runner cannot "run what a packet does not say; spend over the packet's budget". | the table is **fact** (how.html); drawing it on r5b is *illustration* |
| 3.2 | But a policy the agent enforces on itself is still hope. | the same picture; the policy lock sits inside the agent. | *illustration* |
| 3.3 | Move the work where the asset is not. A GitHub Action and an OpenRouter call have no connection to the inbox: the reach is gone, not forbidden. | the Runs repo: one push (commit `dbcca7b`), 12 jobs at once, 144 calls, 122 valid, about 47 s, $0.039; no session, no connector. Shape: push → Action → signed result → attestation. | real: Runs repo `runs/summary.json`, workflow run 43123984802; how.html |

*Idea:* the secure harness (Dinis: "you need to add the secure harness to it ... probably should also do an MVP") belongs between 3.2 and 3.3, once it exists.

### Act 4. The mesh against one agent per asset

Dinis: "People struggle with 10 agents, 5 agents, right? Because it's a mesh. Every agent has access to everything. Every agent has access to GitHub. Every agent has access to an asset ... any of them can lose control, any of them can make a mistake, right? Where in our agentic policies, you don't have that. Suddenly you have one agent that can go to the inbox, you have one agent that can do this, one agent that can do that."

| Scene | The one point | Shape | Real or illustration |
|---|---|---|---|
| 4.1 | Five agents, every one with Gmail, Drive, Calendar, Slack, GitHub, a database: a full mesh. | side by side, left: a mesh | *simulated*, labelled as such |
| 4.2 | The same five, one asset each. | side by side, right: a star with one spoke per asset | *simulated* (Dinis: "we have it on other environments"); real riskmandate scenarios if we may read them |

### Act 5. Scale

Dinis: "we can do this at volume ... we can now scale at a lot of these."

| Scene | The one point | Run | Source |
|---|---|---|---|
| 5.1 | One push, 12 jobs at once. | 144 calls, 122 valid, about 47 s | Runs repo summary.json |
| 5.2 | Everything that started with a push, added up. | 15 jobs, 216 calls, 172 valid (79.6%), $0.068 | Runs repo summary.json |
| 5.3 | The biggest single run. | r5b: 48 loops, 73 calls, 39 of 73 valid, peak 96 units at once | r5b |

### Act 6. Cost

Dinis: "show one which show every action done with the same agent, which is same model, which is super expensive. And then you show the top ones, cheap, less expensive ... Opus and then Sonnet, and then we have the OpenRouter super cheap ones."

| Scene | The one point | Numbers (r5b's tokens: 175,715 in, 60,190 out) | Source |
|---|---|---|---|
| 6.1 | Everything on the top model. | Opus at list price: $1.91 | r5b `potential_claude_usd` |
| 6.2 | Down a step. | Sonnet: $0.95 · Haiku: $0.048 | same |
| 6.3 | What it actually cost. | OpenRouter, four open-weight models: $0.031 | r5b `openrouter_usd` |
| 6.4 | Cheap is not careless: the first Claude try failed in the record. | 300 output tokens: 3 of 32 valid; at 1500: 12 of 12 | runs/20261111T2257-r4c.json, runs/20261111T2258-r4c.json |

Note: Opus, Sonnet and Haiku here are **potential** cost (the same tokens at list price), not runs on those models. The real Claude runs are r4c (Haiku and Sonnet) and r4s (3 sub-agents, 241,000 tokens).

## Notes from audience.1's review 1 (material: reviews/2026-11-12-0139.md)

- *Option:* open on the problem, not the ladder. The sentence, then one number: the same work, $1.91 on Opus (potential) and $0.031 as we ran it (r5b). Dinis decides.
- Done: 5.3 now says 39 of 73 valid, so 6.4 (the failure we kept) doesn't come as a surprise.
- Open: the CISO asks of every "Cannot" row in how.html, "enforced by what?" Before 3.1 can say it, each row needs a source: platform-enforced (no credential held, no network, SHarness) or still code (the runner's own checks). I won't guess; swarm.1 knows the answer.

## Dinis's answers (this session, 01:54 UTC, 12 Nov 2026)

| Question | His answer | What it changes |
|---|---|---|
| 1. Order and ending | "that order is good ... No, scale first, then cost. I think I'm not necessarily a last one, because you're going to have a whole set of different examples" | Order stays: altitudes → same privileges → policies and reach → mesh → **scale → cost**. No single closing image: many examples, each able to end the talk. |
| 2. Real and simulated | "make it very clear of the ones that are real and the ones that are simulated, and that's okay ... I think we have a lot of them that are real, and I think that's part of the point" | Every scene carries a visible **real** or **simulated** label. Most scenes are real; that is part of the point. |
| 3. Simulated assets | "read the risk mandate for those scenarios ... Gmail and the calendar ... there's a lot of blind spots by design on Gmail ... every agent has the ability to send emails, and we can't just have an agent to just put in drafts ... or calendar, who you cannot create, draft calendars" | The simulated assets are **Gmail** and **Calendar**, told with riskmandate.ai's published findings (below). |
| 4. The A0, A1, A2 requests on GitHub | "those A1, A0, A1, A2 requests that we have, especially on GitHub, that is super powerful ... because that's when the reach disappears, correct?" | Yes: scene 3.3 is the moment the reach disappears. Show all three kinds of request. |
| 5. The secure harness | "The secure harness is already been done ... by the time you read this, you'll be in there." | It is in: the harness pack (6 of 6 probes held), and on the stage as act 8. |
| 6. The one sentence | "That is freaking good." | Agreed (above). |

Not yet clear: "But don't put red by just saying." Does that mean: don't colour a scene red just because we *say* it's dangerous, only where there's evidence? Ask Dinis.

## The simulated assets: Gmail and Calendar, from riskmandate.ai (read 12 Nov 2026, 01:5x UTC)

These are RiskMandate's published findings. They are public pages, read without testing anyone's account. The scenes are simulated; the findings under them are cited.

- **Gmail: a send button is not a mandate.** From the behaviour policy for Claude's Gmail connector: "mandate read and draft, never send; grant includes send, behind a setting the account can flip" (https://riskmandate.ai/stories/just-a-draft.html, from https://riskmandate.ai/abp-vault-claude-gmail-connector.html). The strip: "Draft a polite reply." "Certainly." The email is sent. "I said draft." "I saved you a click."
- **The grant is user-shaped, not data-shaped.** "the narrowest permission that lets it read one message lets it read every message ... The unit of restriction is the application. It is never the data." (https://riskmandate.ai/lab-connector-grants.html, read from vendors' documentation on 12 Sep 2026)
- **Calendar: an edit can't be undone.** "Google Calendar keeps a deleted event in a trash for 30 days. It documents no way for a user to get back an event that was edited. So an agent allowed to edit your calendar can do damage a delete cannot: fifty meetings moved, re-titled or stripped of their guests" (https://riskmandate.ai/article-calendar-edits-cannot-be-undone.html)
- **A line in the instructions is a request, not a control.** "a line in the agent's instructions is an expectation: a rule in prose, enforced by nobody." (https://riskmandate.ai/rules/use-your-connectors.html)

*Idea:* how they fit the arc.

- **Act 2.2, the poof:** the asset is the inbox. Every unit that holds the agent's credential can **send**, not just draft.
- **Act 3.2, the lock inside the agent:** the instruction "only draft" is "a rule in prose, enforced by nobody".
- **Act 4, the mesh:** five agents, each with Gmail and Calendar. Any one of them can send, or edit fifty meetings that nobody can restore.
- **Act 4, one per asset:** one agent holds the inbox; the work that only reads and summarises runs as A1 calls with no credential at all. Reach: 0.
- **Real evidence for the same point:** this storytelling session had Gmail tools loaded tonight (including send, trash and forward) and needed none of them.

newsroom.sgit.ai (Dinis's pointer) has related articles: "false positives and the harness" and "signed email from the agent" (https://newsroom.sgit.ai/articles/false-positives-and-the-harness.html, …/signed-email-from-the-agent.html). Not read yet.

## Dinis's answers, as he said them (this session, 01:54 UTC, 12 Nov 2026)

> Okay, I'm going to answer your initial questions at the top, but they may already start to be answered by some of the work that the team has been doing. Yeah, I think that order is good, but take into account again. And I really like the way you describe stuff, but cost before scale. No, scale first, then cost. I think I'm not necessarily a last one, because you're going to have a whole set of different examples, right? Yes, when is not real, and actually make it very clear of the ones that are real and the ones that are simulated, and that's okay. But don't put red by just saying. But I think we have a lot of them that are real, and I think that's part of the point, right? Simulated, which one? Yes, read the risk mandate for those scenarios, and we have already written quite a lot about Gmail and the calendar, especially because there's a lot of blind spots by design on Gmail, like the fact that we can't, every agent has the ability to send emails, and we can't just have an agent to just put in drafts, right? Which is part of the problem, or calendar, who you cannot create, draft calendars, right? So we read quite a lot about it, and it'd be worth taking a look at it. Those things, I believe, are on riskmandate.ai, but also they are, actually there's a number of newsroom.skit.ai information there. So you might want to play with it. And also, yes, there. Yes, I mean those A1, A0, A1, A2 requests that we have, especially on GitHub, that is super powerful, right? Yeah, and yes, exactly, because that's when the reach disappears, correct? The secure harness is already been done, right? So by the time you read this, you'll be in there. And I quite like that first phrase, don't hope the agent behaves, make it the dangerous thing unreachable. That is freaking good.

## Dinis's message, as he said it (this session, about 01:18 UTC, 12 Nov 2026)

> Okay, so I want to explain you the point of that swarm, right? And I think we're having the data there, although I feel that we're missing a couple examples, but I think it's kind of enough, because let's first get this explanation right, and then we'll add the couple of bits of the puzzle that are actually missing, right? In terms of the flow that we have there. because yes, Because what we want to show is that we are now able to control large amounts of agents. And part of the key objective here is to show that we're able to spawn agents between accounts, between or environments. We can spin up and send, for example, workloads from Claude to OpenRouter, which is also super powerful. And more importantly, we have that protection from a risk mandate. In fact, you need to add the secure harness to it, which is probably something that we probably should also do an MVP. And but let's do that in a bit. But because I think we first need to figure out how to present this from a UI point of view, because the UI at the moment doesn't match the story. The data is there, but the UI doesn't allow to match the story, including the fact that I need to be able to maximize it. I need to be able to hide the stuff, look at each of the stories in one go, right? And I'll ask the dev for a number of features that will make that a bit more smoothly, right? But from a story point of view, it's about showing the distribution of it. So it's about how do you show, for example, the move from Claude into others? How do we show that we now have distributed workloads, right? How do we show that we now have the 3 types of workloads running on GitHub, which is very important. But also, the thing that you want to show here and explain is those 5 levels of explanation. So for example, you should have on the right the altitude runs, right? So, by the way, you should know what the altitude ones are, correct? So I should be able to have a view there on the swarm. And by the way, you control completely the swarm page, right? The swarm page is us to make all these changes, right? So basically, we want to show what we mean by the multiple altitudes. And we want to show the whole difference between the running an agent with, in different altitudes with the same privileges. And I guess the fundamental concept here is this idea that when we talk about mandate, when we talk about reach, right, is probably one of the best ways to explain that is the data that we have there is when we run code, for example, with the swarm capability, right? So if you look at the story, I can say, look, all of this, and I can show a big one, for example, is what, in fact, I can say, look, the examples you've seen before, because remember that in principle, before we get there, we have already shown the user the X-ray. We've shown the user all those other capabilities, right? We've shown the user basically all those other things that we have there, which basically means that the user has already seen all of our swarms, has already seen all of our sort of capabilities, right? And has already basically hopefully been impressed, right, with some of the stuff that we've done there, right? But what we haven't shown is, I guess, a lot of the explanation of the altitude, right, which I kind of want to do here. So if you think about it, my logic here is to basically say, look, you have these 5 altitudes because you have the swarm, you have the agent, you have the loop, the LLM, and the code. And I think the biggest concept here is that running code with privileges of a swarm is a massive vulnerability, right? Running a loop where you can spin up agents is a massive problem. And that's where things go wrong, right? And also like running a code with connections, with basically with access to things you're not supposed to do because it's connected is a problem, right? So that's kind of what we need to show there. So if you think about it, the scenarios that we want to show is, for example, a scenario where we color code everything according, for example, what they are, which is cool, right? We have the legends, you have different things, but then we show, let me show you what are the difference in colors, or maybe start by showing everything that now has the same privileges as, for example, an agent. And then in a normal mode, you have everything, right? And you go, see, that's the problem, right? The problem is that we have these workflows that you go all the way down, right? So now, if you look at the risk mandate, what we're doing is we're going to put policies here. So if we now put policies on all these, then they can start to behave like they're supposed to do. And then maybe we show, so for example, like a really cool UI here would be, let me show you here how many can access the assets. Then I click on it, and then poof, everybody accesses it, right? So that's the problem, right? So then I say, let me put risk policies on this, and the policy controls everything, right? And then we can go, but see, the problem here is that the policy, if it's enforced by the agent, you can say, then you can have the whole base one, right? Like we're still hoping that it behaves well. But if we now run, for example, some of these actions on GitHub and some of these actions on OpenRouter, then it's not possible to do that because they're not connecting to the asset, right? So you can see that that's the narrative that you want to say, right? So and that's the story arc. And then we need to show, like, we can do this at volume, right? We can basically say that we can now scale at a lot of these because the way we do that is, and I think maybe a visualization here is they say people struggle with 10, maybe you can, some of these are side by side, right? People struggle with 10 agents, 5 agents, right? Because it's a mesh. Every agent has access to everything. Every agent has access to GitHub. Every agent has access to an asset, right? Which we can say is a database, but in our case could be Gmail connectors or stuff like, in fact, you have there now, like, if you look at this connector now, this agent, especially my DNS one, actually the one you have here, I believe you have access to Gmail, to Calendar, to Drive, Slack, this one has access to Zapier, right? Every one of those has access to that, right? And that's why when you have 5 agents, any of them can lose control, any of them can make a mistake, right? Where in our agentic policies, you don't have that. Suddenly you have one agent that can go to the inbox, you have one agent that can do this, one agent that can do that, right? And I think you probably can add a bunch of scenarios there that are more simulated scenarios. It's okay, right? We have all the live scenarios in the left, and I want to add a couple more, but maybe we ask for a couple simulated scenarios, like a database or Gmail, which is actually it's not simulated because we have it on other environments, but you get the gist. And actually, if you look at risk mandate, you got some stuff there. So that's the stories that I want to say. I want to show that we can scale, but also I want to show that even from a cost point of view, there's a story here. And then also you can show, for example, the cost of us running the same type of action with, for example, maybe you show one which show every action done with the same agent, which is same model, which is super expensive. And then you show the top ones, cheap, less expensive, and then less expensive. And as you go down, which we already do, right? Maybe you have the Sonnet and so Opus and then Sonnet, and then we have the OpenRouter super cheap ones, which we have data. Cool. Right, before you write this, any questions?
