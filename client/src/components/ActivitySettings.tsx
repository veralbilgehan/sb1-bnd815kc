import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Clock, Bell, Save, Loader2, Send, Info, Megaphone, Plus, Pencil, Trash2, ImageIcon, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type User, API_BASE } from "@/lib/auth";

interface CompanySettings {
  id: string;
  companyId: string;
  shiftStartTime: string;
  shiftEndTime: string;
  lateThresholdMinutes: number;
  lateWarning1: string;
  lateWarning2: string;
  lateWarning3: string;
}

interface Announcement {
  id: string;
  companyId: string;
  title: string;
  content: string;
  imageUrl: string | null;
  scheduledTime: string;
  repeatType: string;
  repeatCount: number;
  isActive: boolean;
  sentCount: number;
  lastSentAt: string | null;
  createdAt: string;
}

interface ActivitySettingsProps {
  user: User;
}

export default function ActivitySettings({ user }: ActivitySettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ─── Announcement form state ───────────────────────────────────────────────
  const defaultAnnForm = {
    title: "",
    content: "",
    scheduledTime: "08:00",
    repeatType: "daily",
    repeatCount: 0,
    isActive: true,
    imageUrl: "",
  };
  const [annForm, setAnnForm] = useState(defaultAnnForm);
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [annImageFile, setAnnImageFile] = useState<File | null>(null);
  const [annImagePreview, setAnnImagePreview] = useState<string | null>(null);
  const [showAnnForm, setShowAnnForm] = useState(false);

  const [form, setForm] = useState({
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    lateThresholdMinutes: 15,
    lateWarning1: "Mesai saatinde işyerinde olmadığınızdan kanuna ilişkin mazeretinizi bildiriniz.",
    lateWarning2: "Mesai başlangıç saatini geçmenize rağmen mesainizi başlatmadınız. Lütfen durumu yöneticinize bildirin.",
    lateWarning3: "Devamsızlık tutanağı düzenlenecektir. En kısa sürede işyerinizde bulununuz.",
  });

  const { data, isLoading } = useQuery<{ settings: CompanySettings | null }>({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/company/settings`, { credentials: "include" });
      if (!response.ok) throw new Error("Ayarlar yüklenemedi");
      return response.json();
    },
  });

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/announcements`, { credentials: "include" });
      if (!res.ok) throw new Error("Duyurular yüklenemedi");
      return res.json();
    },
  });

  const createAnnMutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const res = await fetch(`${API_BASE}/api/announcements`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Hata"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["announcements"] }); setShowAnnForm(false); setAnnForm(defaultAnnForm); setAnnImageFile(null); setAnnImagePreview(null); toast({ title: "Duyuru oluşturuldu" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const updateAnnMutation = useMutation({
    mutationFn: async ({ id, fd }: { id: string; fd: FormData }) => {
      const res = await fetch(`${API_BASE}/api/announcements/${id}`, { method: "PUT", body: fd, credentials: "include" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Hata"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["announcements"] }); setShowAnnForm(false); setEditingAnnId(null); setAnnForm(defaultAnnForm); setAnnImageFile(null); setAnnImagePreview(null); toast({ title: "Duyuru güncellendi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteAnnMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/api/announcements/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Silinemedi");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["announcements"] }); toast({ title: "Duyuru silindi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const sendAnnMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/api/announcements/${id}/send`, { method: "POST", credentials: "include" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Hata"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["announcements"] }); toast({ title: "Duyuru gönderildi", description: "Tüm çalışanlara mesaj olarak iletildi." }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      setForm({
        shiftStartTime: s.shiftStartTime,
        shiftEndTime: s.shiftEndTime,
        lateThresholdMinutes: s.lateThresholdMinutes,
        lateWarning1: s.lateWarning1,
        lateWarning2: s.lateWarning2,
        lateWarning3: s.lateWarning3,
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      const response = await fetch(`${API_BASE}/api/company/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Ayarlar kaydedilemedi");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast({ title: "Kaydedildi", description: "Mesai ayarları başarıyla güncellendi." });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const testWarningMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/api/company/test-warning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Test uyarısı gönderilemedi");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Test Gönderildi", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!form.shiftStartTime || !form.shiftEndTime) {
      toast({ title: "Hata", description: "Mesai saatlerini doldurun", variant: "destructive" });
      return;
    }
    if (!form.lateWarning1 || !form.lateWarning2 || !form.lateWarning3) {
      toast({ title: "Hata", description: "Tüm uyarı metinlerini doldurun", variant: "destructive" });
      return;
    }
    saveMutation.mutate(form);
  };

  // Calculate next automatic warning time
  const getNextWarningInfo = () => {
    if (!form.shiftStartTime || !form.lateThresholdMinutes) return null;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const [h, m] = form.shiftStartTime.split(":").map(Number);
    const startMinutes = h * 60 + m;
    const threshold = Number(form.lateThresholdMinutes);
    const w1 = startMinutes + threshold;
    const w2 = startMinutes + threshold * 2;
    const w3 = startMinutes + threshold * 3;
    const toTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}`;
    if (nowMinutes < w1) return { status: "bekliyor", next: toTime(w1), color: "text-blue-600" };
    if (nowMinutes < w2) return { status: "1. uyarı gönderildi", next: toTime(w2), color: "text-yellow-600" };
    if (nowMinutes < w3) return { status: "2. uyarı gönderildi", next: toTime(w3), color: "text-orange-600" };
    return { status: "3. uyarı gönderildi", next: null, color: "text-red-600" };
  };

  const warningInfo = getNextWarningInfo();

  function handleAnnImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnnImageFile(file);
    setAnnImagePreview(URL.createObjectURL(file));
  }

  function startEditAnn(ann: Announcement) {
    setEditingAnnId(ann.id);
    setAnnForm({ title: ann.title, content: ann.content, scheduledTime: ann.scheduledTime, repeatType: ann.repeatType, repeatCount: ann.repeatCount, isActive: ann.isActive, imageUrl: ann.imageUrl ?? "" });
    setAnnImageFile(null);
    setAnnImagePreview(ann.imageUrl ?? null);
    setShowAnnForm(true);
  }

  function buildAnnFormData() {
    const fd = new FormData();
    const data = { title: annForm.title, content: annForm.content, scheduledTime: annForm.scheduledTime, repeatType: annForm.repeatType, repeatCount: Number(annForm.repeatCount), isActive: annForm.isActive, imageUrl: annForm.imageUrl || null };
    if (annImageFile) {
      fd.append("image", annImageFile);
      fd.append("data", JSON.stringify({ ...data, imageUrl: undefined }));
    } else {
      Object.entries(data).forEach(([k, v]) => fd.append(k, String(v ?? "")));
    }
    return fd;
  }

  function handleAnnSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!annForm.title.trim() || !annForm.content.trim()) { toast({ title: "Hata", description: "Başlık ve içerik zorunlu", variant: "destructive" }); return; }
    const fd = buildAnnFormData();
    if (editingAnnId) { updateAnnMutation.mutate({ id: editingAnnId, fd }); }
    else { createAnnMutation.mutate(fd); }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Mesai Ayarları
        </h2>
        <p className="text-muted-foreground mt-1">
          Şirketinizin mesai saatlerini ve geç kalma uyarılarını yapılandırın.
        </p>
      </div>

      {/* Shift Times */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Mesai Saatleri
          </CardTitle>
          <CardDescription>Çalışanların mesai başlangıç ve bitiş saatlerini belirleyin.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="shiftStart">Mesai Başlangıcı</Label>
            <Input
              id="shiftStart"
              type="time"
              data-testid="input-shift-start"
              value={form.shiftStartTime}
              onChange={(e) => setForm({ ...form, shiftStartTime: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shiftEnd">Mesai Bitişi</Label>
            <Input
              id="shiftEnd"
              type="time"
              data-testid="input-shift-end"
              value={form.shiftEndTime}
              onChange={(e) => setForm({ ...form, shiftEndTime: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Late Warning Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Geç Kalma Uyarısı
          </CardTitle>
          <CardDescription>
            Mesai başlangıcından kaç dakika sonra uyarı gönderilsin? Her uyarı bu süre aralığıyla tekrar gönderilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="threshold">Uyarı Aralığı (dakika)</Label>
          <Input
            id="threshold"
            type="number"
            min={1}
            max={120}
            data-testid="input-late-threshold"
            value={form.lateThresholdMinutes}
            onChange={(e) => setForm({ ...form, lateThresholdMinutes: parseInt(e.target.value) || 15 })}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground pt-1">
            Örn: 15 dakika ayarlandıysa — 1. uyarı mesai başlangıcı + 15 dk, 2. uyarı + 30 dk, 3. uyarı + 45 dk sonra gönderilir.
          </p>
        </CardContent>
      </Card>

      {/* Warning Messages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            Otomatik Uyarı Mesajları
          </CardTitle>
          <CardDescription>
            Mesaiye geç kalan çalışanlara otomatik olarak gönderilecek 3 uyarı metnini belirleyin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="warning1" className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">1</span>
              1. Uyarı Metni
            </Label>
            <Textarea
              id="warning1"
              data-testid="textarea-warning1"
              value={form.lateWarning1}
              onChange={(e) => setForm({ ...form, lateWarning1: e.target.value })}
              rows={2}
              placeholder="1. uyarı mesajını girin..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="warning2" className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">2</span>
              2. Uyarı Metni
            </Label>
            <Textarea
              id="warning2"
              data-testid="textarea-warning2"
              value={form.lateWarning2}
              onChange={(e) => setForm({ ...form, lateWarning2: e.target.value })}
              rows={2}
              placeholder="2. uyarı mesajını girin..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="warning3" className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">3</span>
              3. Uyarı Metni
            </Label>
            <Textarea
              id="warning3"
              data-testid="textarea-warning3"
              value={form.lateWarning3}
              onChange={(e) => setForm({ ...form, lateWarning3: e.target.value })}
              rows={2}
              placeholder="3. uyarı mesajını girin..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Status info card */}
      {warningInfo && (
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-blue-800">Otomatik Uyarı Durumu</p>
                <p className="text-blue-700">
                  Şu an: <span className="font-mono font-bold">{new Date().getHours().toString().padStart(2,'0')}:{new Date().getMinutes().toString().padStart(2,'0')}</span>
                  {" · "}
                  Mesai başlangıç: <span className="font-mono font-bold">{form.shiftStartTime}</span>
                  {" · "}
                  Eşik: <span className="font-bold">{form.lateThresholdMinutes} dk</span>
                </p>
                <p className={`font-medium ${warningInfo.color}`}>
                  Durum: {warningInfo.status}
                  {warningInfo.next && <> · Sonraki uyarı saat <span className="font-mono">{warningInfo.next}</span>'de</>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full sm:w-auto gap-2"
          data-testid="button-save-settings"
        >
          {saveMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Kaydediliyor...</>
          ) : (
            <><Save className="h-4 w-4" />Ayarları Kaydet</>
          )}
        </Button>

        <Button
          onClick={() => testWarningMutation.mutate()}
          disabled={testWarningMutation.isPending}
          variant="outline"
          className="w-full sm:w-auto gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
          data-testid="button-test-warning"
        >
          {testWarningMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Gönderiliyor...</>
          ) : (
            <><Send className="h-4 w-4" />Test Uyarısı Gönder</>
          )}
        </Button>
      </div>

      {/* ── Announcements Section ─────────────────────────────────────────── */}
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Toplu Mesaj ve Duyurular
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">Zamanlı mesajlar oluşturun, tüm çalışanlara otomatik gönderilsin.</p>
          </div>
          <Button size="sm" className="gap-1" onClick={() => { setShowAnnForm(true); setEditingAnnId(null); setAnnForm(defaultAnnForm); setAnnImageFile(null); setAnnImagePreview(null); }}>
            <Plus className="h-4 w-4" /> Yeni Duyuru
          </Button>
        </div>

        {/* Form */}
        {showAnnForm && (
          <Card className="mb-4 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{editingAnnId ? "Duyuruyu Düzenle" : "Yeni Duyuru"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAnnSubmit} className="space-y-3">
                <div>
                  <Label>Başlık</Label>
                  <Input value={annForm.title} onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))} placeholder="Günaydın!" required />
                </div>
                <div>
                  <Label>İçerik</Label>
                  <Textarea value={annForm.content} onChange={e => setAnnForm(f => ({ ...f, content: e.target.value }))} placeholder="Mesaj içeriği..." rows={3} required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Gönderim Saati</Label>
                    <Input type="time" value={annForm.scheduledTime} onChange={e => setAnnForm(f => ({ ...f, scheduledTime: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Tekrar</Label>
                    <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={annForm.repeatType} onChange={e => setAnnForm(f => ({ ...f, repeatType: e.target.value }))}>
                      <option value="daily">Her gün</option>
                      <option value="weekly">Her hafta</option>
                      <option value="once">Tek seferlik</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label>Gönderim Sayısı <span className="text-muted-foreground text-xs">(0 = sınırsız)</span></Label>
                  <Input type="number" min={0} value={annForm.repeatCount} onChange={e => setAnnForm(f => ({ ...f, repeatCount: Number(e.target.value) }))} />
                </div>

                {/* Image */}
                <div>
                  <Label>Görsel</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => imageInputRef.current?.click()}>
                      <ImageIcon className="h-4 w-4" /> Görsel Seç
                    </Button>
                    {annImagePreview && <img src={annImagePreview} alt="preview" className="h-10 w-10 rounded object-cover border" />}
                    {(annImageFile || annImagePreview) && (
                      <Button type="button" variant="ghost" size="sm" className="text-red-500" onClick={() => { setAnnImageFile(null); setAnnImagePreview(null); setAnnForm(f => ({ ...f, imageUrl: "" })); }}>Kaldır</Button>
                    )}
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleAnnImageChange} />
                  {!annImageFile && !annImagePreview && (
                    <p className="text-xs text-muted-foreground mt-1">Varsayılan: yüklenen resim. Boş bırakılırsa yalnızca metin gönderilir.</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setAnnForm(f => ({ ...f, isActive: !f.isActive }))} className="text-primary">
                    {annForm.isActive ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  </button>
                  <span className="text-sm">{annForm.isActive ? "Aktif — otomatik gönderilecek" : "Pasif"}</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="submit" disabled={createAnnMutation.isPending || updateAnnMutation.isPending} className="gap-1">
                    {(createAnnMutation.isPending || updateAnnMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {editingAnnId ? "Güncelle" : "Kaydet"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setShowAnnForm(false); setEditingAnnId(null); }}>İptal</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Henüz duyuru yok. "Yeni Duyuru" ile ekleyin.</p>
        ) : (
          <div className="space-y-2">
            {announcements.map((ann) => (
              <Card key={ann.id} className={ann.isActive ? "" : "opacity-60"}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex gap-3 min-w-0">
                      {ann.imageUrl && <img src={ann.imageUrl} alt="" className="h-10 w-10 rounded object-cover border shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{ann.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{ann.content}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                          <span>⏰ {ann.scheduledTime}</span>
                          <span>🔁 {ann.repeatType === "daily" ? "Her gün" : ann.repeatType === "weekly" ? "Her hafta" : "Tek seferlik"}</span>
                          {ann.repeatCount > 0 && <span>×{ann.repeatCount}</span>}
                          <span>📤 {ann.sentCount} gönderildi</span>
                          <span className={ann.isActive ? "text-green-600 font-medium" : "text-red-500"}>
                            {ann.isActive ? "Aktif" : "Pasif"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" title="Hemen Gönder" onClick={() => sendAnnMutation.mutate(ann.id)} disabled={sendAnnMutation.isPending}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditAnn(ann)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => { if (confirm("Bu duyuruyu silmek istiyor musunuz?")) deleteAnnMutation.mutate(ann.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
