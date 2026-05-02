# Campus Hiring Evaluation - Backend Track

This repository contains the complete implementation for the Backend Engineering Evaluation. It is structured into multiple discrete phases covering custom npm packages, system design, microservice architecture, and algorithmic problem solving.

## Directory Structure

- `logging_middleware/`: A reusable npm package for API-based logging.
- `notification_app_be/`: A robust Node.js/Express backend microservice handling notifications, caching, and real-time queues.
- `notification_system_design.md`: A comprehensive system design document addressing database schemas, scaling, and architectural choices.
- `vehicle_maintence_scheduler/`: An algorithmic solution to a resource allocation problem using 0/1 Knapsack DP.

## Phase 1: Logging Middleware
A generic TypeScript/JavaScript middleware package that securely routes logging events (debug, info, warn, error) to an external centralized logging API. It is completely decoupled and imported across the entire codebase.

## Phase 2: Notification System Design
A detailed technical document outlining:
1. REST API contracts.
2. PostgreSQL relational models and indexing strategies.
3. Query analysis and optimization for large-scale datasets.
4. Redis caching implementation for high-throughput reads.
5. Asynchronous Message Queues for fault-tolerant external dispatch (emails, push notifications).
6. A Priority Inbox algorithm (fully coded in `notification_app_be/priority_inbox/index.js`).

## Phase 3: Notification Backend Microservice
A fully functional REST API built with Express.
- Features JWT-based authentication.
- Integrates in-memory SQL for seamless local execution.
- Employs a robust event-driven architecture to simulate asynchronous job processing.
- Logs all operations implicitly via the `logging_middleware`.

## Phase 4: Vehicle Maintenance Scheduler
An optimal scheduling engine leveraging dynamic programming.
- Fetches real-time constraints (budgets, task durations, impact).
- Processes inputs using an optimized 0/1 Knapsack algorithm to yield the highest possible impact under strict time limits.
- Validated with robust logging and verifiable text-based outputs.

## Usage & Execution
All modules are built to run independently. Navigate to any respective folder and run:
```bash
npm install
node index.js 
```
