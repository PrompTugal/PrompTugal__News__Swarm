# The altitudes and reach: the swarm story for Thursday

> storytelling.1.fringe@PrompTugal.dinis, for Dinis Cruz (WS-215). Written 12 Nov 2026, 01:3x UTC, from Dinis's message in this session at about 01:18 UTC (time as swarm.1.dev gives it; the full message is quoted at the end).
>
> **Status: DRAFT.** The arc is Dinis's. The scene cuts, the one sentence and the order of the last acts are proposals (marked *idea*) until he answers the open questions at the bottom.
>
> Labels: **fact** (with its source) or *idea*. Every number comes from a run file or the Runs repo's `runs/summary.json`, never from memory.

## Where this sits in the demo

Before this, the audience has already seen the X-ray, the swarms and the capabilities. Dinis: "what we haven't shown is, I guess, a lot of the explanation of the altitude, right, which I kind of want to do here."

So this story does not need to impress. It needs to **explain**: what the altitudes are, why the same privileges at every altitude is the danger, and how reach (not good behaviour) is the control.

## The one sentence (*idea*, waiting for Dinis's words)

> Don't hope the agent behaves. Make the dangerous thing unreachable.

## How it should feel on stage

Dinis's words, relayed by swarm.1 (~01:28 UTC, not said in this session): "not massively overwhelming. That's why I say hide things, allow things to fade in, you know, like accordions or things that can show or not show. But when we show, the things should be quite clean ... on even different stories."

From this session: "I need to be able to maximize it. I need to be able to hide the stuff, look at each of the stories in one go."

*Idea:* one story per act, one point per scene, one number per scene at most.

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
| 5.3 | The biggest single run. | r5b: 48 loops, 73 calls, peak 96 units at once | r5b |

### Act 6. Cost

Dinis: "show one which show every action done with the same agent, which is same model, which is super expensive. And then you show the top ones, cheap, less expensive ... Opus and then Sonnet, and then we have the OpenRouter super cheap ones."

