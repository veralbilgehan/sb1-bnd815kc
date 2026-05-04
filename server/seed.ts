import { storage } from "./storage";
import type { InsertAnnouncement } from "../shared/schema";

async function seed() {
  console.log("Starting database seed...");

  try {
    // Create Super Admin
    const existingSuperAdmin = await storage.getUserByUsername("superadmin");
    if (!existingSuperAdmin) {
      await storage.createUser({
        username: "superadmin",
        password: "123456",
        fullName: "Sistem Yöneticisi",
        role: "super_admin",
        department: "Sistem",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=superadmin",
        companyId: null,
      });
      console.log("✓ Super Admin created: superadmin");
    }

    // Create Company 1
    let company1Id: string | null = null;
    const companies = await storage.getAllCompanies();
    const existingCompany1 = companies.find(c => c.name === "ABC Otomotiv");
    
    if (!existingCompany1) {
      const company1 = await storage.createCompany({
        name: "ABC Otomotiv",
        address: "İstanbul, Türkiye",
        phone: "+90 212 555 0001",
        email: "info@abcotomotiv.com",
      });
      company1Id = company1.id;
      console.log("✓ Company created: ABC Otomotiv");
    } else {
      company1Id = existingCompany1.id;
    }

    // Create Company 2
    let company2Id: string | null = null;
    const existingCompany2 = companies.find(c => c.name === "XYZ Araç");
    
    if (!existingCompany2) {
      const company2 = await storage.createCompany({
        name: "XYZ Araç",
        address: "Ankara, Türkiye",
        phone: "+90 312 555 0002",
        email: "info@xyzarac.com",
      });
      company2Id = company2.id;
      console.log("✓ Company created: XYZ Araç");
    } else {
      company2Id = existingCompany2.id;
    }

    // Create Manager for Company 1
    const existingManager1 = await storage.getUserByUsername("yonetici1");
    if (!existingManager1 && company1Id) {
      await storage.createUser({
        username: "yonetici1",
        password: "123456",
        fullName: "Ayşe Demir",
        role: "manager",
        department: "Yönetim",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ayse",
        companyId: company1Id,
      });
      console.log("✓ Manager created for ABC Otomotiv: yonetici1");
    }

    // Create Employees for Company 1
    const existingEmployee1 = await storage.getUserByUsername("calisan1");
    if (!existingEmployee1 && company1Id) {
      await storage.createUser({
        username: "calisan1",
        password: "123456",
        fullName: "Ahmet Yılmaz",
        role: "employee",
        department: "Satış",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ahmet",
        companyId: company1Id,
      });
      console.log("✓ Employee created for ABC Otomotiv: calisan1");
    }

    const existingEmployee2 = await storage.getUserByUsername("calisan2");
    if (!existingEmployee2 && company1Id) {
      await storage.createUser({
        username: "calisan2",
        password: "123456",
        fullName: "Mehmet Kaya",
        role: "employee",
        department: "Servis",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mehmet",
        companyId: company1Id,
      });
      console.log("✓ Employee created for ABC Otomotiv: calisan2");
    }

    // Create Manager for Company 2
    const existingManager2 = await storage.getUserByUsername("yonetici2");
    if (!existingManager2 && company2Id) {
      await storage.createUser({
        username: "yonetici2",
        password: "123456",
        fullName: "Ali Veli",
        role: "manager",
        department: "Yönetim",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ali",
        companyId: company2Id,
      });
      console.log("✓ Manager created for XYZ Araç: yonetici2");
    }

    // Create Employee for Company 2
    const existingEmployee3 = await storage.getUserByUsername("calisan3");
    if (!existingEmployee3 && company2Id) {
      await storage.createUser({
        username: "calisan3",
        password: "123456",
        fullName: "Fatma Öz",
        role: "employee",
        department: "Satış",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=fatma",
        companyId: company2Id,
      });
      console.log("✓ Employee created for XYZ Araç: calisan3");
    }

    // Create Default Activity Types
    const defaultActivityTypes = [
      { name: "Mesai Saati", category: "activity", points: 1 },
      { name: "Müşteri Görüşmesi", category: "activity", points: 10 },
      { name: "Telefon Görüşmesi", category: "activity", points: 5 },
      { name: "Araç Teslimi", category: "activity", points: 15 },
      { name: "Araç Satış", category: "sales", points: 50 },
      { name: "Aksesuar Satış", category: "sales", points: 10 },
      { name: "Bakım Paketi", category: "sales", points: 20 },
      { name: "Hibrit Satış", category: "sales", points: 30 },
      { name: "Sigorta Satışı", category: "sales", points: 25 },
      { name: "Diğer", category: "other", points: 3 },
    ];

    const existingActivityTypes = await storage.getDefaultActivityTypes();
    
    for (const actType of defaultActivityTypes) {
      const exists = existingActivityTypes.find(at => at.name === actType.name && at.isDefault);
      if (!exists) {
        await storage.createActivityType({
          name: actType.name,
          category: actType.category,
          points: actType.points,
          isDefault: true,
          companyId: null,
        });
        console.log(`✓ Activity type created: ${actType.name} (${actType.points} puan)`);
      }
    }

    console.log("\n=== Giriş Bilgileri ===");
    console.log("Süper Admin: superadmin / 123456");
    console.log("ABC Otomotiv Yönetici: yonetici1 / 123456");
    console.log("ABC Otomotiv Çalışan: calisan1, calisan2 / 123456");
    console.log("XYZ Araç Yönetici: yonetici2 / 123456");
    console.log("XYZ Araç Çalışan: calisan3 / 123456");

    // Create default Günaydın announcements for each company
    const companySeedData = [
      { id: company1Id, manager: "yonetici1" },
      { id: company2Id, manager: "yonetici2" },
    ];
    for (const { id: cid, manager: mgrUsername } of companySeedData) {
      if (!cid) continue;
      const existingAnns = await storage.getAnnouncements(cid);
      if (existingAnns.length === 0) {
        const mgr = await storage.getUserByUsername(mgrUsername);
        const ann: InsertAnnouncement = {
          companyId: cid,
          title: "Günaydın! 🌅",
          content: "Günaydın sevgili ekip! Güzel bir gün dileriz. Hepinize başarılar! 💪",
          scheduledTime: "08:00",
          repeatType: "daily",
          repeatCount: 0,
          isActive: true,
          imageUrl: null,
          createdBy: mgr?.id ?? null,
        };
        await storage.createAnnouncement(ann);
        console.log(`✓ Default günaydın announcement created for company ${cid}`);
      }
    }
    console.log("\nDatabase seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
