import { useState } from "react";
import { useLocation } from "wouter";
import { resetPasswordWithToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyRound } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();

  // Read token from URL query string
  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl = params.get("token") ?? "";

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithToken(token, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-primary rounded-full p-4">
            <KeyRound className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Şifre Sıfırla</CardTitle>
            <CardDescription>Yöneticinizden aldığınız bağlantı ile yeni şifrenizi belirleyin.</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="p-4 rounded bg-green-100 text-green-800 text-sm text-center">
                  Şifreniz başarıyla güncellendi. Şimdi giriş yapabilirsiniz.
                </div>
                <Button className="w-full" onClick={() => setLocation("/")}>
                  Giriş Sayfasına Git
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded bg-red-100 text-red-800 text-sm">{error}</div>
                )}
                {!tokenFromUrl && (
                  <div>
                    <Label htmlFor="token">Sıfırlama Kodu</Label>
                    <Input
                      id="token"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Yöneticinizden aldığınız kodu girin"
                      required
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="newPassword">Yeni Şifre</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="En az 10 karakter, harf ve rakam"
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm">Yeni Şifre (Tekrar)</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