| Scene | The one point | Numbers (r5b's tokens: 175,715 in, 60,190 out) | Source |
|---|---|---|---|
| 6.1 | Everything on the top model. | Opus at list price: $1.91 | r5b `potential_claude_usd` |
| 6.2 | Down a step. | Sonnet: $0.95 · Haiku: $0.048 | same |
| 6.3 | What it actually cost. | OpenRouter, four open-weight models: $0.031 | r5b `openrouter_usd` |
| 6.4 | Cheap is not careless: the first Claude try failed in the record. | 300 output tokens: 3 of 32 valid; at 1500: 12 of 12 | runs/20261111T2257-r4c.json, runs/20261111T2258-r4c.json |

Note: Opus, Sonnet and Haiku here are **potential** cost (the same tokens at list price), not runs on those models. The real Claude runs are r4c (Haiku and Sonnet) and r4s (3 sub-agents, 241,000 tokens).

## Open questions for Dinis

1. Order and the last image: altitudes → same privileges → policies and reach → mesh → scale → cost? Does the story end on the mesh, on cost, or on the signed push chain?
2. Is r5b the big run for acts 2 and 3, or the scale test?
3. Simulated assets: which (Gmail, a database, Drive, Calendar)? May we read the riskmandate repo for its scenarios?
4. "The 3 types of workloads running on GitHub": the A0, A1 and A2 requests in the Runs repo? Do they belong in 3.3?
5. The secure harness: a scene on Thursday, a "next", or out?
6. The one sentence: his own words?

## Dinis's message, as he said it (this session, about 01:18 UTC, 12 Nov 2026)

> Okay, so I want to explain you the point of that swarm, right? And I think we're having the data there, although I feel that we're missing a couple examples, but I think it's kind of enough, because let's first get this explanation right, and then we'll add the couple of bits of the puzzle that are actually missing, right? In terms of the flow that we have there. because yes, Because what we want to show is that we are now able to control large amounts of agents. And part of the key objective here is to show that we're able to spawn agents between accounts, between or environments. We can spin up and send, for example, workloads from Claude to OpenRouter, which is also super powerful. And more importantly, we have that protection from a risk mandate. In fact, you need to add the secure harness to it, which is probably something that we probably should also do an MVP. And but let's do that in a bit. But because I think we first need to figure out how to present this from a UI point of view, because the UI at the moment doesn't match the story. The data is there, but the UI doesn't allow to match the story, including the fact that I need to be able to maximize it. I need to be able to hide the stuff, look at each of the stories in one go, right? And I'll ask the dev for a number of features that will make that a bit more smoothly, right? But from a story point of view, it's about showing the distribution of it. So it's about how do you show, for example, the move from Claude into others? How do we show that we now have distributed workloads, right? How do we show that we now have the 3 types of workloads running on GitHub, which is very important. But also, the thing that you want to show here and explain is those 5 levels of explanation. So for example, you should have on the right the altitude runs, right? So, by the way, you should know what the altitude ones are, correct? So I should be able to have a view there on the swarm. And by the way, you control completely the swarm page, right? The swarm page is us to make all these changes, right? So basically, we want to show what we mean by the multiple altitudes. And we want to show the whole difference between the running an agent with, in different altitudes with the same privileges. And I guess the fundamental concept here is this idea that when we talk about mandate, when we talk about reach, right, is probably one of the best ways to explain that is the data that we have there is when we run code, for example, with the swarm capability, right? So if you look at the story, I can say, look, all of this, and I can show a big one, for example, is what, in fact, I can say, look, the examples you've seen before, because remember that in principle, before we get there, we have already shown the user the X-ray. We've shown the user all those other capabilities, right? We've shown the user basically all those other things that we have there, which basically means that the user has already seen all of our swarms, has already seen all of our sort of capabilities, right? And has already basically hopefully been impressed, right, with some of the stuff that we've done there, right? But what we haven't shown is, I guess, a lot of the explanation of the altitude, right, which I kind of want to do here. So if you think about it, my logic here is to basically say, look, you have these 5 altitudes because you have the swarm, you have the agent, you have the loop, the LLM, and the code. And I think the biggest concept here is that running code with privileges of a swarm is a massive vulnerability, right? Running a loop where you can spin up agents is a massive problem. And that's where things go wrong, right? And also like running a code with connections, with basically with access to things you're not supposed to do because it's connected is a problem, right? So that's kind of what we need to show there. So if you think about it, the scenarios that we want to show is, for example, a scenario where we color code everything according, for example, what they are, which is cool, right? We have the legends, you have different things, but then we show, let me show you what are the difference in colors, or maybe start by showing everything that now has the same privileges as, for example, an agent. And then in a normal mode, you have everything, right? And you go, see, that's the problem, right? The problem is that we have these workflows that you go all the way down, right? So now, if you look at the risk mandate, what we're doing is we're going to put policies here. So if we now put policies on all these, then they can start to behave like they're supposed to do. And then maybe we show, so for example, like a really cool UI here would be, let me show you here how many can access the assets. Then I click on it, and then poof, everybody accesses it, right? So that's the problem, right? So then I say, let me put risk policies on this, and the policy controls everything, right? And then we can go, but see, the problem here is that the policy, if it's enforced by the agent, you can say, then you can have the whole base one, right? Like we're still hoping that it behaves well. But if we now run, for example, some of these actions on GitHub and some of these actions on OpenRouter, then it's not possible to do that because they're not connecting to the asset, right? So you can see that that's the narrative that you want to say, right? So and that's the story arc. And then we need to show, like, we can do this at volume, right? We can basically say that we can now scale at a lot of these because the way we do that is, and I think maybe a visualization here is they say people struggle with 10, maybe you can, some of these are side by side, right? People struggle with 10 agents, 5 agents, right? Because it's a mesh. Every agent has access to everything. Every agent has access to GitHub. Every agent has access to an asset, right? Which we can say is a database, but in our case could be Gmail connectors or stuff like, in fact, you have there now, like, if you look at this connector now, this agent, especially my DNS one, actually the one you have here, I believe you have access to Gmail, to Calendar, to Drive, Slack, this one has access to Zapier, right? Every one of those has access to that, right? And that's why when you have 5 agents, any of them can lose control, any of them can make a mistake, right? Where in our agentic policies, you don't have that. Suddenly you have one agent that can go to the inbox, you have one agent that can do this, one agent that can do that, right? And I think you probably can add a bunch of scenarios there that are more simulated scenarios. It's okay, right? We have all the live scenarios in the left, and I want to add a couple more, but maybe we ask for a couple simulated scenarios, like a database or Gmail, which is actually it's not simulated because we have it on other environments, but you get the gist. And actually, if you look at risk mandate, you got some stuff there. So that's the stories that I want to say. I want to show that we can scale, but also I want to show that even from a cost point of view, there's a story here. And then also you can show, for example, the cost of us running the same type of action with, for example, maybe you show one which show every action done with the same agent, which is same model, which is super expensive. And then you show the top ones, cheap, less expensive, and then less expensive. And as you go down, which we already do, right? Maybe you have the Sonnet and so Opus and then Sonnet, and then we have the OpenRouter super cheap ones, which we have data. Cool. Right, before you write this, any questions?
