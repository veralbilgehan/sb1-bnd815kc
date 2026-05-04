import { useState } from "react";
import { requestPasswordReset, API_BASE } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { type User } from "@/lib/auth";

interface Props {
  user: User;
}

export default function ResetUserPassword({ user }: Props) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const origin = (import.meta.env.VITE_FRONTEND_URL as string | undefined) ?? window.location.origin;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResetLink(null);
    setCopied(false);
    setLoading(true);
    try {
      const { token } = await requestPasswordReset(username);
      setResetLink(`${origin}/reset-password?token=${token}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!resetLink) return;
    navigator.clipboard.writeText(resetLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="max-w-lg mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı Şifresi Sıfırla</CardTitle>
          <CardDescription>
            Çalışanın kullanıcı adını girin. Oluşan bağlantıyı çalışanla paylaşın; bağlantı 1 saat geçerlidir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded bg-red-100 text-red-800 text-sm">{error}</div>
            )}
            <div>
              <Label htmlFor="username">Kullanıcı Adı</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="calisan1"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Oluşturuluyor..." : "Sıfırlama Bağlantısı Oluştur"}
            </Button>
          </form>

          {resetLink && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm font-medium text-green-700">Bağlantı oluşturuldu (1 saat geçerli):</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={resetLink}
                  className="text-xs font-mono"
                  onFocus={(e) => e.target.select()}
                />
                <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                  {copied ? "Kopyalandı!" : "Kopyala"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Bu bağlantıyı çalışanla paylaşın. Her seferinde yeni bağlantı oluşturulur.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
