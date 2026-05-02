const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const NodeCache = require('node-cache');
const { EventEmitter } = require('events');
const { Log } = require('../logging_middleware');

const app = express();
app.use(express.json());

const db = new sqlite3.Database(':memory:');
const cache = new NodeCache({ stdTTL: 300 }); 
const queue = new EventEmitter();

db.serialize(() => {
    db.run(`CREATE TABLE students (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE
    )`);
    db.run(`CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        type TEXT,
        message TEXT,
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE INDEX idx_student_unread ON notifications(student_id, is_read, created_at DESC)`);
    
    db.run(`INSERT INTO students (id, name, email) VALUES (1042, 'Krishna Lodha', 'kl8868@srmsti.edu.in')`);
});

app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        Log("backend", "error", "middleware", "Unauthorized access attempt");
        return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = { id: 1042 };
    next();
});

queue.on('new_notification', (job) => {
    try {
        Log("backend", "info", "cron_job", `Sending email to student ${job.student_id}`);
        Log("backend", "info", "cron_job", `Pushing app notification to student ${job.student_id}`);
    } catch (e) {
        Log("backend", "error", "cron_job", `Failed to send notification: ${e.message}`);
    }
});

app.get('/api/notifications', (req, res) => {
    Log("backend", "info", "route", "Fetching all notifications");
    db.all(`SELECT * FROM notifications WHERE student_id = ? ORDER BY created_at DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ notifications: rows });
    });
});

app.get('/api/notifications/unread', (req, res) => {
    Log("backend", "info", "route", "Fetching unread notifications");
    const cacheKey = `unread_${req.user.id}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        Log("backend", "debug", "cache", "Cache hit for unread notifications");
        return res.json({ notifications: cached });
    }
    
    db.all(`SELECT * FROM notifications WHERE student_id = ? AND is_read = 0 ORDER BY created_at DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        cache.set(cacheKey, rows);
        Log("backend", "debug", "cache", "Cache miss, populated cache");
        res.json({ notifications: rows });
    });
});

app.put('/api/notifications/:id/read', (req, res) => {
    Log("backend", "info", "route", `Marking notification ${req.params.id} as read`);
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ? AND student_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        cache.del(`unread_${req.user.id}`); 
        res.json({ message: "Notification marked as read" });
    });
});

app.put('/api/notifications/read-all', (req, res) => {
    Log("backend", "info", "route", "Marking all notifications as read");
    db.run(`UPDATE notifications SET is_read = 1 WHERE student_id = ? AND is_read = 0`, [req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        cache.del(`unread_${req.user.id}`);
        res.json({ message: "All notifications marked as read" });
    });
});

app.post('/api/notifications', (req, res) => {
    const { type, message } = req.body;
    Log("backend", "info", "route", "Creating new notification");
    
    db.run(`INSERT INTO notifications (student_id, type, message) VALUES (?, ?, ?)`, [req.user.id, type, message], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        cache.del(`unread_${req.user.id}`);
        
        queue.emit('new_notification', {
            id: this.lastID,
            student_id: req.user.id,
            type,
            message
        });
        
        res.status(201).json({ id: this.lastID, message: "Notification created" });
    });
});

app.delete('/api/notifications/:id', (req, res) => {
    Log("backend", "info", "route", `Deleting notification ${req.params.id}`);
    db.run(`DELETE FROM notifications WHERE id = ? AND student_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        cache.del(`unread_${req.user.id}`); 
        res.json({ message: "Notification deleted" });
    });
});

app.get('/api/notifications/type/:type', (req, res) => {
    Log("backend", "info", "route", `Fetching notifications of type ${req.params.type}`);
    db.all(`SELECT * FROM notifications WHERE student_id = ? AND type = ? ORDER BY created_at DESC`, [req.user.id, req.params.type], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ notifications: rows });
    });
});

app.use((req, res) => {
    console.log("Unmatched route:", req.method, req.url);
    res.status(404).json({ error: "My Express 404", path: req.url });
});

app.listen(31337, () => {
    Log("backend", "info", "service", "Notification microservice started on port 31337");
    console.log("Server running on port 31337");
});
