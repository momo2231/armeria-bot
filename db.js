const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(path.join(__dirname, "database.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cartellini (
      user_id TEXT PRIMARY KEY,
      inizio INTEGER,
      attivo INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ore_lavorate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      minuti INTEGER,
      paga INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fatture (
      id TEXT PRIMARY KEY,
      autore TEXT,
      cliente TEXT,
      oggetto TEXT,
      prezzo INTEGER,
      guadagno INTEGER,
      annullata INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stipendi (
      user_id TEXT PRIMARY KEY,
      totale INTEGER
    )
  `);

  console.log("✅ Database SQLite inizializzato correttamente");
});

module.exports = db;
