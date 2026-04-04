import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { login } from "@/lib/auth";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      toast({
        title: "Hata",
        description: "Lütfen kullanıcı adı ve şifre giriniz.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      await login(formData.username, formData.password);
      toast({
        title: "Başarılı",
        description: "Giriş yapıldı, yönlendiriliyorsunuz...",
        className: "bg-green-500 text-white border-none",
      });
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Kullanıcı adı veya şifre hatalı",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-white">
      <Card className="w-full max-w-[450px] shadow-2xl border-none animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl sm:text-2xl font-bold text-black mb-2">Şirket İçi Portal</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-black">Performans ve İletişim Sistemi</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="employee" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="employee" data-testid="tab-employee">Personel Girişi</TabsTrigger>
              <TabsTrigger value="manager" data-testid="tab-manager">Yönetici Girişi</TabsTrigger>
            </TabsList>
            
            <TabsContent value="employee">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Kullanıcı Adı</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="username"
                      data-testid="input-username"
                      placeholder="Kullanıcı adınız" 
                      className="pl-9"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Şifre</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="password"
                      data-testid="input-password"
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      className="pl-9 pr-9"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                    />
                    <button 
                      type="button"
                      data-testid="button-toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
                  {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="manager">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="m-username">Yönetici Kodu</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="m-username"
                      data-testid="input-manager-username"
                      placeholder="Yönetici kodunuz" 
                      className="pl-9"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="m-password">Şifre</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="m-password"
                      data-testid="input-manager-password"
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      className="pl-9 pr-9"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                    />
                    <button 
                      type="button"
                      data-testid="button-toggle-manager-password"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-manager-login">
                  {loading ? "Giriş Yapılıyor..." : "Yönetici Girişi"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Şifrenizi mi unuttunuz? Bilgi İşlem ile iletişime geçin.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
