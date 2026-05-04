import { useState } from "react";
import { changePassword } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Yeni şifreler eşleşmiyor");
      return;
    }
    setLoading(true);
    try {
      await changePassword(current, next);
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Şifre Değiştir</CardTitle>
        </CardHeader>
        <CardContent>
          {success && (
            <div className="mb-4 p-3 rounded bg-green-100 text-green-800 text-sm">
              Şifreniz başarıyla güncellendi.
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 rounded bg-red-100 text-red-800 text-sm">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="current">Mevcut Şifre</Label>
              <Input
                id="current"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div>
              <Label htmlFor="next">Yeni Şifre</Label>
              <Input
                id="next"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="En az 10 karakter, harf ve rakam"
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
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
