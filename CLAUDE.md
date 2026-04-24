# AgencyPulse Backend — Claude Instructions

Same rules as D:\projects\agencypulse\CLAUDE.md — both files are kept in sync.

## This Repo
NestJS + TypeScript backend for AgencyPulse.

## Documentation (ALWAYS read and update)
- `docs/DECISIONS.md` — Architecture decisions
- `docs/FEATURES.md` — Feature build log
- `docs/CHALLENGES.md` — Challenges & solutions
- `docs/RESEARCH.md` — Platform research
- `docs/STACK.md` — Confirmed tech stack
- `docs/PROGRESS.md` — Build progress tracker

## Rules
1. Read docs before starting any task
2. Plan first — never implement without user saying "proceed"
3. One feature at a time
4. Update docs after every feature, decision, and challenge
5. Step order: DB schema → API design → Implementation → Tests → Frontend connection
6. tenant_id on EVERY table — RLS enforced from day one


## Note: always be align with the agency analytic platform as we are building like that ony and for that feature if u want you can look at the others also but mainly we are building the clone of this agency analytics platfrom and the floned is also cloned like that platfrom only as i said earlier



## how we started , the first prompt i gave to you 


You are a senior full-stack architect and developer helping me build a production-grade SaaS platform similar to AgencyAnalytics (https://agencyanalytics.com/) .

PROJECT CONTEXT:
We are building a multi-tenant SaaS platform for marketing agencies. Agencies can connect multiple marketing platforms (Google Ads, Meta Ads, etc.), fetch data via APIs, store it as time-series data, and display it through dashboards and automated reports.

SYSTEM OVERVIEW:

* Multi-tenant architecture (agency → clients → campaigns)
* OAuth-based integrations
* Background job system for data fetching (no real-time API calls)
* Time-series data storage
* Dashboard with drag-and-drop widgets
* Report generation (PDF + scheduled email)
* Role-based access (admin, staff, client)
* White-label support

IMPORTANT ARCHITECTURE RULES:

1. Backend-first development approach
2. No direct API calls from frontend to external services
3. All external APIs handled via integration layer
4. Use background jobs for data fetching
5. Store normalized data in database
6. Frontend consumes only backend APIs
7. Design for scalability from day one

FILES PROVIDED:

* Product blueprint document (detailed feature list, flows, roles)
* Frontend UI (not final, just reference)

YOUR TASK:

1. First, analyze the provided documents and understand the full system
2. Do additional research on AgencyAnalytics-like platforms and similar SaaS architectures
3. Then help me build this system step-by-step in a clean and production-ready way

DEVELOPMENT APPROACH:

* We will build feature-by-feature (vertical slices)
* Each step should include:

  * DB design
  * API design
  * Backend implementation
  * Testing strategy
  * Then frontend integration

CONSTRAINTS:

* Do NOT try to build everything at once
* Keep architecture clean and scalable
* Prioritize core systems first
* Avoid overengineering initially but design for extensibility

FIRST TASK:
Help me design the backend foundation:

* Entities (Agency, User, Client, Campaign)
* Database schema
* API endpoints
* Folder structure

Then we will implement step-by-step.

Always explain:

* Why we are doing something
* How it works internally
* What problem it solves


IMPORTANT:

The frontend and provided documents are NOT final sources of truth.
They are only references for UI and feature ideas.
All architectural decisions must be made based on best practices and scalable system design.

Help design backend systems from first principles
Suggest production-grade architecture
Challenge incorrect assumptions
Do not blindly follow provided frontend or documents

PROJECT GOAL:
Build a multi-tenant SaaS analytics platform exact clone like https://agencyanalytics.com/



yah here since we are doing exactly like that https://agencyanalytics.com/ platfrom so to build that frontend i used the google ai studio and cloned that as i asked that studo to make the exact clone of that platfrom and it did like this  D:\projects\agencypulse>  but here i feel like some are missing and some are more some are broken like that but i dont want to hang in that so we will get started and we will adjust that frontend as we start keep building one by one not all at once.

and next here i researched and understood the platform as of my research here it is : D:\projects\agency-backend\my-reseach.txt and here this is just my understand of the flow of the platform 

and then when i asked that google ai studio to see that agency analytic platform and build that built this frontend and also gave this its own research : D:\projects\agency-backend\GoogleAiStudioReseaarch.txt

so here one thing to mainly note that all these are just to getting know what we are doing and what and how we will be going forward and none of these are final source of truth they are just for an idea and here everything we will be deciding going forward one by one when we start something we will reseach we will think and we will implement the best and then next and same process 
 

and here one more thing i need to mention that is as as i told u ryt that frontend which is cloned might be inconsistent or not full something like that so u should not do like that frontend is not there no need to build like that nothing . we need everything as we go we will adjust the frontend make the changes . we build that feature if we have that frontend we will connect if not we will add and connect if that is broken we will fix and move froward like that as we need all the features thats why i told u all those will not be the final source of truth.


yah see all these get the context and i have added this to the claude.md and if u want to add anything for ur self u can add to that as what happens means as the chat grows u will go out of the context so i dont want to face that problem . so see this claude.md and after each feature we build we will update some doc u can create some .md file and after each challenge we face u need to log that to another .md file to that like that challange we faced and how we fixed. and then for each decision we take that u have to log to another .md file like what was that decision and why etc , and each feature feature we build that needs to be updated in some doc .md in detail and etc for any other things create other .md and update that accordingly and here u note this in that claude.md like u have to always look these docs and always update these docs and also not in that claude.md that u have to not directly proceed to implement we have to plan and decide and when i say proceed then only we will be moving to next and we will be doing step by step and one step at a time.

what every u want u create or use the existing .md file and update that so that u dont forget anything and u alswys be in the context of what we are doing 

yah i have mentioned almost what i need to if any missed u can consider 

yah now first go and do the websearch and analyse everything we need to do including u know about reach about that agency alalytics platfrom etc look for all the required things and that also u can add to some doc file .md 


frontend: D:\projects\agencypulse
backend: D:\projects\agency-backend