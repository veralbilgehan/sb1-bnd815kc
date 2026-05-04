import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type User, insertUserSchema, insertShiftSchema, insertActivitySchema, insertMessageSchema, insertCompanySchema, insertActivityTypeSchema, insertSalesRecordSchema, insertCompanySettingsSchema, insertGroupSchema, insertGroupMessageSchema } from "../shared/schema.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import pg from "pg";

function isStrongPassword(password: string): boolean {
  if (password.length < 10) {
    return false;
  }

  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}

// Vercel can only write to /tmp, local/server deployments can use project folder.
const uploadBaseDir = process.env.VERCEL ? "/tmp" : process.cwd();
const uploadDir = path.join(uploadBaseDir, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: fileStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/heic",
      "image/heif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Desteklenmeyen dosya türü"));
    }
  },
});

// Configure Passport
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return done(null, false, { message: "Kullanıcı adı veya şifre hatalı" });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user || null);
  } catch (err) {
    done(err);
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // PostgreSQL session store
  const PgSession = connectPgSimple(session);
  const pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Session middleware with PostgreSQL store
  app.use(
    session({
      store: new PgSession({
        pool: pgPool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "turkish-company-secret-key-2024",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Yetkilendirme gerekli" });
    }
    next();
  };

  // WebSocket for chat - disabled for now to avoid conflicts with Vite HMR
  // Will be implemented separately or using HTTP polling

  // Auth routes
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Sunucu hatası" });
      }
      if (!user) {
        return res.status(401).json({ message: info.message || "Giriş başarısız" });
      }
      req.login(user, async (err) => {
        if (err) {
          return res.status(500).json({ message: "Giriş hatası" });
        }
        
        let company = null;
        if (user.companyId) {
          company = await storage.getCompany(user.companyId);
        }
        
        return res.json({ 
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            department: user.department,
            avatar: user.avatar,
            companyId: user.companyId,
          },
          company: company ? {
            id: company.id,
            name: company.name,
          } : null
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Çıkış başarılı" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    const user = req.user as User;
    
    let company = null;
    if (user.companyId) {
      company = await storage.getCompany(user.companyId);
    }
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        avatar: user.avatar,
        companyId: user.companyId,
      },
      company: company ? {
        id: company.id,
        name: company.name,
      } : null
    });
  });

  // Role-based middleware
  const requireSuperAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: "Bu işlem için süper admin yetkisi gerekli" });
    }
    next();
  };

  const requireManager = (req: any, res: any, next: any) => {
    if (!['super_admin', 'manager'].includes(req.user?.role)) {
      return res.status(403).json({ message: "Bu işlem için yönetici yetkisi gerekli" });
    }
    next();
  };

  // Company routes
  app.get("/api/companies", requireAuth, requireSuperAdmin, async (req: any, res) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json({ companies });
    } catch (error) {
      console.error("Get companies error:", error);
      res.status(500).json({ message: "Şirketler alınamadı" });
    }
  });

  app.post("/api/companies", requireAuth, requireSuperAdmin, async (req: any, res) => {
    try {
      const parsed = insertCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Geçersiz şirket bilgisi" });
      }
      const company = await storage.createCompany(parsed.data);
      res.json({ company });
    } catch (error) {
      console.error("Create company error:", error);
      res.status(500).json({ message: "Şirket oluşturulamadı" });
    }
  });

  // Activity Types routes
  app.get("/api/activity-types", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      let activityTypes;
      
      if (user.role === 'super_admin') {
        activityTypes = await storage.getDefaultActivityTypes();
      } else if (user.companyId) {
        activityTypes = await storage.getActivityTypesByCompany(user.companyId);
      } else {
        activityTypes = await storage.getDefaultActivityTypes();
      }
      
      res.json({ activityTypes });
    } catch (error) {
      console.error("Get activity types error:", error);
      res.status(500).json({ message: "Aktivite türleri alınamadı" });
    }
  });

  app.post("/api/activity-types", requireAuth, requireManager, async (req: any, res) => {
    try {
      const user = req.user as User;
      const parsed = insertActivityTypeSchema.safeParse({
        name: req.body.name,
        category: req.body.category || 'activity',
        points: req.body.points || 1,
        companyId: user.role === 'super_admin' ? null : user.companyId,
        isDefault: user.role === 'super_admin' ? (req.body.isDefault || false) : false,
      });
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Geçersiz aktivite türü bilgisi" });
      }
      
      const activityType = await storage.createActivityType(parsed.data);
      res.json({ activityType });
    } catch (error) {
      console.error("Create activity type error:", error);
      res.status(500).json({ message: "Aktivite türü oluşturulamadı" });
    }
  });

  app.put("/api/activity-types/:id", requireAuth, requireManager, async (req: any, res) => {
    try {
      const updates: any = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.points !== undefined) updates.points = req.body.points;
      if (req.body.category !== undefined) updates.category = req.body.category;
      
      const activityType = await storage.updateActivityType(req.params.id, updates);
      res.json({ activityType });
    } catch (error) {
      console.error("Update activity type error:", error);
      res.status(500).json({ message: "Aktivite türü güncellenemedi" });
    }
  });

  // User management routes (for managers)
  app.get("/api/company/users", requireAuth, requireManager, async (req: any, res) => {
    try {
      const user = req.user as User;
      
      let users;
      if (user.role === 'super_admin') {
        users = await storage.getAllUsers();
      } else if (user.companyId) {
        users = await storage.getUsersByCompany(user.companyId);
      } else {
        return res.status(400).json({ message: "Şirket bilgisi bulunamadı" });
      }
      
      const sanitizedUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        department: u.department,
        avatar: u.avatar,
        companyId: u.companyId,
      }));
      
      res.json({ users: sanitizedUsers });
    } catch (error) {
      console.error("Get company users error:", error);
      res.status(500).json({ message: "Kullanıcılar alınamadı" });
    }
  });

  app.post("/api/company/users", requireAuth, requireManager, async (req: any, res) => {
    try {
      const manager = req.user as User;

      if (!isStrongPassword(String(req.body.password || ""))) {
        return res.status(400).json({
          message: "Şifre en az 10 karakter olmalı ve en az 1 harf ile 1 rakam içermelidir",
        });
      }
      
      const rawCompanyId = manager.role === 'super_admin' ? req.body.companyId : manager.companyId;
      const companyId = rawCompanyId && rawCompanyId !== '' ? rawCompanyId : null;

      const parsed = insertUserSchema.safeParse({
        username: req.body.username,
        password: req.body.password,
        fullName: req.body.fullName,
        role: req.body.role || 'employee',
        department: req.body.department || null,
        avatar: req.body.avatar || null,
        companyId,
      });
      
      if (!parsed.success) {
        console.error("User parse error:", parsed.error);
        return res.status(400).json({ message: "Geçersiz kullanıcı bilgisi: " + parsed.error.issues.map(i => i.message).join(", ") });
      }
      
      const newUser = await storage.createUser(parsed.data);
      
      res.json({ 
        user: {
          id: newUser.id,
          username: newUser.username,
          fullName: newUser.fullName,
          role: newUser.role,
          department: newUser.department,
        }
      });
    } catch (error: any) {
      console.error("Create user error:", error);
      if (error?.code === '23505' || error?.message?.includes('unique')) {
        return res.status(400).json({ message: "Bu kullanıcı adı zaten kullanılıyor" });
      }
      res.status(500).json({ message: "Kullanıcı oluşturulamadı" });
    }
  });

  // Sales Records routes
  app.get("/api/sales-records", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const records = await storage.getUserSalesRecords(user.id);
      res.json({ records });
    } catch (error) {
      console.error("Get sales records error:", error);
      res.status(500).json({ message: "Satış kayıtları alınamadı" });
    }
  });

  app.post("/api/sales-records", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const activeShift = await storage.getActiveShift(user.id);
      
      const parsed = insertSalesRecordSchema.safeParse({
        userId: user.id,
        companyId: user.companyId,
        shiftId: activeShift?.id || null,
        type: req.body.type,
        quantity: req.body.quantity || 1,
        notes: req.body.notes || null,
        activityTypeId: req.body.activityTypeId || null,
      });
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Geçersiz satış kaydı bilgisi" });
      }
      
      const record = await storage.createSalesRecord(parsed.data);
      
      res.json({ record });
    } catch (error) {
      console.error("Create sales record error:", error);
      res.status(500).json({ message: "Satış kaydı oluşturulamadı" });
    }
  });

  // Shift routes
  app.post("/api/shifts/start", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { latitude, longitude } = req.body;
      
      // Check if there's already an active shift
      const activeShift = await storage.getActiveShift(userId);
      if (activeShift) {
        return res.status(400).json({ message: "Zaten aktif bir vardiya var" });
      }

      const shift = await storage.createShift({
        userId,
        startTime: new Date(),
        endTime: null,
        durationSeconds: null,
        startLatitude: latitude || null,
        startLongitude: longitude || null,
        endLatitude: null,
        endLongitude: null,
      });

      // Check if employee is starting late and send automatic warning
      try {
        const user = await storage.getUser(userId);
        if (user && user.companyId && user.role === 'employee') {
          const settings = await storage.getCompanySettings(user.companyId);
          if (settings) {
            const now = new Date();
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            const [startH, startM] = settings.shiftStartTime.split(":").map(Number);
            const shiftStartMinutes = startH * 60 + startM;
            const threshold = settings.lateThresholdMinutes;
            const minsLate = nowMinutes - shiftStartMinutes;

            if (minsLate >= threshold) {
              // Determine which warning level based on how late
              let warningText: string | null = null;
              if (minsLate >= threshold * 3 && settings.lateWarning3) {
                warningText = settings.lateWarning3;
              } else if (minsLate >= threshold * 2 && settings.lateWarning2) {
                warningText = settings.lateWarning2;
              } else if (settings.lateWarning1) {
                warningText = settings.lateWarning1;
              }

              if (warningText) {
                // Find a manager in the company to send as sender
                const companyUsers = await storage.getUsersByCompany(user.companyId);
                const manager = companyUsers.find(u => u.role === 'manager');
                if (manager) {
                  await storage.createMessage({
                    senderId: manager.id,
                    recipientId: userId,
                    companyId: user.companyId,
                    content: warningText,
                    fileUrl: null,
                    fileName: null,
                    fileSize: null,
                    fileType: null,
                  });
                  console.log(`[GeçKalmaUyarısı] ${user.username} mesaiyi ${minsLate} dakika geç başlattı → uyarı gönderildi`);
                }
              }
            }
          }
        }
      } catch (warnErr) {
        console.error("[GeçKalmaUyarısı] Uyarı gönderilemedi:", warnErr);
      }

      res.json({ shift });
    } catch (error) {
      console.error("Shift start error:", error);
      res.status(500).json({ message: "Vardiya başlatma hatası" });
    }
  });

  app.post("/api/shifts/end", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { latitude, longitude } = req.body;
      
      const activeShift = await storage.getActiveShift(userId);
      if (!activeShift) {
        return res.status(400).json({ message: "Aktif vardiya bulunamadı" });
      }

      const endTime = new Date();
      const durationSeconds = Math.floor((endTime.getTime() - new Date(activeShift.startTime).getTime()) / 1000);

      const shift = await storage.updateShift(activeShift.id, {
        endTime,
        durationSeconds,
        endLatitude: latitude || null,
        endLongitude: longitude || null,
      });

      res.json({ shift });
    } catch (error) {
      console.error("Shift end error:", error);
      res.status(500).json({ message: "Vardiya bitirme hatası" });
    }
  });

  app.get("/api/shifts/active", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shift = await storage.getActiveShift(userId);
      res.json({ shift: shift || null });
    } catch (error) {
      console.error("Get active shift error:", error);
      res.status(500).json({ message: "Vardiya bilgisi alınamadı" });
    }
  });

  app.get("/api/shifts", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shifts = await storage.getUserShifts(userId);
      res.json({ shifts });
    } catch (error) {
      console.error("Get shifts error:", error);
      res.status(500).json({ message: "Vardiyalar alınamadı" });
    }
  });

  // Activity routes
  app.post("/api/activities/start", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type, shiftId } = req.body;

      // Check if there's already an active activity
      const activeActivity = await storage.getActiveActivity(userId);
      if (activeActivity) {
        return res.status(400).json({ message: "Zaten aktif bir aktivite var" });
      }

      const activity = await storage.createActivity({
        userId,
        shiftId: shiftId || null,
        type,
        startTime: new Date(),
        endTime: null,
        durationMinutes: null,
        notes: null,
      });

      res.json({ activity });
    } catch (error) {
      console.error("Activity start error:", error);
      res.status(500).json({ message: "Aktivite başlatma hatası" });
    }
  });

  app.post("/api/activities/end", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { notes } = req.body;
      
      const activeActivity = await storage.getActiveActivity(userId);
      if (!activeActivity) {
        return res.status(400).json({ message: "Aktif aktivite bulunamadı" });
      }

      const endTime = new Date();
      const durationMinutes = Math.floor((endTime.getTime() - new Date(activeActivity.startTime).getTime()) / 60000);

      const activity = await storage.updateActivity(activeActivity.id, {
        endTime,
        durationMinutes,
        notes: notes || null,
      });

      res.json({ activity });
    } catch (error) {
      console.error("Activity end error:", error);
      res.status(500).json({ message: "Aktivite bitirme hatası" });
    }
  });

  app.get("/api/activities/active", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const activity = await storage.getActiveActivity(userId);
      res.json({ activity: activity || null });
    } catch (error) {
      console.error("Get active activity error:", error);
      res.status(500).json({ message: "Aktivite bilgisi alınamadı" });
    }
  });

  app.get("/api/activities", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const activities = await storage.getUserActivities(userId);
      res.json({ activities });
    } catch (error) {
      console.error("Get activities error:", error);
      res.status(500).json({ message: "Aktiviteler alınamadı" });
    }
  });

  // Serve uploaded files
  app.get("/uploads/:filename", requireAuth, (req: any, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "Dosya bulunamadı" });
    }
  });

  // File upload endpoint
  app.post("/api/upload", requireAuth, (req: any, res: any, next: any) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        console.error("Multer error:", err.message, err.code);
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "Dosya boyutu 10MB sınırını aşıyor" });
        }
        return res.status(400).json({ message: err.message || "Dosya yüklenemedi" });
      }
      next();
    });
  }, async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Dosya yüklenmedi" });
      }

      console.log("File uploaded:", req.file.originalname, req.file.mimetype, req.file.size);
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({
        fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Dosya yüklenemedi" });
    }
  });

  // Base64 file upload endpoint (for environments where multipart upload fails)
  app.post("/api/upload-base64", requireAuth, async (req: any, res: any) => {
    try {
      const { data, name, type } = req.body;
      if (!data || !name || !type) {
        return res.status(400).json({ message: "Eksik dosya verisi" });
      }

      const allowedTypes = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "image/heic", "image/heif",
        "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
      ];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ message: "Desteklenmeyen dosya türü" });
      }

      const base64Data = data.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ message: "Dosya boyutu 10MB'dan büyük olamaz" });
      }

      const ext = path.extname(name) || ".bin";
      const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
      const filePath = path.join(uploadDir, uniqueName);
      fs.writeFileSync(filePath, buffer);

      console.log("Base64 file uploaded:", name, type, buffer.length);
      res.json({
        fileUrl: `/uploads/${uniqueName}`,
        fileName: name,
        fileSize: buffer.length,
        fileType: type,
      });
    } catch (error) {
      console.error("Base64 upload error:", error);
      res.status(500).json({ message: "Dosya yüklenemedi" });
    }
  });

  // Message routes
  app.post("/api/messages", requireAuth, async (req: any, res) => {
    try {
      const senderId = req.user.id;
      const { recipientId, content, fileUrl, fileName, fileSize, fileType } = req.body;

      const message = await storage.createMessage({
        senderId,
        recipientId,
        content: content || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
        fileType: fileType || null,
      });

      res.json({ message });
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ message: "Mesaj gönderilemedi" });
    }
  });

  // Returns users the current user has chatted with, sorted by most recent message
  app.get("/api/conversations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const partnerIds = await storage.getRecentConversationPartnerIds(userId);
      const allUsers = await storage.getAllUsers();
      const sanitize = (u: any) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        department: u.department,
        avatar: u.avatar,
      });
      // Build: partners with messages first (sorted by recency), then the rest
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const partnerSet = new Set(partnerIds);
      const partners = partnerIds
        .map(id => userMap.get(id))
        .filter((u): u is NonNullable<typeof u> => !!u && u.id !== userId)
        .map(sanitize);
      const rest = allUsers
        .filter(u => !partnerSet.has(u.id) && u.id !== userId)
        .map(sanitize);
      res.json({ users: [...partners, ...rest] });
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ message: "Konuşmalar alınamadı" });
    }
  });

  app.get("/api/messages", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const messages = await storage.getUserMessages(userId);
      res.json({ messages });
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "Mesajlar alınamadı" });
    }
  });

  app.get("/api/messages/:userId", requireAuth, async (req: any, res) => {
    try {
      const currentUserId = req.user.id;
      const otherUserId = req.params.userId;
      const messages = await storage.getConversation(currentUserId, otherUserId);
      res.json({ messages });
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json({ message: "Konuşma alınamadı" });
    }
  });

  app.post("/api/messages/:id/read", requireAuth, async (req: any, res) => {
    try {
      const messageId = req.params.id;
      await storage.markMessageAsRead(messageId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark as read error:", error);
      res.status(500).json({ message: "Mesaj güncellenemedi" });
    }
  });

  // ─── Group routes ─────────────────────────────────────────────────────────

  // List groups the current user belongs to
  app.get("/api/groups", requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const userGroups = await storage.getGroupsByUser(userId);
      // Attach member counts
      const result = await Promise.all(userGroups.map(async g => {
        const members = await storage.getGroupMembers(g.id);
        return { ...g, memberCount: members.length };
      }));
      res.json({ groups: result });
    } catch (error) {
      console.error("Get groups error:", error);
      res.status(500).json({ message: "Gruplar alınamadı" });
    }
  });

  // Create a group (manager or super_admin)
  app.post("/api/groups", requireAuth, async (req: any, res: any) => {
    try {
      const user: User = req.user;
      if (user.role !== "manager" && user.role !== "super_admin") {
        return res.status(403).json({ message: "Sadece yöneticiler grup oluşturabilir" });
      }
      const { name, memberIds } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Grup adı gerekli" });

      const group = await storage.createGroup({
        name: name.trim(),
        companyId: user.companyId || null,
        createdBy: user.id,
      });

      // Add creator + selected members
      const allIds: string[] = Array.from(new Set([user.id, ...(memberIds || [])]));
      for (const uid of allIds) {
        await storage.addGroupMember(group.id, uid);
      }

      res.json({ group });
    } catch (error) {
      console.error("Create group error:", error);
      res.status(500).json({ message: "Grup oluşturulamadı" });
    }
  });

  // Get group members (with user details)
  app.get("/api/groups/:id/members", requireAuth, async (req: any, res: any) => {
    try {
      const groupId = req.params.id;
      const isMember = await storage.isGroupMember(groupId, req.user.id);
      if (!isMember) return res.status(403).json({ message: "Bu gruba erişim yetkiniz yok" });

      const members = await storage.getGroupMembers(groupId);
      const allUsers = await storage.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const result = members.map(m => {
        const u = userMap.get(m.userId);
        return { ...m, user: u ? { id: u.id, fullName: u.fullName, role: u.role, department: u.department } : null };
      });
      res.json({ members: result });
    } catch (error) {
      console.error("Get group members error:", error);
      res.status(500).json({ message: "Üyeler alınamadı" });
    }
  });

  // Add member to group
  app.post("/api/groups/:id/members", requireAuth, async (req: any, res: any) => {
    try {
      const user: User = req.user;
      const group = await storage.getGroup(req.params.id);
      if (!group) return res.status(404).json({ message: "Grup bulunamadı" });
      if (group.createdBy !== user.id && user.role !== "super_admin") {
        return res.status(403).json({ message: "Yetkiniz yok" });
      }
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "Kullanıcı ID gerekli" });
      const member = await storage.addGroupMember(group.id, userId);
      res.json({ member });
    } catch (error) {
      console.error("Add group member error:", error);
      res.status(500).json({ message: "Üye eklenemedi" });
    }
  });

  // Remove member from group
  app.delete("/api/groups/:id/members/:userId", requireAuth, async (req: any, res: any) => {
    try {
      const user: User = req.user;
      const group = await storage.getGroup(req.params.id);
      if (!group) return res.status(404).json({ message: "Grup bulunamadı" });
      if (group.createdBy !== user.id && user.role !== "super_admin" && req.params.userId !== user.id) {
        return res.status(403).json({ message: "Yetkiniz yok" });
      }
      await storage.removeGroupMember(group.id, req.params.userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove group member error:", error);
      res.status(500).json({ message: "Üye kaldırılamadı" });
    }
  });

  // Delete group
  app.delete("/api/groups/:id", requireAuth, async (req: any, res: any) => {
    try {
      const user: User = req.user;
      const group = await storage.getGroup(req.params.id);
      if (!group) return res.status(404).json({ message: "Grup bulunamadı" });
      if (group.createdBy !== user.id && user.role !== "super_admin") {
        return res.status(403).json({ message: "Yetkiniz yok" });
      }
      await storage.deleteGroup(group.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete group error:", error);
      res.status(500).json({ message: "Grup silinemedi" });
    }
  });

  // Get group messages
  app.get("/api/groups/:id/messages", requireAuth, async (req: any, res: any) => {
    try {
      const groupId = req.params.id;
      const isMember = await storage.isGroupMember(groupId, req.user.id);
      if (!isMember) return res.status(403).json({ message: "Bu gruba erişim yetkiniz yok" });
      const msgs = await storage.getGroupMessages(groupId);
      res.json({ messages: msgs });
    } catch (error) {
      console.error("Get group messages error:", error);
      res.status(500).json({ message: "Mesajlar alınamadı" });
    }
  });

  // Send group message
  app.post("/api/groups/:id/messages", requireAuth, async (req: any, res: any) => {
    try {
      const groupId = req.params.id;
      const senderId = req.user.id;
      const isMember = await storage.isGroupMember(groupId, senderId);
      if (!isMember) return res.status(403).json({ message: "Bu gruba erişim yetkiniz yok" });

      const { content, fileUrl, fileName, fileSize, fileType } = req.body;
      if (!content?.trim() && !fileUrl) return res.status(400).json({ message: "Mesaj içeriği gerekli" });

      const msg = await storage.createGroupMessage({
        groupId,
        senderId,
        content: content || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
        fileType: fileType || null,
      });
      res.json({ message: msg });
    } catch (error) {
      console.error("Send group message error:", error);
      res.status(500).json({ message: "Mesaj gönderilemedi" });
    }
  });

  // ─── User routes ───────────────────────────────────────────────────────────

  // User routes
  app.get("/api/users", requireAuth, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitizedUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        department: u.department,
        avatar: u.avatar,
      }));
      res.json({ users: sanitizedUsers });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Kullanıcılar alınamadı" });
    }
  });

  // Report routes (manager only)
  app.get("/api/reports/shifts", requireAuth, async (req: any, res) => {
    try {
      const { userId, dateFilter } = req.query;
      const user = req.user;
      const isManagerOrAdmin = user.role === 'manager' || user.role === 'super_admin';

      let shifts: any[];
      if (isManagerOrAdmin) {
        shifts = await storage.getAllShifts(user.companyId);
        if (userId && userId !== 'all') {
          shifts = shifts.filter((s: any) => s.userId === userId);
        }
      } else {
        shifts = await storage.getUserShifts(user.id);
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      if (dateFilter === 'today') {
        shifts = shifts.filter((s: any) => new Date(s.startTime) >= startOfDay);
      } else if (dateFilter === 'week') {
        shifts = shifts.filter((s: any) => new Date(s.startTime) >= startOfWeek);
      } else if (dateFilter === 'month') {
        shifts = shifts.filter((s: any) => new Date(s.startTime) >= startOfMonth);
      }

      const allUsers = isManagerOrAdmin
        ? await storage.getUsersByCompany(user.companyId)
        : [await storage.getUser(user.id)];
      const userMap: Record<string, any> = {};
      for (const u of allUsers) {
        if (u) userMap[u.id] = u;
      }

      const enriched = shifts.map((s: any) => ({
        ...s,
        userFullName: userMap[s.userId]?.fullName || "Bilinmeyen",
        userDepartment: userMap[s.userId]?.department || "-",
      }));

      res.json({ shifts: enriched, users: allUsers });
    } catch (error) {
      console.error("Get report shifts error:", error);
      res.status(500).json({ message: "Mesai verileri alınamadı" });
    }
  });

  app.get("/api/reports/activities", requireAuth, async (req: any, res) => {
    try {
      const { userId, dateFilter } = req.query;
      const user = req.user;
      
      if (user.role !== 'manager' && user.role !== 'super_admin') {
        return res.status(403).json({ message: "Yetkiniz yok" });
      }

      let activities = await storage.getAllActivities(user.companyId);
      
      if (userId && userId !== 'all') {
        activities = activities.filter(a => a.userId === userId);
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      if (dateFilter === 'today') {
        activities = activities.filter(a => new Date(a.startTime) >= startOfDay);
      } else if (dateFilter === 'week') {
        activities = activities.filter(a => new Date(a.startTime) >= startOfWeek);
      } else if (dateFilter === 'month') {
        activities = activities.filter(a => new Date(a.startTime) >= startOfMonth);
      }

      res.json({ activities });
    } catch (error) {
      console.error("Get report activities error:", error);
      res.status(500).json({ message: "Aktivite verileri alınamadı" });
    }
  });

  // Company Settings routes
  app.get("/api/company/settings", requireAuth, requireManager, async (req: any, res) => {
    try {
      const manager = req.user as User;
      const companyId = manager.companyId;
      if (!companyId) return res.json({ settings: null });
      const settings = await storage.getCompanySettings(companyId);
      res.json({ settings: settings || null });
    } catch (error) {
      console.error("Get company settings error:", error);
      res.status(500).json({ message: "Ayarlar alınamadı" });
    }
  });

  app.put("/api/company/settings", requireAuth, requireManager, async (req: any, res) => {
    try {
      const manager = req.user as User;
      const companyId = manager.role === 'super_admin' ? req.body.companyId : manager.companyId;
      if (!companyId) return res.status(400).json({ message: "Şirket bulunamadı" });

      const parsed = insertCompanySettingsSchema.safeParse({
        companyId,
        shiftStartTime: req.body.shiftStartTime,
        shiftEndTime: req.body.shiftEndTime,
        lateThresholdMinutes: parseInt(req.body.lateThresholdMinutes) || 15,
        lateWarning1: req.body.lateWarning1,
        lateWarning2: req.body.lateWarning2,
        lateWarning3: req.body.lateWarning3,
      });

      if (!parsed.success) {
        return res.status(400).json({ message: "Geçersiz ayar bilgisi" });
      }

      const settings = await storage.upsertCompanySettings(parsed.data);
      res.json({ settings });
    } catch (error) {
      console.error("Save company settings error:", error);
      res.status(500).json({ message: "Ayarlar kaydedilemedi" });
    }
  });

  // Manual test warning endpoint — sends W1 immediately to all employees without a shift today
  app.post("/api/company/test-warning", requireAuth, requireManager, async (req: any, res) => {
    try {
      const manager = req.user as User;
      const companyId = manager.companyId;
      if (!companyId) return res.status(400).json({ message: "Şirket bulunamadı" });

      const settings = await storage.getCompanySettings(companyId);
      if (!settings || !settings.lateWarning1) {
        return res.status(400).json({ message: "Önce uyarı ayarlarını kaydedin" });
      }

      const employees = await storage.getUsersByCompany(companyId);
      const managerUser = employees.find(u => u.role === 'manager');
      if (!managerUser) return res.status(400).json({ message: "Yönetici bulunamadı" });

      let sent = 0;
      for (const emp of employees) {
        if (emp.role !== 'employee') continue;
        const todayShift = await storage.getUserTodayShift(emp.id);
        if (todayShift) continue; // already started today

        await storage.createMessage({
          senderId: managerUser.id,
          recipientId: emp.id,
          companyId,
          content: `[TEST] ${settings.lateWarning1}`,
          fileUrl: null,
          fileName: null,
          fileSize: null,
          fileType: null,
        });
        sent++;
        console.log(`[TestUyarı] ${emp.username} kullanıcısına test uyarısı gönderildi`);
      }

      res.json({ message: `${sent} çalışana test uyarısı gönderildi`, sent });
    } catch (error) {
      console.error("Test warning error:", error);
      res.status(500).json({ message: "Test uyarısı gönderilemedi" });
    }
  });

  // Late warning background job — runs every minute
  const sentWarnings = new Set<string>(); // track sent warnings: `userId-date-warningLevel`

  const runLateWarningCheck = async () => {
    try {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      console.log(`[LateWarning] Kontrol çalışıyor - Saat: ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} (${nowMinutes} dk)`);

      const allCompanies = await storage.getAllCompanies();

      for (const company of allCompanies) {
        if (!company.id) continue;
        const settings = await storage.getCompanySettings(company.id);
        if (!settings) {
          console.log(`[LateWarning] ${company.name} için ayar bulunamadı, atlanıyor.`);
          continue;
        }

        const [startH, startM] = settings.shiftStartTime.split(":").map(Number);
        const shiftStartMinutes = startH * 60 + startM;
        const threshold = settings.lateThresholdMinutes;

        const warning1Trigger = shiftStartMinutes + threshold;
        const warning2Trigger = shiftStartMinutes + threshold * 2;
        const warning3Trigger = shiftStartMinutes + threshold * 3;

        console.log(`[LateWarning] ${company.name}: Mesai başlangıç=${settings.shiftStartTime} (${shiftStartMinutes}dk), Eşik=${threshold}dk, Şu an=${nowMinutes}dk`);

        if (nowMinutes < warning1Trigger) {
          console.log(`[LateWarning] ${company.name}: Henüz uyarı zamanı değil (ilk uyarı ${warning1Trigger}dk'da), atlanıyor.`);
          continue;
        }

        const employees = await storage.getUsersByCompany(company.id);
        const managers = employees.filter(u => u.role === 'manager');
        if (managers.length === 0) {
          console.log(`[LateWarning] ${company.name}: Yönetici bulunamadı, uyarı gönderilemedi.`);
          continue;
        }
        const sender = managers[0];

        for (const emp of employees) {
          if (emp.role !== 'employee') continue;

          // Use getUserTodayShift - catches both active AND completed shifts today
          const todayShift = await storage.getUserTodayShift(emp.id);
          if (todayShift) {
            console.log(`[LateWarning] ${emp.username} bugün mesai başlatmış, uyarı gönderilmiyor.`);
            continue;
          }

          const warnings = [
            { level: 1, trigger: warning1Trigger, text: settings.lateWarning1 },
            { level: 2, trigger: warning2Trigger, text: settings.lateWarning2 },
            { level: 3, trigger: warning3Trigger, text: settings.lateWarning3 },
          ];

          for (const w of warnings) {
            if (!w.text) continue;
            const key = `${emp.id}-${todayKey}-w${w.level}`;
            if (nowMinutes >= w.trigger && !sentWarnings.has(key)) {
              sentWarnings.add(key);
              await storage.createMessage({
                senderId: sender.id,
                recipientId: emp.id,
                companyId: company.id,
                content: w.text,
                fileUrl: null,
                fileName: null,
                fileSize: null,
                fileType: null,
              });
              console.log(`[LateWarning] ✓ Uyarı ${w.level} gönderildi -> ${emp.username} (${company.name}) - Gönderen: ${sender.username}`);
            }
          }
        }
      }
    } catch (err) {
      console.error("[LateWarning] Hata:", err);
    }
  };

  // Run immediately on startup, then every 60 seconds
  runLateWarningCheck();
  setInterval(runLateWarningCheck, 60 * 1000);

  // PDF Documentation download
  app.get("/api/docs/kullanim-kilavuzu", (req, res) => {
    const filePath = path.join(process.cwd(), "docs", "Kullanim_Kilavuzu.pdf");
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Kullanim_Kilavuzu.pdf"');
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "Belge bulunamadı" });
    }
  });

  return httpServer;
}
