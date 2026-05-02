# Notification System Design

## Stage 1
### REST API Design
A robust set of endpoints to manage student notifications.

| Endpoint | Method | Request Body | Description |
|---|---|---|---|
| `/api/notifications` | GET | None | Fetch all notifications for the authenticated student. |
| `/api/notifications/unread` | GET | None | Fetch only unread notifications. |
| `/api/notifications` | POST | `{"type": "Event", "message": "..."}` | Create a new notification (Admin only). |
| `/api/notifications/:id/read` | PUT | None | Mark a specific notification as read. |
| `/api/notifications/read-all` | PUT | None | Mark all unread notifications as read. |
| `/api/notifications/type/:type` | GET | None | Fetch notifications filtered by type (`Placement`, `Result`, `Event`). |
| `/api/notifications/:id` | DELETE | None | Delete a specific notification. |

**Request Headers (for all endpoints):**
`Authorization: Bearer <access_token>`

**JSON Schema for Responses:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "student_id": 1042,
      "type": "Placement",
      "message": "Interview scheduled",
      "is_read": false,
      "created_at": "2026-05-02T10:00:00Z"
    }
  ]
}
```

**Real-time Notification Mechanism:**
I chose **Server-Sent Events (SSE)**.
*Justification:* Notifications are typically a one-way flow of data (server to client). While WebSockets provide full-duplex communication, they are often overkill for simple notifications and require more complex state management and infrastructure (e.g., ping/pong to keep alive). SSE operates over standard HTTP, leverages built-in browser reconnection, and is highly efficient for streaming unidirectional real-time updates to clients.

## Stage 2
### Database Design
**Database Choice:** PostgreSQL.
*Justification:* Notifications involve structured data with clear relationships (e.g., to Students). PostgreSQL offers strong ACID compliance, excellent indexing capabilities (including partial indexes and JSONB if needed later), and table partitioning, which is crucial for handling high-volume time-series data like notifications.

**Schema:**
*Table: `students`*
- `student_id` (INT, Primary Key)
- `name` (VARCHAR)
- `email` (VARCHAR, UNIQUE)

*Table: `notifications`*
- `id` (UUID, Primary Key)
- `student_id` (INT, Foreign Key referencing `students.student_id`)
- `type` (VARCHAR(20), CHECK type IN ('Event', 'Result', 'Placement'))
- `message` (TEXT)
- `is_read` (BOOLEAN, DEFAULT FALSE)
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

**Indexes:**
- `idx_student_unread` on `(student_id, is_read)`
- `idx_created_at` on `(created_at)`

**Problems at Scale (50,000 students, 5,000,000 notifications):**
- *Problem 1: Query Degradation:* Fetching unread notifications requires scanning growing tables.
  *Solution:* Implement covering composite indexes on `(student_id, is_read, created_at DESC)`.
- *Problem 2: Storage Size and Memory Swapping:* The active working set outgrows RAM.
  *Solution:* Use PostgreSQL Table Partitioning by `created_at` (e.g., monthly partitions). Old notifications are rarely accessed and can reside on slower disks or be archived.

**SQL Queries for Endpoints:**
- Fetch all: `SELECT * FROM notifications WHERE student_id = $1 ORDER BY created_at DESC;`
- Fetch unread: `SELECT * FROM notifications WHERE student_id = $1 AND is_read = false ORDER BY created_at DESC;`
- Mark as read: `UPDATE notifications SET is_read = true WHERE id = $1 AND student_id = $2;`
- Mark all as read: `UPDATE notifications SET is_read = true WHERE student_id = $1 AND is_read = false;`
- Create: `INSERT INTO notifications (student_id, type, message) VALUES ($1, $2, $3) RETURNING *;`
- Fetch by type: `SELECT * FROM notifications WHERE student_id = $1 AND type = $2;`
- Delete: `DELETE FROM notifications WHERE id = $1 AND student_id = $2;`

## Stage 3
### Query Analysis & Optimization
**Given Query:**
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

1. **Is this query accurate?** Yes, semantically it correctly requests unread notifications for a specific student, ordered from newest to oldest.
2. **Why is it slow?** Without a dedicated composite index, the database engine must perform a sequential scan or use an inefficient index, reading many rows, filtering them in memory, and sorting them dynamically (`File Sort`). On 5,000,000 rows, this computation is incredibly slow.
3. **What would you change? Computation cost before and after?**
   - *Change:* I would add a composite index: `CREATE INDEX idx_student_unread_sort ON notifications(studentID, isRead, createdAt DESC);`
   - *Cost Before:* O(N) or a full table scan + O(M log M) for sorting the filtered M rows.
   - *Cost After:* O(log N) to traverse the B-Tree directly to the pre-sorted unread records for that student.
4. **Is adding indexes on every column good advice?** No. Indexes severely slow down write operations (INSERT, UPDATE, DELETE) because every index must be updated synchronously. They also consume significant disk space and memory. Indexing low-cardinality columns (like boolean `isRead` by itself) creates unbalanced, useless trees.
5. **Optimized query for 'Placement' notifications in the last 7 days:**
```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= NOW() - INTERVAL '7 days';
```

## Stage 4
### Caching Strategy
**Recommended Solution:** Redis (Key-Value Store).

**Technical Implementation:**
- Store a cached JSON array or a Redis List/Sorted Set for each user's unread notifications: `notifications:unread:{studentID}`.

**Tradeoffs:**
- *TTL-based cache:* Simple, but runs the risk of serving stale data (e.g., user marks as read on mobile, but web still shows unread until TTL expires).
- *Cache invalidation on write:* Guarantees high consistency. When a notification is created or marked read, we delete/update the key in Redis. Tradeoff is a slightly higher write penalty and more complex backend logic.
- *Redis vs In-Memory (Node Cache):* In-memory is fast but isolated to a single server instance. If we scale out to multiple Node instances, user state becomes inconsistent across load balancers. Redis provides a centralized, distributed cache.

**Cache Invalidation on New Notification:**
- When an API inserts a new notification into the DB, it triggers an event.
- The event handler executes a Redis command: `DEL notifications:unread:{studentID}` (or appends to the Redis list if using a write-through pattern).
- The next client request will experience a cache miss, fetch fresh from the DB, and re-populate the cache.

## Stage 5
### Reliability at Scale
**Shortcomings of the pseudocode:**
1. **Sequential & Synchronous Execution:** Processing 50,000 students synchronously in a single thread will take a massive amount of time.
2. **Lack of Fault Tolerance:** If the server crashes or the loop breaks halfway, the system loses track of who was notified.
3. **No Retries:** Transient network failures in `send_email` or `push_to_app` will permanently drop the notification.

**Logs show send_email failed for 200 students midway:**
- In the current design, if the loop crashes due to an unhandled exception during the failure, the remaining students receive nothing. If it suppresses the error, the 200 students are lost forever without a retry mechanism. To fix it manually, we'd have to write ad-hoc DB queries to diff who got it vs who didn't.

**Redesign for Reliability and Speed:**
- Use an **Asynchronous Message Queue** (e.g., RabbitMQ, SQS, or Kafka).
- The main function just creates the DB records as "pending" and enqueues messages.
- A pool of independent Worker processes consumes the queue concurrently. If a worker fails, the message goes to a Dead Letter Queue (DLQ) for retries.

**Should saving to DB and sending email be in the same transaction?**
No. Sending an email is an external side-effect that cannot be rolled back. If you send the email and the DB transaction subsequently fails/rolls back, the user received an email for a notification that technically doesn't exist in the system. DB writes should happen first, followed by external actions.

**Revised Pseudocode:**
```javascript
function notify_all(student_ids: array, message: string):
    // 1. Bulk insert to DB with status 'pending'
    save_notification_batch_to_db(student_ids, message, "pending")
    
    // 2. Publish to queue for asynchronous processing
    for student_id in student_ids:
        publish_to_queue(student_id, message)

// Independent worker process running continuously
function queue_worker(job):
    student_id = job.student_id
    message = job.message
    
    try:
        send_email(student_id, message)
        push_to_app(student_id, message)
        update_db_status(student_id, "sent")
    except Exception as e:
        // Automatically retried by the queue based on backoff policy
        mark_job_as_failed_and_requeue(job, e)
```

## Stage 6
### Priority Inbox Algorithm

**Approach:**
1. Fetch all notifications from the live API.
2. Filter for unread notifications (though the API response in the prompt doesn't explicitly mention `isRead`, we assume we filter or handle them all if they are considered "inbox").
3. Assign a baseline weight based on type: Placement (300), Result (200), Event (100).
4. Calculate recency: The difference in hours (or minutes) between now and the timestamp.
5. Compute a final score: `Score = BaselineWeight - (HoursElapsed * DecayFactor)`.
6. Sort by the calculated score in descending order.
7. Return the top 10.

*Code and screenshots for Stage 6 are implemented in the `notification_app_be/priority_inbox` folder.*
