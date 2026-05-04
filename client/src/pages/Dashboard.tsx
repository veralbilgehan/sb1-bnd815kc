import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Activity, MessageSquare, Settings, Users, Building2, Menu, BarChart2, KeyRound, RefreshCw } from "lucide-react";
import PerformanceView from "@/components/PerformanceView";
import ChatInterface from "@/components/ChatInterface";
import UserManagement from "@/components/UserManagement";
import CompanyManagement from "@/components/CompanyManagement";
import ActivitySettings from "@/components/ActivitySettings";
import Reports from "@/components/Reports";
import ChangePassword from "@/components/ChangePassword";
import ResetUserPassword from "@/components/ResetUserPassword";
import { getCurrentUser, getCurrentCompany, logout, type User, type Company } from "@/lib/auth";

type TabType = "performance" | "chat" | "users" | "settings" | "companies" | "reports" | "password" | "resetPassword";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    const currentCompany = getCurrentCompany();
    if (!currentUser) {
      setLocation("/");
      return;
    }
    setUser(currentUser);
    setCompany(currentCompany);
  }, [setLocation]);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Süper Admin';
      case 'manager': return 'Yönetici';
      case 'employee': return 'Çalışan';
      default: return role;
    }
  };

  const isSuperAdmin = user.role === 'super_admin';
  const isManager = user.role === 'manager' || isSuperAdmin;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl overflow-hidden min-h-[85vh] flex flex-col">
        {/* Header */}
        <header className="bg-primary text-primary-foreground px-3 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
          {/* Sol: Şirket adı + Kullanıcı yan yana */}
          <div className="flex items-center gap-3 md:gap-5 min-w-0">
            {/* Şirket adı */}
            <div className="min-w-0">
              <h1 className="text-sm md:text-xl font-bold leading-tight truncate" data-testid="text-company-name">
                {company?.name || (isSuperAdmin ? "Sistem Yönetimi" : "Şirket Portalı")}
              </h1>
            </div>
            {/* Ayırıcı */}
            <div className="w-px h-8 bg-white/30 shrink-0 hidden sm:block" />
            {/* Kullanıcı bilgisi */}
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-7 w-7 md:h-9 md:w-9 border-2 border-white/30 shrink-0">
                {user.avatar ? <AvatarImage src={user.avatar} alt={user.fullName} /> : null}
                <AvatarFallback className="bg-white text-primary font-bold text-xs">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-xs md:text-sm leading-tight truncate" data-testid="text-fullname">{user.fullName}</p>
                <p className="text-[10px] md:text-xs opacity-75 truncate" data-testid="text-department">
                  {user.department ? `${user.department} · ` : ""}{getRoleLabel(user.role)}
                </p>
              </div>
            </div>
          </div>

          {/* Sağ üst: Logo */}
          <img
            src="/bigchat-logo.jpg"
            alt="BIGChat Logo"
            className="h-8 md:h-10 w-auto rounded object-contain bg-white px-1"
          />
        </header>

        {/* Navigation - Hamburger Menu */}
        <nav className="flex border-b bg-white sticky top-0 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="hamburger-menu"
                className="flex items-center px-6 py-4 font-medium transition-colors hover:bg-slate-50"
              >
                <Menu className="h-5 w-5 mr-2" />
                Menü
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-white shadow-lg border border-gray-200">
              <DropdownMenuItem 
                onClick={() => setActiveTab("performance")}
                data-testid="menu-performance"
                className={activeTab === "performance" ? "bg-blue-50 text-primary" : ""}
              >
                <Activity className="h-4 w-4 mr-2" /> Mesaim
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setActiveTab("chat")}
                data-testid="menu-chat"
                className={activeTab === "chat" ? "bg-blue-50 text-primary" : ""}
              >
                <MessageSquare className="h-4 w-4 mr-2" /> Sohbet
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab("reports")}
                data-testid="menu-reports"
                className={activeTab === "reports" ? "bg-blue-50 text-primary" : ""}
              >
                <BarChart2 className="h-4 w-4 mr-2" /> Raporlar
              </DropdownMenuItem>

              {/* Manager/Admin Options */}
              {isManager && (
                <>
                  <DropdownMenuItem 
                    onClick={() => setActiveTab("users")}
                    data-testid="menu-users"
                    className={activeTab === "users" ? "bg-blue-50 text-primary" : ""}
                  >
                    <Users className="h-4 w-4 mr-2" /> Kullanıcılar
                  </DropdownMenuItem>
                  {isSuperAdmin && (
                    <DropdownMenuItem 
                      onClick={() => setActiveTab("companies")}
                      data-testid="menu-companies"
                      className={activeTab === "companies" ? "bg-blue-50 text-primary" : ""}
                    >
                      <Building2 className="h-4 w-4 mr-2" /> Şirketler
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={() => setActiveTab("settings")}
                    data-testid="menu-settings"
                    className={activeTab === "settings" ? "bg-blue-50 text-primary" : ""}
                  >
                    <Settings className="h-4 w-4 mr-2" /> Ayarlar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveTab("resetPassword")}
                    className={activeTab === "resetPassword" ? "bg-blue-50 text-primary" : ""}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" /> Şifre Sıfırla
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                onClick={() => setActiveTab("password")}
                className={activeTab === "password" ? "bg-blue-50 text-primary" : ""}
              >
                <KeyRound className="h-4 w-4 mr-2" /> Şifre Değiştir
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                data-testid="button-logout"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 focus:text-red-700 focus:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Current page indicator */}
          <div className="flex items-center px-4 py-4 text-sm text-muted-foreground border-l">
            {activeTab === "performance" && <><Activity className="h-4 w-4 mr-2 text-primary" /> Mesaim</>}
            {activeTab === "chat" && <><MessageSquare className="h-4 w-4 mr-2 text-primary" /> Sohbet</>}
            {activeTab === "reports" && <><BarChart2 className="h-4 w-4 mr-2 text-primary" /> Raporlar</>}
            {activeTab === "users" && <><Users className="h-4 w-4 mr-2 text-primary" /> Kullanıcılar</>}
            {activeTab === "companies" && <><Building2 className="h-4 w-4 mr-2 text-primary" /> Şirketler</>}
            {activeTab === "settings" && <><Settings className="h-4 w-4 mr-2 text-primary" /> Ayarlar</>}
            {activeTab === "password" && <><KeyRound className="h-4 w-4 mr-2 text-primary" /> Şifre Değiştir</>}
            {activeTab === "resetPassword" && <><RefreshCw className="h-4 w-4 mr-2 text-primary" /> Şifre Sıfırla</>}
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 p-6 bg-slate-50/30 overflow-y-auto">
          {activeTab === "performance" && <PerformanceView user={user} />}
          {activeTab === "chat" && <ChatInterface user={user} />}
          {activeTab === "reports" && <Reports user={user} />}
          {activeTab === "users" && isManager && <UserManagement user={user} />}
          {activeTab === "companies" && isSuperAdmin && <CompanyManagement user={user} />}
          {activeTab === "settings" && isManager && <ActivitySettings user={user} />}
          {activeTab === "password" && <ChangePassword />}
          {activeTab === "resetPassword" && isManager && <ResetUserPassword user={user} />}
        </main>
      </div>
    </div>
  );
}
