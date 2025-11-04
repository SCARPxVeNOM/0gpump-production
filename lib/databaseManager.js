import { open } from "sqlite";
import sqlite3 from "sqlite3";
import Redis from "ioredis";
import path from "path";
import fs from "fs";

/**
 * Professional Database Manager with Redis Caching
 * Implements the architecture recommended by ChatGPT:
 * - Redis for real-time caching (sub-millisecond)
 * - SQLite for permanent storage and indexing
 * - Connection pooling for performance
 */
class DatabaseManager {
  constructor() {
    this.db = null;
    this.redis = null;
    this.isInitialized = false;
    this.connectionPool = [];
    this.maxPoolSize = 10;
  }

  /**
   * Initialize database connections and Redis
   */
  async initialize() {
    try {
      console.log("🚀 Initializing Professional Database Manager...");
      
      // Initialize Redis connection
      await this.initializeRedis();
      
      // Initialize SQLite with connection pooling
      await this.initializeSQLite();
      
      // Create tables and indexes
      await this.createTables();
      await this.createIndexes();
      
      this.isInitialized = true;
      console.log("✅ Database Manager initialized successfully");
    } catch (error) {
      console.error("❌ Database Manager initialization failed:", error);
      throw error;
    }
  }

  /**
   * Initialize Redis connection with fallback
   */
  async initializeRedis() {
    try {
      this.redis = new Redis({
        host: 'localhost',
        port: 6379,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 2000,
        commandTimeout: 2000,
        enableOfflineQueue: false,
        retryDelayOnClusterDown: 100,
        enableReadyCheck: false,
        maxLoadingTimeout: 2000,
      });

      // Suppress Redis connection errors to reduce noise
      this.redis.on('error', (err) => {
        // Silently handle connection errors - we'll use in-memory fallback
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          // Expected when Redis is not running
          return;
        }
        console.warn('Redis error:', err.message);
      });

      // Test connection with timeout
      const pingPromise = this.redis.ping();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 2000)
      );
      
      await Promise.race([pingPromise, timeoutPromise]);
      console.log("✅ Redis connected successfully");
    } catch (error) {
      console.log("⚠️ Redis not available, using in-memory cache fallback");
      if (this.redis && typeof this.redis.disconnect === 'function') {
        this.redis.disconnect();
      }
      this.redis = new Map(); // Fallback to in-memory Map
    }
  }

  /**
   * Initialize SQLite with connection pooling
   */
  async initializeSQLite() {
    try {
      // Ensure data directory exists
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Create main database connection
      this.db = await open({
        filename: path.join(dataDir, 'coins.db'),
        driver: sqlite3.Database,
        pool: {
          min: 2,
          max: this.maxPoolSize
        }
      });

      // Enable WAL mode for better concurrency
      await this.db.exec("PRAGMA journal_mode=WAL");
      await this.db.exec("PRAGMA synchronous=NORMAL");
      await this.db.exec("PRAGMA cache_size=10000");
      await this.db.exec("PRAGMA temp_store=MEMORY");
      
      console.log("✅ SQLite database initialized with connection pooling");
    } catch (error) {
      console.error("❌ SQLite initialization failed:", error);
      throw error;
    }
  }

  /**
   * Create optimized database tables
   */
  async createTables() {
    console.log("📊 Creating optimized database tables...");

    // Coins table with enhanced indexing
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS coins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        supply TEXT NOT NULL,
        decimals INTEGER DEFAULT 18,
        description TEXT,
        creator TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        
        -- 0G Storage Integration
        imageHash TEXT,
        imageUrl TEXT,
        metadataHash TEXT,
        metadataUrl TEXT,
        imageCompressionRatio REAL,
        imageOriginalSize INTEGER,
        imageCompressedSize INTEGER,
        
        -- Blockchain Integration
        tokenAddress TEXT UNIQUE,
        curveAddress TEXT,
        txHash TEXT,
        blockNumber INTEGER,
        gasUsed INTEGER,
        gasPrice TEXT,
        
        -- Social Links
        telegramUrl TEXT,
        xUrl TEXT,
        discordUrl TEXT,
        websiteUrl TEXT,
        
        -- Market Data (calculated from on-chain)
        marketCap REAL DEFAULT 0,
        price REAL DEFAULT 0,
        volume24h REAL DEFAULT 0,
        change24h REAL DEFAULT 0,
        holders INTEGER DEFAULT 0,
        totalTransactions INTEGER DEFAULT 0,
        liquidity REAL DEFAULT 0,
        
        -- Performance tracking
        lastPriceUpdate INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        lastVolumeUpdate INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // 0G Storage files tracking
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS og_storage_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rootHash TEXT UNIQUE NOT NULL,
        fileName TEXT NOT NULL,
        fileType TEXT NOT NULL,
        originalSize INTEGER NOT NULL,
        compressedSize INTEGER NOT NULL,
        compressionRatio REAL NOT NULL,
        compressionType TEXT NOT NULL,
        uploadDate INTEGER NOT NULL,
        lastAccessed INTEGER NOT NULL,
        accessCount INTEGER DEFAULT 1,
        isActive BOOLEAN DEFAULT 1,
        metadata TEXT,
        coinId TEXT,
        FOREIGN KEY (coinId) REFERENCES coins(id) ON DELETE SET NULL
      )
    `);

    // Trading history with proper indexing
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS trading_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coinId TEXT NOT NULL,
        userAddress TEXT NOT NULL,
        txHash TEXT NOT NULL,
        blockNumber INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'add_liquidity', 'remove_liquidity')),
        amount TEXT NOT NULL,
        amountOg REAL,
        price REAL,
        volume REAL,
        gasUsed INTEGER,
        gasPrice TEXT,
        FOREIGN KEY (coinId) REFERENCES coins(id) ON DELETE CASCADE
      )
    `);

    // User favorites
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userAddress TEXT NOT NULL,
        coinId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        UNIQUE(userAddress, coinId),
        FOREIGN KEY (coinId) REFERENCES coins(id) ON DELETE CASCADE
      )
    `);

    // User profiles mapping (hybrid storage support)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        walletAddress TEXT UNIQUE NOT NULL,
        profileData TEXT, -- JSON data for database-first storage
        profileHash TEXT, -- 0G Storage hash for proof of history (optional)
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Market data cache for real-time updates
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS market_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coinId TEXT NOT NULL,
        dataType TEXT NOT NULL CHECK (dataType IN ('price', 'volume', 'market_cap', 'holders')),
        value REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        UNIQUE(coinId, dataType, timestamp)
      )
    `);

    // Gaming credits (simple off-chain balance used by mini-games)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS gaming_credits (
        userAddress TEXT PRIMARY KEY,
        balance INTEGER DEFAULT 1000,
        updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Coinflip game history
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS gaming_coinflip (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userAddress TEXT NOT NULL,
        wager INTEGER NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('win','lose')),
        seedHash TEXT NOT NULL,
        seedReveal TEXT NOT NULL,
        blockNumber INTEGER,
        blockHash TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Attempt to add missing columns for existing installations
    try { await this.db.exec(`ALTER TABLE gaming_coinflip ADD COLUMN blockNumber INTEGER`); } catch {}
    try { await this.db.exec(`ALTER TABLE gaming_coinflip ADD COLUMN blockHash TEXT`); } catch {}
    // Add P2P multiplayer support
    try { await this.db.exec(`ALTER TABLE gaming_coinflip ADD COLUMN matchId TEXT`); } catch {}
    try { await this.db.exec(`ALTER TABLE gaming_coinflip ADD COLUMN opponentAddress TEXT`); } catch {}
    try { await this.db.exec(`ALTER TABLE gaming_coinflip ADD COLUMN matchType TEXT DEFAULT 'solo'`); } catch {}
    try { await this.db.exec(`ALTER TABLE gaming_coinflip ADD COLUMN tokenAddress TEXT`); } catch {}
    try { await this.db.exec(`ALTER TABLE gaming_coinflip ADD COLUMN stakeTxHash TEXT`); } catch {}

    // PumpPlay rounds (prediction game)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS gaming_pumpplay_rounds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        endsAt INTEGER NOT NULL,
        candidates TEXT NOT NULL, -- JSON array of coin ids
        status TEXT NOT NULL CHECK (status IN ('open','closed','resolved')) DEFAULT 'open',
        winnerCoinId TEXT,
        totalPool INTEGER DEFAULT 0,
        matchType TEXT DEFAULT 'pool' CHECK (matchType IN ('pool','p2p')),
        matchId TEXT, -- For P2P head-to-head matches
        player1Address TEXT,
        player2Address TEXT
      )
    `);

    // PumpPlay bets
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS gaming_pumpplay_bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roundId INTEGER NOT NULL,
        userAddress TEXT NOT NULL,
        coinId TEXT NOT NULL,
        amount INTEGER NOT NULL,
        tokenAddress TEXT,
        stakeTxHash TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (roundId) REFERENCES gaming_pumpplay_rounds(id) ON DELETE CASCADE
      )
    `);

    // Meme Royale AI battles
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS gaming_meme_royale (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        leftCoinId TEXT NOT NULL,
        rightCoinId TEXT NOT NULL,
        leftScore REAL,
        rightScore REAL,
        winnerCoinId TEXT,
        judge TEXT DEFAULT '0g-compute',
        matchType TEXT DEFAULT 'auto' CHECK (matchType IN ('auto','p2p')),
        matchId TEXT, -- For P2P direct challenges
        player1Address TEXT, -- Player who chose left coin
        player2Address TEXT, -- Player who chose right coin
        player1Stake REAL,
        player2Stake REAL,
        tokenAddress TEXT,
        stakeTxHash TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Mines game sessions (now supports P2P matches)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS gaming_mines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userAddress TEXT NOT NULL,
        betAmount REAL NOT NULL,
        tokenAddress TEXT NOT NULL,
        minesCount INTEGER NOT NULL,
        gridState TEXT NOT NULL,
        revealedTiles TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','won','lost','cashed_out','waiting_match')),
        currentMultiplier REAL DEFAULT 1.0,
        cashoutAmount REAL,
        cashoutTx TEXT,
        matchId TEXT, -- Links players in P2P matches
        opponentAddress TEXT, -- For P2P matches
        matchType TEXT DEFAULT 'solo' CHECK (matchType IN ('solo','p2p')),
        lobbyId TEXT, -- For matchmaking lobbies
        stakeTxHash TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        completedAt INTEGER
      )
    `);

    // Unified Multiplayer Matchmaking System (for all games)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS gaming_matchmaking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gameType TEXT NOT NULL CHECK (gameType IN ('mines','coinflip','pumpplay','meme-royale','roulette')),
        creatorAddress TEXT NOT NULL,
        tokenAddress TEXT NOT NULL,
        betAmount REAL NOT NULL,
        gameParams TEXT, -- JSON for game-specific params (minesCount, guess, coinId, etc.)
        lobbyType TEXT DEFAULT 'public' CHECK (lobbyType IN ('public','private')),
        status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','matched','cancelled','expired')),
        matchId TEXT,
        opponentAddress TEXT,
        stakeTxHash TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        matchedAt INTEGER,
        expiresAt INTEGER -- Auto-expire old lobbies (5 minutes)
      )
    `);

    // Mines matchmaking lobbies (legacy - kept for backward compatibility)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS gaming_mines_lobbies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creatorAddress TEXT NOT NULL,
        tokenAddress TEXT NOT NULL,
        betAmount REAL NOT NULL,
        minesCount INTEGER NOT NULL,
        lobbyType TEXT DEFAULT 'public' CHECK (lobbyType IN ('public','private')),
        status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','matched','cancelled')),
        matchId TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        matchedAt INTEGER
      )
    `);

    // Migrate existing gaming_mines table to add new columns
    try { await this.db.exec(`ALTER TABLE gaming_mines ADD COLUMN matchId TEXT`); } catch {}
    
    // Roulette game history
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS gaming_roulette (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userAddress TEXT NOT NULL,
        totalBet REAL NOT NULL,
        bets TEXT NOT NULL, -- JSON object of bet types and amounts
        winningNumber INTEGER NOT NULL CHECK (winningNumber >= 0 AND winningNumber <= 36),
        color TEXT NOT NULL CHECK (color IN ('red','black','green')),
        parity TEXT NOT NULL CHECK (parity IN ('even','odd','none')),
        winnings REAL DEFAULT 0,
        tokenAddress TEXT NOT NULL,
        stakeTxHash TEXT,
        payoutTx TEXT,
        blockNumber INTEGER,
        blockHash TEXT,
        seedHash TEXT NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);
    try { await this.db.exec(`ALTER TABLE gaming_mines ADD COLUMN opponentAddress TEXT`); } catch {}
    try { await this.db.exec(`ALTER TABLE gaming_mines ADD COLUMN matchType TEXT DEFAULT 'solo'`); } catch {}
    try { await this.db.exec(`ALTER TABLE gaming_mines ADD COLUMN lobbyId TEXT`); } catch {}
    try { await this.db.exec(`ALTER TABLE gaming_mines ADD COLUMN stakeTxHash TEXT`); } catch {}

    console.log("✅ Database tables created successfully");
  }

  /**
   * Create optimized indexes for fast queries
   */
  async createIndexes() {
    console.log("🔍 Creating optimized database indexes...");

    // Coins table indexes
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_coins_creator ON coins(creator);
      CREATE INDEX IF NOT EXISTS idx_coins_token_address ON coins(tokenAddress);
      CREATE INDEX IF NOT EXISTS idx_coins_curve_address ON coins(curveAddress);
      CREATE INDEX IF NOT EXISTS idx_coins_tx_hash ON coins(txHash);
      CREATE INDEX IF NOT EXISTS idx_coins_market_cap ON coins(marketCap DESC);
      CREATE INDEX IF NOT EXISTS idx_coins_volume ON coins(volume24h DESC);
      CREATE INDEX IF NOT EXISTS idx_coins_price ON coins(price DESC);
      CREATE INDEX IF NOT EXISTS idx_coins_created ON coins(createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_coins_updated ON coins(updatedAt DESC);
    `);

    // Trading history indexes
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_trading_coin ON trading_history(coinId);
      CREATE INDEX IF NOT EXISTS idx_trading_user ON trading_history(userAddress);
      CREATE INDEX IF NOT EXISTS idx_trading_timestamp ON trading_history(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_trading_type ON trading_history(type);
      CREATE INDEX IF NOT EXISTS idx_trading_coin_time ON trading_history(coinId, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_trading_user_time ON trading_history(userAddress, timestamp DESC);
    `);

    // User favorites indexes
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(userAddress, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_favorites_coin ON user_favorites(coinId);
    `);

    // 0G Storage files indexes
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_og_files_hash ON og_storage_files(rootHash);
      CREATE INDEX IF NOT EXISTS idx_og_files_coin ON og_storage_files(coinId);
      CREATE INDEX IF NOT EXISTS idx_og_files_accessed ON og_storage_files(lastAccessed DESC);
    `);

    // Market cache indexes
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_market_cache_coin ON market_cache(coinId);
      CREATE INDEX IF NOT EXISTS idx_market_cache_type ON market_cache(dataType);
      CREATE INDEX IF NOT EXISTS idx_market_cache_time ON market_cache(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_market_cache_coin_type ON market_cache(coinId, dataType, timestamp DESC);
    `);

    // Gaming indexes
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_gaming_coinflip_user ON gaming_coinflip(userAddress, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_gaming_pumpplay_round ON gaming_pumpplay_bets(roundId);
      CREATE INDEX IF NOT EXISTS idx_gaming_pumpplay_user ON gaming_pumpplay_bets(userAddress);
      CREATE INDEX IF NOT EXISTS idx_gaming_meme_royale_time ON gaming_meme_royale(createdAt DESC);
    `);

    console.log("✅ Database indexes created successfully");
  }

  /**
   * Redis cache operations with fallback
   */
  async cacheSet(key, value, ttl = 300) {
    try {
      if (this.redis instanceof Map) {
        // In-memory fallback
        this.redis.set(key, JSON.stringify(value));
        return true;
      } else {
        // Redis
        await this.redis.setex(key, ttl, JSON.stringify(value));
        return true;
      }
    } catch (error) {
      console.warn(`Cache set failed for key ${key}:`, error.message);
      return false;
    }
  }

  async cacheGet(key) {
    try {
      if (this.redis instanceof Map) {
        // In-memory fallback
        const value = this.redis.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        // Redis
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
      }
    } catch (error) {
      console.warn(`Cache get failed for key ${key}:`, error.message);
      return null;
    }
  }

  async cacheDel(key) {
    try {
      if (this.redis instanceof Map) {
        // In-memory fallback
        return this.redis.delete(key);
      } else {
        // Redis
        return await this.redis.del(key);
      }
    } catch (error) {
      console.warn(`Cache delete failed for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get database connection
   */
  async getConnection() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.db;
  }

  /**
   * Close all connections
   */
  async close() {
    try {
      if (this.db) {
        await this.db.close();
      }
      if (this.redis && !(this.redis instanceof Map)) {
        await this.redis.quit();
      }
      console.log("✅ Database connections closed");
    } catch (error) {
      console.error("Error closing database connections:", error);
    }
  }
}

// Export singleton instance
export const databaseManager = new DatabaseManager();
export default databaseManager;
